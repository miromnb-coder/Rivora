import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const robots = readFileSync(join(process.cwd(), "app/robots.ts"), "utf8");
const sitemap = readFileSync(join(process.cwd(), "app/sitemap.ts"), "utf8");
const layout = readFileSync(join(process.cwd(), "app/layout.tsx"), "utf8");
const homepage = readFileSync(join(process.cwd(), "app/page.tsx"), "utf8");

test("robots exposes sitemap while keeping private application routes out of crawl", () => {
  assert.match(robots, /sitemap: "https:\/\/averomira\.com\/sitemap\.xml"/);
  assert.match(robots, /"\/app\/"/);
  assert.match(robots, /"\/api\/"/);
  assert.match(robots, /host: "https:\/\/averomira\.com"/);
});

test("sitemap contains the canonical Averomira marketing homepage", () => {
  assert.match(sitemap, /url: "https:\/\/averomira\.com"/);
  assert.equal(sitemap.includes("/app/"), false);
  assert.equal(sitemap.includes("/login"), false);
});

test("root metadata explicitly allows Google indexing", () => {
  assert.match(layout, /robots: \{/);
  assert.match(layout, /googleBot: \{/);
  assert.match(layout, /"max-snippet": -1/);
});

test("homepage publishes Organization and WebSite schema with stable IDs", () => {
  assert.match(homepage, /"@type": "Organization"/);
  assert.match(homepage, /"@id": "https:\/\/averomira\.com\/#organization"/);
  assert.match(homepage, /logo: "https:\/\/averomira\.com\/favicon\.svg"/);
  assert.match(homepage, /"@type": "WebSite"/);
  assert.match(homepage, /"@id": "https:\/\/averomira\.com\/#website"/);
});
