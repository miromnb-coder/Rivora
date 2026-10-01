import assert from "node:assert/strict";
import test from "node:test";
import {
  businessCentralSalesOrderHeader,
  businessCentralSalesOrderLinePayload,
  businessCentralUnitsCompatible,
  sanitizedBusinessCentralRequest,
  type BusinessCentralSalesOrderInput,
} from "../lib/rivora/erp/business-central.ts";

function input(): BusinessCentralSalesOrderInput {
  return {
    workspaceId: "workspace-1",
    customerNumber: "C-100",
    customerPoNumber: "PO-7788",
    orderDate: "2026-10-01",
    currency: "eur",
    lines: [
      {
        lineNumber: 1,
        externalItemNumber: "ITEM-100",
        description: "Industrial pump",
        quantity: 3,
        unit: "kpl",
        unitPrice: 48.5,
      },
    ],
  };
}

test("Business Central header keeps customer PO as external document number", () => {
  assert.deepEqual(businessCentralSalesOrderHeader(input()), {
    orderDate: "2026-10-01",
    customerNumber: "C-100",
    currencyCode: "EUR",
    externalDocumentNumber: "PO-7788",
  });
});

test("Business Central line payload creates an Item line without guessing a UOM code", () => {
  const payload = businessCentralSalesOrderLinePayload(input().lines[0]!, {
    id: "item-guid",
    number: "ITEM-100",
  });

  assert.deepEqual(payload, {
    itemId: "item-guid",
    lineType: "Item",
    lineObjectNumber: "ITEM-100",
    description: "Industrial pump",
    quantity: 3,
    unitPrice: 48.5,
  });
});

test("Business Central unit check accepts common equivalent piece units", () => {
  assert.equal(businessCentralUnitsCompatible("kpl", "PCS"), true);
  assert.equal(businessCentralUnitsCompatible("pcs", "EA"), true);
  assert.equal(businessCentralUnitsCompatible("kg", "KG"), true);
  assert.equal(businessCentralUnitsCompatible("kg", "PCS"), false);
});

test("sanitized Business Central request never includes OAuth credentials", () => {
  const payload = sanitizedBusinessCentralRequest(input());
  const serialized = JSON.stringify(payload);

  assert.equal(payload.provider, "business_central");
  assert.equal(payload.lineCount, 1);
  assert.equal(serialized.includes("clientSecret"), false);
  assert.equal(serialized.includes("access_token"), false);
  assert.equal(serialized.includes("tenantId"), false);
});
