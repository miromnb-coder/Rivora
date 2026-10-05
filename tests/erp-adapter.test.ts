import assert from "node:assert/strict";
import test from "node:test";
import {
  getErpAdapter,
  requireErpAdapter,
  type ErpSalesOrderInput,
} from "../lib/rivora/erp/index.ts";

test("ERP resolver returns the native Business Central adapter", () => {
  const adapter = getErpAdapter("business_central");

  assert.ok(adapter);
  assert.equal(adapter.provider, "business_central");
  assert.equal(adapter.displayName, "Microsoft Business Central");
});

test("ERP resolver leaves non-native providers without an adapter", () => {
  assert.equal(getErpAdapter("custom"), null);
  assert.equal(getErpAdapter("none"), null);
  assert.equal(getErpAdapter("unknown"), null);
});

test("required ERP adapter rejects providers without a native integration", () => {
  assert.throws(
    () => requireErpAdapter("custom"),
    /No native ERP adapter is available/,
  );
});

test("ERP adapter sanitizes a sales order without leaking credentials", () => {
  const adapter = requireErpAdapter("business_central");
  const input: ErpSalesOrderInput = {
    workspaceId: "workspace-1",
    customerNumber: "C-100",
    customerPoNumber: "PO-100",
    orderDate: "2026-10-05",
    currency: "EUR",
    lines: [
      {
        lineNumber: 1,
        externalItemNumber: "ITEM-100",
        description: "Pump",
        quantity: 2,
        unit: "pcs",
        unitPrice: 50,
      },
    ],
  };

  const payload = adapter.sanitizeSalesOrderRequest(input);
  const serialized = JSON.stringify(payload);

  assert.equal(payload.provider, "business_central");
  assert.equal(serialized.includes("clientSecret"), false);
  assert.equal(serialized.includes("access_token"), false);
});
