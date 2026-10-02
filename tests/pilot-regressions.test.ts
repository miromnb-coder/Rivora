import assert from "node:assert/strict";
import { test } from "node:test";
import { PDFDocument } from "pdf-lib";
import { toCatalogueRows, toRfqRows } from "../lib/rivora/imports.ts";
import { validateRfqExtraction } from "../lib/rivora/openai-rfq.ts";
import { quotePdfFilename, renderQuotePdf, type QuoteDocumentData } from "../lib/rivora/quote-document.ts";

test("catalogue parser normalizes Finnish decimal prices and keeps missing price explicit", () => {
  const rows = toCatalogueRows([
    { SKU: "ABC-1", Name: "Valve", Hinta: "1 234,50", Saldo: "7" },
    { SKU: "ABC-2", Name: "Seal", Hinta: "", Saldo: "" },
  ]);

  assert.equal(rows[0].unitPrice, 1234.5);
  assert.equal(rows[0].stockQuantity, 7);
  assert.equal(rows[1].unitPrice, null);
  assert.equal(rows[1].stockQuantity, null);
});

test("catalogue parser rejects unsafe commercial rows", () => {
  assert.throws(
    () => toCatalogueRows([{ SKU: "BAD-1", Name: "Bad", Price: "-1" }]),
    /negative unit price/
  );
  assert.throws(
    () => toCatalogueRows([{ SKU: "", Name: "Missing SKU" }]),
    /missing SKU or product name/
  );
});

test("structured RFQ parser requires positive quantity and source content", () => {
  const [row] = toRfqRows([
    { "Customer SKU": "CUST-42", Description: "Bearing", Qty: "12", Unit: "pcs" },
  ]);
  assert.equal(row.customerSku, "CUST-42");
  assert.equal(row.quantity, 12);

  assert.throws(
    () => toRfqRows([{ "Customer SKU": "CUST-42", Qty: "0" }]),
    /missing or invalid quantity/
  );
  assert.throws(
    () => toRfqRows([{ Description: "", Qty: "1" }]),
    /missing both SKU and description/
  );
});

test("AI extraction normalization cannot silently create invalid RFQ lines", () => {
  const extraction = validateRfqExtraction({
    document_type: "rfq",
    customer_name: " Example Oy ",
    customer_email: null,
    reference: "RFQ-1",
    request_date: null,
    currency: "EUR",
    overall_confidence: 140,
    warnings: ["Check unit", 123],
    lines: [
      {
        line_number: 99,
        customer_sku: "  C-001  ",
        description: "  Industrial valve  ",
        manufacturer: null,
        manufacturer_part_number: null,
        quantity: 2,
        unit: " pcs ",
        source_page: 1,
        confidence: -20,
        notes: " check ",
      },
    ],
  });

  assert.equal(extraction.overall_confidence, 100);
  assert.deepEqual(extraction.warnings, ["Check unit"]);
  assert.equal(extraction.lines[0].line_number, 1);
  assert.equal(extraction.lines[0].customer_sku, "C-001");
  assert.equal(extraction.lines[0].description, "Industrial valve");
  assert.equal(extraction.lines[0].confidence, 0);
  assert.equal(extraction.lines[0].unit, "pcs");

  assert.throws(
    () => validateRfqExtraction({
      document_type: "rfq",
      overall_confidence: 50,
      warnings: [],
      lines: [{
        line_number: 1,
        customer_sku: "X",
        description: "",
        manufacturer: null,
        manufacturer_part_number: null,
        quantity: 0,
        unit: null,
        source_page: 1,
        confidence: 50,
        notes: null,
      }],
    }),
    /Invalid quantity/
  );
});

const goldenQuote: QuoteDocumentData = {
  quoteId: "00000000-0000-0000-0000-000000000001",
  quoteNumber: "Q-2026-GOLDEN",
  status: "approved",
  currency: "EUR",
  createdAt: "2026-09-28T08:00:00.000Z",
  validUntil: "2026-10-12",
  customerReference: "RFQ-GOLDEN",
  notes: "Delivery according to agreement.",
  taxRate: 25.5,
  recipientName: "Test Buyer",
  recipientEmail: "buyer@example.com",
  customerName: "Pilot Customer Oy",
  rfqReference: "RFQ-GOLDEN",
  sellerName: "Nodra Test Oy",
  sellerBusinessId: "1234567-8",
  sellerAddress: "Testikatu 1, 33100 Tampere, Finland",
  sellerEmail: "sales@example.com",
  sellerPhone: "+358 40 000 0000",
  logoBytes: null,
  logoMime: null,
  lines: [
    {
      line_number: 1,
      sku_snapshot: "VALVE-100",
      description_snapshot: "Industrial control valve",
      quantity: 2,
      unit: "pcs",
      unit_price: 125.5,
      discount_percent: 10,
      line_total: 225.9,
    },
    {
      line_number: 2,
      sku_snapshot: "SEAL-200",
      description_snapshot: "Replacement seal kit",
      quantity: 3,
      unit: "pcs",
      unit_price: 20,
      discount_percent: 0,
      line_total: 60,
    },
  ],
};

test("quote PDF golden fixture is deterministic, valid and customer-safe", async () => {
  const first = await renderQuotePdf(goldenQuote);
  const second = await renderQuotePdf(goldenQuote);

  assert.ok(first.subarray(0, 32).toString("latin1").startsWith("%PDF-1.4\n%AVEROMIRA"));
  assert.deepEqual(first, second);

  const parsed = await PDFDocument.load(first);
  assert.equal(parsed.getPageCount(), 1);
  assert.equal(quotePdfFilename("Q/2026 Golden #1"), "Q-2026-Golden-1.pdf");
});
