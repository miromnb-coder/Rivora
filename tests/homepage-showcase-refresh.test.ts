import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const faq = readFileSync(
  join(process.cwd(), "components/marketing/FaqV2.tsx"),
  "utf8",
);
const homepageSections = readFileSync(
  join(process.cwd(), "components/marketing/HomepageV2Sections.tsx"),
  "utf8",
);
const css = readFileSync(join(process.cwd(), "app/globals.css"), "utf8");

test("FAQ AI is the final inline question row instead of a separate card", () => {
  assert.match(faq, /faq-v2-ai-item/);
  assert.match(faq, /placeholder=\{fi \? "Kysy jotain muuta tekoälyltä"/);
  assert.match(faq, /faq-v2-ai-form/);
  assert.match(faq, /faq-v2-ai-response/);
  assert.match(faq, /aria-live="polite"/);
  assert.doesNotMatch(faq, /faq-v2-ask-heading/);
  assert.doesNotMatch(faq, /faq-v2-ai-badge/);
  assert.doesNotMatch(faq, /Keskustele pilotista/);
});

test("FAQ AI sends with a compact arrow button and renders the answer as text", () => {
  assert.match(faq, /\{asking \? "···" : "→"\}/);
  assert.match(faq, /<p>\{askResult\.answer\}<\/p>/);
  assert.match(css, /\.faq-v2-ai-item \{/);
  assert.match(css, /\.faq-v2-ai-form > input:not\(\.faq-v2-honeypot\)/);
  assert.match(css, /background: transparent/);
  assert.match(css, /faq-v2-inline-answer-in/);
});

test("homepage product explanations use the refreshed continuous showcase surfaces", () => {
  for (const hook of [
    "product-resolution-showcase",
    "workflow-showcase",
    "memory-showcase",
    "confidence-showcase",
    "ai-showcase",
  ]) {
    assert.ok(homepageSections.includes(hook), hook);
  }

  assert.match(homepageSections, /RFQ → Quote → PO → ERP/);
  assert.match(homepageSections, /confidence-showcase-threshold/);
  assert.doesNotMatch(homepageSections, /confidence-v2-threshold/);
  assert.match(css, /grid-template-columns: repeat\(4, minmax\(0, 1fr\)\)/);
});

test("the 90 percent example threshold is integrated into the confidence surface", () => {
  assert.match(homepageSections, /Tarkistusraja/);
  assert.match(homepageSections, /<strong>90%<\/strong>/);
  assert.match(css, /\.confidence-showcase-threshold \{/);
  assert.match(css, /\.confidence-showcase-scale \{/);
});
