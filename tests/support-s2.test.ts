import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const supportContext = readFileSync(
  join(process.cwd(), "lib/rivora/support-context.ts"),
  "utf8",
);
const supportCenter = readFileSync(
  join(process.cwd(), "components/support/SupportCenter.tsx"),
  "utf8",
);
const contextTrigger = readFileSync(
  join(process.cwd(), "components/support/ContextHelpTrigger.tsx"),
  "utf8",
);
const rfqPage = readFileSync(
  join(process.cwd(), "app/app/rfq/[id]/page.tsx"),
  "utf8",
);
const bcPage = readFileSync(
  join(process.cwd(), "app/app/settings/business-central/page.tsx"),
  "utf8",
);
const poPage = readFileSync(
  join(process.cwd(), "app/app/purchase-orders/[id]/page.tsx"),
  "utf8",
);
const quotePage = readFileSync(
  join(process.cwd(), "app/app/quotes/[id]/page.tsx"),
  "utf8",
);

test("S2 maps high-value app routes to contextual help articles", () => {
  assert.match(supportContext, /\/app\\\/rfq\\\/\[\^\/\]\+/);
  assert.match(supportContext, /business-central-mapping/);
  assert.match(supportContext, /business-central-client-id/);
  assert.match(supportContext, /po-exceptions/);
  assert.match(supportContext, /quote-locking/);
  assert.match(supportContext, /smart-memory/);
});

test("S2 Help Center surfaces view-specific guidance before the full library", () => {
  assert.match(supportCenter, /supportContextForPath\(pathname, locale\)/);
  assert.match(supportCenter, /SUOSITELTU TÄSSÄ NÄKYMÄSSÄ/);
  assert.match(supportCenter, /RECOMMENDED IN THIS VIEW/);
  assert.match(supportCenter, /support-context-links/);
  assert.match(supportCenter, /Kaikki ohjeet/);
});

test("S2 includes focused contextual articles for review decisions and ERP setup", () => {
  for (const id of [
    "rfq-why-review",
    "business-central-client-id",
    "business-central-mapping",
    "po-exceptions",
    "quote-locking",
  ]) {
    assert.match(supportCenter, new RegExp(`id: "${id}"`));
  }

  assert.match(
    supportCenter,
    /Client ID is not the Client Secret|Client ID ei ole sama asia kuin Client Secret/,
  );
  assert.match(
    supportCenter,
    /ei ohita RFQ Review -vahvistusta|does not bypass RFQ Review confirmation/,
  );
});

test("inline question-mark help opens the same global Support Center", () => {
  assert.match(contextTrigger, /averomira:support-open/);
  assert.match(contextTrigger, /new CustomEvent/);
  assert.match(supportCenter, /window\.addEventListener\(SUPPORT_OPEN_EVENT/);
  assert.match(supportCenter, /setView\(\{ kind: "article", articleId \}\)/);
  assert.match(supportCenter, /setOpen\(true\)/);
});

test("S2 places contextual help only in high-value decision areas", () => {
  assert.match(rfqPage, /articleId="rfq-why-review"/);
  assert.match(bcPage, /articleId="business-central-mapping"/);
  assert.match(poPage, /articleId="po-exceptions"/);
  assert.match(quotePage, /articleId="quote-locking"/);
});

test("S2 contextual-help layer remains passive as later support phases are added", () => {
  assert.equal(contextTrigger.includes("fetch("), false);
  assert.equal(supportContext.includes("openai"), false);
  assert.match(supportCenter, /SUOSITELTU TÄSSÄ NÄKYMÄSSÄ/);
  assert.match(supportCenter, /support-context-links/);
});
