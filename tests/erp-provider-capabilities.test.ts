import assert from "node:assert/strict";
import test from "node:test";
import {
  getErpAdapter,
  getErpProviderCapability,
  isSelectableErpProvider,
} from "../lib/rivora/erp/index.ts";

test("Business Central is the only native ERP capability", () => {
  const capability = getErpProviderCapability("business_central");
  assert.equal(capability.availability, "native");
  assert.equal(capability.hasNativeAdapter, true);
  assert.equal(capability.supportsConnection, true);
  assert.equal(capability.supportsAutomaticExport, true);
  assert.equal(getErpAdapter("business_central")?.provider, "business_central");
});

test("custom ERP never exposes a native adapter or automatic export", () => {
  const capability = getErpProviderCapability("custom");
  assert.equal(capability.availability, "unsupported");
  assert.equal(capability.hasNativeAdapter, false);
  assert.equal(capability.supportsConnection, false);
  assert.equal(capability.supportsAutomaticExport, false);
  assert.equal(getErpAdapter("custom"), null);
});

test("no ERP selection is explicitly disabled", () => {
  const capability = getErpProviderCapability("none");
  assert.equal(capability.availability, "disabled");
  assert.equal(capability.supportsAutomaticExport, false);
  assert.equal(getErpAdapter("none"), null);
});

test("unknown provider keys fail closed instead of pretending to be integrated", () => {
  const capability = getErpProviderCapability("sap_s4hana");
  assert.equal(capability.availability, "unavailable");
  assert.equal(capability.hasNativeAdapter, false);
  assert.equal(capability.supportsAutomaticExport, false);
  assert.equal(getErpAdapter("sap_s4hana"), null);
});

test("settings only accepts explicitly supported workspace selections", () => {
  assert.equal(isSelectableErpProvider("business_central"), true);
  assert.equal(isSelectableErpProvider("custom"), true);
  assert.equal(isSelectableErpProvider("none"), true);
  assert.equal(isSelectableErpProvider("sap_s4hana"), false);
});
