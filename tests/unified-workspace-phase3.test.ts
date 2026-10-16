import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const read = (name: string) => readFileSync(join(process.cwd(), name), "utf8");
const dashboard = read("app/app/page.tsx");
const orders = read("app/app/orders/page.tsx");
const customers = read("app/app/customers/page.tsx");
const products = read("app/app/products/page.tsx");
const leads = read("app/app/leads/page.tsx");
const css = read("app/app/unified-pages.css");

test("Overview and orders keep business links and source data processing", () => {
  assert.match(dashboard, /requireWorkspace\(\)/);
  assert.match(dashboard, /taskCases = new Map/);
  assert.match(dashboard, /recentCases\.map/);
  assert.match(orders, /displayCases = new Map/);
  assert.match(orders, /filtered = allCases\.filter/);
  assert.match(orders, /row\.nextAction/);
  assert.match(orders, /row\.href/);
  assert.match(orders, /enintään|ladattujen tapausten|loaded cases/);
});
test("Product and customer lists preserve actions and do not promise global totals", () => {
  assert.match(customers, /action=\{createCustomer\}/);
  assert.match(customers, /<details className="ml-add-details"/);
  assert.match(customers, /customer\.contactCount/);
  assert.match(customers, /customer\.memoryCount/);
  assert.match(customers, /500 asiakasta/);
  assert.match(products, /totalCount \?\? rows\.length/);
  assert.match(products, /stockTone\(stock\)/);
  assert.match(products, /product\.unit_price == null/);
  assert.match(products, /500 ladattuun tuotteeseen/);
  assert.match(products, /\/app\/upload/);
});
test("Leads maintain existing filters, company data and compact presentation", () => {
  assert.match(leads, /requireSalesAdmin\(\)/);
  assert.match(leads, /\\.from\("marketing_leads"\)/);
  assert.match(leads, /selectedView = views\.includes/);
  assert.match(leads, /ml-unified-leads-summary/);
  assert.match(leads, /ml-unified-leads-filters/);
  for (const part of ["person","company","intent","followup","state","open"]) assert.match(leads, new RegExp("ml-lead-" + part));
});
test("Shared responsive styles do not alter public pages or Copilot", () => {
  assert.match(css, /\\.ml-workspace-shell \\.ml-page-head/);
  assert.match(css, /@container ml-orders \(max-width: 610px\)/);
  assert.match(css, /\\.ml-workspace-shell \\.ml-customer-item/);
  assert.match(css, /\\.ml-workspace-shell \\.ml-product-item/);
  assert.match(css, /prefers-reduced-motion/);
  assert.doesNotMatch(read("app/layout.tsx"), /unified-pages\.css/);
  assert.doesNotMatch(read("components/support/SupportCenter.tsx"), /ml-unified-page/);
});
