import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const read = (name: string) => readFileSync(join(process.cwd(), name), "utf8");
const homepage = read("components/marketing/AtelierHomepage.tsx");
const nav = read("components/marketing/AtelierExperience.tsx");
const pricing = read("components/marketing/PricingLeadCapture.tsx");
const faq = read("components/marketing/FaqV2.tsx");
const assistantKnowledge = read("lib/rivora/marketing-faq.ts");
const terms = read("app/terms/page.tsx");

test("website and AI assistant agree on the new monthly price", () => {
  for (const source of [pricing, faq, assistantKnowledge, terms]) {
    assert.match(source, /790/);
    assert.doesNotMatch(source, /990|2.?970/);
  }
  assert.match(pricing, /No 3-month minimum/);
  assert.match(faq, /no three-month minimum/);
  assert.match(assistantKnowledge, /no three-month minimum term/);
  assert.match(terms, /tilausehdot/);
});

test("ERP positioning makes Business Central an example, not a prerequisite", () => {
  assert.match(homepage, /id="integrations"/);
  assert.match(homepage, /without an ERP connection/);
  assert.match(nav, /#integrations/);
  assert.doesNotMatch(nav, /#business-central/);
  assert.match(faq, /Muun ERP:n yhdistämismahdollisuus/);
  assert.match(assistantKnowledge, /only available native ERP integration/);
  assert.match(assistantKnowledge, /case by case/);
});

test("subscription copy has no expired pilot pricing", () => {
  for (const source of [homepage, pricing, faq, assistantKnowledge]) {
    assert.doesNotMatch(source, /three-month pilot|kolmen kuukauden pilotti|€990|990 €/);
  }
  assert.match(pricing, /erikseen/);
  assert.match(faq, /separately/);
});
