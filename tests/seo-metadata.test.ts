import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const layout = readFileSync(join(process.cwd(), "app/layout.tsx"), "utf8");
const homepage = readFileSync(join(process.cwd(), "app/page.tsx"), "utf8");

test("Averomira SEO metadata describes the full RFQ-to-ERP workflow", () => {
  assert.match(
    layout,
    /Averomira — RFQ, Quotes, PO Reconciliation & ERP/,
  );
  assert.match(
    layout,
    /reviewed quote, purchase order reconciliation and ERP-ready sales order/,
  );
  assert.match(layout, /metadataBase: new URL\("https:\/\/averomira\.com"\)/);
  assert.match(layout, /canonical: "\/"/);
});

test("homepage exposes Organization structured data for Averomira", () => {
  assert.match(homepage, /"@type": "Organization"/);
  assert.match(homepage, /name: "Averomira"/);
  assert.match(homepage, /url: "https:\/\/averomira\.com"/);
  assert.match(homepage, /logo: "https:\/\/averomira\.com\/icon\.svg"/);
  assert.match(homepage, /application\/ld\+json/);
});
