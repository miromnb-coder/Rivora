import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { supportEscalationDraft } from "../lib/rivora/support-escalation.ts";

const center = readFileSync(join(process.cwd(), "components/support/SupportCenter.tsx"), "utf8");
const aiRoute = readFileSync(join(process.cwd(), "app/api/support/ask/route.ts"), "utf8");
const ticketRoute = readFileSync(join(process.cwd(), "app/api/support/tickets/route.ts"), "utf8");
const p = "/app/rfq/22222222-2222-4222-8222-222222222222";

test("S8 escalation includes only current-record conversation and never sends automatically", () => {
  const result = supportEscalationDraft([
    { role:"user",path:"/app/quotes/other",text:"Confidential quote from another record" },
    { role:"user",path:p,text:"Why does this item need review?" },
    { role:"assistant",path:p,text:"Check the unconfirmed line.",requestId:"req-77" },
  ], p, "en");
  assert.match(result.body, /Why does this item need review/);
  assert.match(result.body, /Support AI request: req-77/);
  assert.doesNotMatch(result.body, /Confidential quote/);
  assert.match(center, /setView\(\{ kind: "contact" \}\)/);
  assert.match(center, /Keskustelun turvallinen yhteenveto on lisätty luonnokseen/);
  assert.doesNotMatch(center.slice(center.indexOf("function openContactFromAi"), center.indexOf("async function askSupportAi")), /fetch\(/);
});

test("S8 omits suspected credentials instead of forwarding them to the support request", () => {
  const secret = "sk-" + "x".repeat(30);
  const draft = supportEscalationDraft([
    {role:"user",path:p,text:"Client secret: "+secret},
    {role:"user",path:p,text:"The integration is failing"},
  ], p, "fi");
  assert.equal(draft.omitted, 1);
  assert.doesNotMatch(draft.body, /sk-x/);
  assert.match(draft.body, /jätettiin pois/);
  assert.equal(draft.subject.startsWith("Support AI:"), true);
});

test("S8 keeps existing notification and support workflow; rate limits remain in place", () => {
  assert.match(ticketRoute, /notifySupportAboutCustomerMessage/);
  assert.match(ticketRoute, /create_support_ticket_server/);
  assert.match(ticketRoute, /support_ticket_user/);
  assert.match(center, /method: "POST"/);
  assert.match(center, /\/api\/support\/tickets/);
  assert.match(aiRoute, /support_ai_user_short/);
  assert.match(aiRoute, /support_ai_user_day/);
  assert.match(aiRoute, /max_output_tokens:\s*Math\.min\(500,\s*pricing\?\.maxOutputTokens\s*\?\?\s*500\)/);
});

test("S8 subject and body remain within current ticket API bounds", () => {
  const draft = supportEscalationDraft(
    Array.from({length:15}, () => ({role:"user" as const,path:p,text:"x".repeat(1100)})),
    p, "en",
  );
  assert.ok(draft.subject.length <= 160);
  assert.ok(draft.body.length <= 5000);
});

test("S8 provider requests are bounded and only numeric usage metadata is logged", () => {
  assert.match(aiRoute, /timeout: 20_000/);
  assert.match(aiRoute, /maxRetries: 0/);
  assert.match(aiRoute, /support_ai_usage/);
  assert.match(aiRoute, /inputTokens/);
  assert.match(aiRoute, /outputTokens/);
  assert.doesNotMatch(aiRoute.slice(aiRoute.indexOf('"support_ai_usage"'), aiRoute.indexOf("const output =")), /question:|answer:|history:/);
  assert.match(center, /aiMessages\.some\(\(item\) => item\.role === "assistant"\) \|\| aiError \? \(/);
});
