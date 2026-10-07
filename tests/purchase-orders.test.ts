import assert from "node:assert/strict";
import test from "node:test";
import {
  toPurchaseOrderRows,
  toPurchaseOrderRowsWithFieldMemory,
} from "../lib/rivora/imports.ts";
import {
  validatePurchaseOrderExtraction,
} from "../lib/rivora/openai-po.ts";

test("toPurchaseOrderRows parses English purchase order columns", () => {
  const rows = toPurchaseOrderRows([
    {
      "Customer SKU": "CUS-001",
      Description: "Industrial pump",
      Quantity: "12",
      Unit: "pcs",
      "Unit Price": "48.50",
      "Line Total": "582.00",
      Manufacturer: "Acme",
      MPN: "P-100",
    },
  ]);

  assert.deepEqual(rows, [
    {
      customerSku: "CUS-001",
      description: "Industrial pump",
      manufacturer: "Acme",
      manufacturerPartNumber: "P-100",
      quantity: 12,
      unit: "pcs",
      unitPrice: 48.5,
      discountPercent: 0,
      lineTotal: 582,
    },
  ]);
});

test("toPurchaseOrderRows parses Finnish decimal comma columns", () => {
  const rows = toPurchaseOrderRows([
    {
      Tuotenumero: "A-55",
      Kuvaus: "Venttiili",
      "Määrä": "2",
      "Yksikkö": "kpl",
      "Yksikköhinta": "19,90",
      Rivisumma: "39,80",
    },
  ]);

  assert.equal(rows[0]?.customerSku, "A-55");
  assert.equal(rows[0]?.description, "Venttiili");
  assert.equal(rows[0]?.quantity, 2);
  assert.equal(rows[0]?.unit, "kpl");
  assert.equal(rows[0]?.unitPrice, 19.9);
  assert.equal(rows[0]?.discountPercent, 0);
  assert.equal(rows[0]?.lineTotal, 39.8);
});

test("toPurchaseOrderRows rejects a non-positive ordered quantity", () => {
  assert.throws(
    () =>
      toPurchaseOrderRows([
        {
          SKU: "A-55",
          Description: "Valve",
          Quantity: "0",
        },
      ]),
    /invalid quantity/i
  );
});

test("validatePurchaseOrderExtraction normalizes safe PO extraction", () => {
  const result = validatePurchaseOrderExtraction({
    document_type: "purchase_order",
    customer_name: " ACME Oy ",
    customer_email: null,
    po_number: " PO-1001 ",
    quote_reference: " Q-500 ",
    order_date: "2026-10-01",
    currency: "eur",
    overall_confidence: 104,
    warnings: ["Check handwritten delivery note"],
    lines: [
      {
        line_number: 8,
        customer_sku: " CUS-55 ",
        description: " Motor ",
        manufacturer: null,
        manufacturer_part_number: null,
        quantity: 3,
        unit: " pcs ",
        unit_price: 15.25,
        line_total: 45.75,
        source_page: 2,
        confidence: 91,
        notes: null,
      },
    ],
  });

  assert.equal(result.customer_name, "ACME Oy");
  assert.equal(result.po_number, "PO-1001");
  assert.equal(result.quote_reference, "Q-500");
  assert.equal(result.currency, "EUR");
  assert.equal(result.overall_confidence, 100);
  assert.equal(result.lines[0]?.line_number, 1);
  assert.equal(result.lines[0]?.customer_sku, "CUS-55");
  assert.equal(result.lines[0]?.unit, "pcs");
});

test("validatePurchaseOrderExtraction rejects invalid extracted quantities", () => {
  assert.throws(
    () =>
      validatePurchaseOrderExtraction({
        document_type: "purchase_order",
        customer_name: "ACME",
        customer_email: null,
        po_number: "PO-1",
        quote_reference: null,
        order_date: null,
        currency: "EUR",
        overall_confidence: 90,
        warnings: [],
        lines: [
          {
            line_number: 1,
            customer_sku: "A",
            description: "Part",
            manufacturer: null,
            manufacturer_part_number: null,
            quantity: -1,
            unit: "pcs",
            unit_price: null,
            line_total: null,
            source_page: 1,
            confidence: 90,
            notes: null,
          },
        ],
      }),
    /invalid quantity/i
  );
});


test("toPurchaseOrderRows normalizes gross unit price plus discount to net price", () => {
  const [row] = toPurchaseOrderRows([
    {
      SKU: "PUMP-1",
      Description: "Pump",
      Quantity: "2",
      Unit: "pcs",
      "Unit Price": "125.50",
      discount_percent: "10",
      "Line Total": "225.90",
    },
  ]);

  assert.equal(row.unitPrice, 112.95);
  assert.equal(row.discountPercent, 10);
  assert.equal(row.lineTotal, 225.9);
});

test("toPurchaseOrderRows rejects inconsistent discounted commercial values", () => {
  assert.throws(
    () =>
      toPurchaseOrderRows([
        {
          SKU: "PUMP-1",
          Description: "Pump",
          Quantity: "2",
          "Unit Price": "125.50",
          discount_percent: "10",
          "Line Total": "250.00",
        },
      ]),
    /inconsistent unit price, discount and line total/i,
  );
});


test("M4 structured PO import uses verified customer field-header memory", () => {
  const result = toPurchaseOrderRowsWithFieldMemory(
    [
      {
        Artikelnr: "CUS-77",
        Beschreibung: "Industrial relay",
        Bestellmenge: "4",
        Einheit: "ST",
      },
    ],
    [
      {
        memoryId: "mem-sku",
        sourceHeader: "Artikelnr",
        targetField: "customer_sku",
      },
      {
        memoryId: "mem-description",
        sourceHeader: "Beschreibung",
        targetField: "description",
      },
      {
        memoryId: "mem-quantity",
        sourceHeader: "Bestellmenge",
        targetField: "quantity",
      },
      {
        memoryId: "mem-unit",
        sourceHeader: "Einheit",
        targetField: "unit",
      },
    ],
  );

  assert.equal(result.rows[0]?.customerSku, "CUS-77");
  assert.equal(result.rows[0]?.description, "Industrial relay");
  assert.equal(result.rows[0]?.quantity, 4);
  assert.equal(result.rows[0]?.unit, "ST");
  assert.deepEqual(
    result.usedMemories.map((memory) => memory.memoryId).sort(),
    ["mem-description", "mem-quantity", "mem-sku", "mem-unit"],
  );
});

test("M4 explicit PO header memory owns a header over generic aliases", () => {
  const result = toPurchaseOrderRowsWithFieldMemory(
    [
      {
        SKU: "Pump with customer naming",
        "Custom SKU": "CUS-88",
        Quantity: "2",
      },
    ],
    [
      {
        memoryId: "mem-description",
        sourceHeader: "SKU",
        targetField: "description",
      },
      {
        memoryId: "mem-custom-sku",
        sourceHeader: "Custom SKU",
        targetField: "customer_sku",
      },
    ],
  );

  assert.equal(result.rows[0]?.customerSku, "CUS-88");
  assert.equal(result.rows[0]?.description, "Pump with customer naming");
  assert.equal(result.rows[0]?.quantity, 2);
});


test("M4 keeps built-in PO column alias priority independent of file column order", () => {
  const result = toPurchaseOrderRowsWithFieldMemory(
    [
      {
        Description: "Priority test",
        Quantity: "2",
        Price: "9.99",
        "Unit Price": "125.50",
      },
    ],
    [],
  );

  assert.equal(result.rows[0]?.unitPrice, 125.5);
});
