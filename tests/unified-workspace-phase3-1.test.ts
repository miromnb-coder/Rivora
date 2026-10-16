import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const read = (name: string) => readFileSync(join(process.cwd(), name), "utf8");
const customers = read("app/app/customers/page.tsx");
const leads = read("app/app/leads/page.tsx");
const products = read("app/app/products/page.tsx");
const overview = read("app/app/page.tsx");
const orders = read("app/app/orders/page.tsx");
const css = read("app/app/unified-pages.css");
const shell = read("components/workspace/WorkspaceFrame.tsx");

test("compact KPIs respond to the real work-column width, not screen width", () => {
  assert.match(css, /container: ml-kpis \/ inline-size/);
  assert.match(css, /@container ml-kpis \(min-width: 700px\)/);
  assert.match(css, /@container ml-kpis \(max-width: 699px\)/);
  assert.match(css, /min-height: 73px/);
  for (const page of [overview, orders, products]) assert.match(page, /ml-summary-grid/);
  assert.match(leads, /ml-unified-leads-summary/);
});
test("customer create action stays a native disclosure and never overlays records", () => {
  assert.match(customers, /ml-customer-head-row/);
  assert.match(customers, /<details className="ml-add-details">/);
  assert.match(customers, /action=\{createCustomer\}/);
  assert.match(css, /\.ml-unified-customers \.ml-add-details\[open\]/);
  assert.doesNotMatch(css, /position:\s*absolute.*ml-add-form/);
  assert.match(css, /@media \(max-width: 620px\)/);
});
test("unified headers and catalogue button spacing do not alter destinations", () => {
  assert.match(leads, /<header className="ml-page-head">/);
  assert.match(leads, /Työtila \/ Liidit/);
  assert.match(products, /href="\/app\/upload" className="ml-page-primary"/);
  assert.match(css, /gap: 9px/);
  assert.match(css, /\.ml-page-primary > span\[aria-hidden="true"\]/);
  for (const file of [overview, orders, products, customers]) {
    assert.match(file, /<header className="ml-page-head">/);
  }
});
test("compact leads still display all fields and retain link, filters and permissions", () => {
  assert.match(leads, /requireSalesAdmin\(\)/);
  assert.match(leads, /\.from\("marketing_leads"\)/);
  for (const field of ["person","company","intent","followup","state","open"]) assert.match(leads, new RegExp("ml-lead-" + field));
  assert.match(leads, /href=\{\`\/app\/leads\/\$\{lead\.id\}\`\}/);
  assert.match(leads, /selectedView === view/);
  assert.match(leads, /selectedStatus === status/);
  assert.match(css, /@container leads \(min-width: 650px\) and \(max-width: 900px\)/);
  assert.match(css, /grid-template-areas: "person company state" "intent followup open"/);
  assert.match(css, /min-height: 44px/);
  assert.doesNotMatch(shell, /Vercel Toolbar/);
});
