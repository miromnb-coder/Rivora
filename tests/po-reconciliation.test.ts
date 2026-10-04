import assert from "node:assert/strict";
import test from "node:test";
import {
  reconcilePurchaseOrder,
  type PurchaseOrderLineInput,
  type QuoteLineInput,
} from "../lib/rivora/po-reconciliation.ts";

function quoteLine(overrides: Partial<QuoteLineInput> = {}): QuoteLineInput {
  return {
    id: "q1",
    lineNumber: 1,
    sku: "SKU-100",
    productSku: "SKU-100",
    manufacturerPartNumber: "MPN-100",
    description: "Industrial valve DN25",
    sourceCustomerSku: "CUST-100",
    sourceDescription: "Industrial valve DN25",
    quantity: 10,
    unit: "pcs",
    unitPrice: 12,
    discountPercent: 10,
    lineTotal: 108,
    ...overrides,
  };
}

function poLine(overrides: Partial<PurchaseOrderLineInput> = {}): PurchaseOrderLineInput {
  return {
    id: "p1",
    lineNumber: 1,
    customerSku: "CUST-100",
    manufacturerPartNumber: null,
    description: "Industrial valve DN25",
    quantity: 10,
    unit: "kpl",
    unitPrice: 10.8,
    lineTotal: 108,
    ...overrides,
  };
}

test("reconciliation matches customer SKU and accepts normalized units", () => {
  const result = reconcilePurchaseOrder([poLine()], [quoteLine()]);
  assert.equal(result.summary.pairedLines, 1);
  assert.equal(result.summary.cleanMatches, 1);
  assert.equal(result.summary.exceptionLines, 0);
  assert.equal(result.lines[0]?.matchMethod, "customer_sku_exact");
  assert.deepEqual(result.lines[0]?.exceptionCodes, []);
});

test("reconciliation compares PO price to discounted net quote price", () => {
  const result = reconcilePurchaseOrder(
    [poLine({ unitPrice: 12, lineTotal: 120 })],
    [quoteLine()]
  );

  assert.deepEqual(result.lines[0]?.exceptionCodes, [
    "unit_price_mismatch",
    "line_total_mismatch",
  ]);
});

test("reconciliation flags quantity and unit differences", () => {
  const result = reconcilePurchaseOrder(
    [poLine({ quantity: 12, unit: "box" })],
    [quoteLine()]
  );

  assert.ok(result.lines[0]?.exceptionCodes.includes("quantity_mismatch"));
  assert.ok(result.lines[0]?.exceptionCodes.includes("unit_mismatch"));
});

test("reconciliation pairs by exact canonical SKU", () => {
  const result = reconcilePurchaseOrder(
    [poLine({ customerSku: "SKU-100", description: "Different wording" })],
    [quoteLine({ sourceCustomerSku: "OTHER" })]
  );

  assert.equal(result.lines[0]?.matchMethod, "sku_exact");
  assert.ok(!result.lines[0]?.exceptionCodes.includes("product_identity_review"));
});

test("fuzzy description match always requires human identity review", () => {
  const result = reconcilePurchaseOrder(
    [
      poLine({
        customerSku: null,
        description: "Industrial valve DN25 stainless",
      }),
    ],
    [
      quoteLine({
        sourceCustomerSku: null,
        sku: null,
        productSku: null,
        manufacturerPartNumber: null,
        description: "Industrial valve DN25 stainless steel",
        sourceDescription: null,
      }),
    ]
  );

  assert.equal(result.lines[0]?.matchMethod, "description_similarity");
  assert.ok(result.lines[0]?.exceptionCodes.includes("product_identity_review"));
  assert.equal(result.lines[0]?.reviewStatus, "open");
});

test("unmatched PO and quote lines become explicit exceptions", () => {
  const result = reconcilePurchaseOrder(
    [poLine({ customerSku: "PO-ONLY", description: "PO only product" })],
    [quoteLine({ sourceCustomerSku: "QUOTE-ONLY", sku: "Q-1", productSku: "Q-1", description: "Quote only product" })]
  );

  assert.equal(result.summary.extraPurchaseOrderLines, 1);
  assert.equal(result.summary.missingQuoteLines, 1);
  assert.deepEqual(
    result.lines.map((line) => line.exceptionCodes[0]).sort(),
    ["extra_po_line", "missing_quote_line"]
  );
});

test("duplicate identifiers are paired one-to-one using quantity as tie breaker", () => {
  const result = reconcilePurchaseOrder(
    [
      poLine({ id: "p1", lineNumber: 1, quantity: 5 }),
      poLine({ id: "p2", lineNumber: 2, quantity: 10 }),
    ],
    [
      quoteLine({ id: "q1", lineNumber: 1, quantity: 10, lineTotal: 108 }),
      quoteLine({ id: "q2", lineNumber: 2, quantity: 5, lineTotal: 54 }),
    ]
  );

  const p1 = result.lines.find((line) => line.poLineId === "p1");
  const p2 = result.lines.find((line) => line.poLineId === "p2");
  assert.equal(p1?.quoteLineId, "q2");
  assert.equal(p2?.quoteLineId, "q1");
});


test("reconciliation accepts gross PO unit price when line total proves the same discounted net value", () => {
  const result = reconcilePurchaseOrder(
    [poLine({ unitPrice: 12, lineTotal: 108 })],
    [quoteLine()]
  );

  assert.ok(!result.lines[0]?.exceptionCodes.includes("unit_price_mismatch"));
  assert.ok(!result.lines[0]?.exceptionCodes.includes("line_total_mismatch"));
});
