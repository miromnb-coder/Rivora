import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const stream = readFileSync("app/api/copilot/stream/route.ts", "utf8");
const status = readFileSync("app/api/copilot/status/route.ts", "utf8");
const ui = readFileSync("components/copilot/CopilotConversation.tsx", "utf8");
const css = readFileSync("app/app/copilot-conversation.css", "utf8");
const live = readFileSync("lib/rivora/copilot-live.ts", "utf8");

test("Pilot actor and organization authorization happens before any model cost reservation", () => {
  const guard = stream.indexOf("if (!copilotActorAuthorizedForEnvironment(");
  const reserve = stream.indexOf("await ledger.reserve(");
  const model = stream.indexOf("ai.responses.create(");
  assert.ok(guard > 0 && reserve > guard && model > reserve);
  assert.match(stream, /getAuthContext\(\)/);
  assert.match(stream, /context\.workspace\.role/);
  assert.match(stream, /reasoning: \{ effort: "none" \}/);
  assert.match(stream, /store: false, stream: true/);
  assert.match(stream, /await billing\.complete/);
});

test("Authorized pilot status is read-only, authenticated and cache-disabled", () => {
  assert.match(status, /getAuthContext\(\)/);
  assert.match(status, /copilotActivationReadiness\(\)/);
  assert.match(status, /copilotActorAuthorizedForEnvironment\(/);
  assert.match(status, /"Cache-Control": "private, no-store"/);
  assert.doesNotMatch(status, /reserve\(|settle\(|\.insert\(|\.update\(|\.delete\(/);
  assert.match(ui, /fetch\("\/api\/copilot\/status"/);
  assert.match(ui, /status\?\.available === true && status\?\.pilot === true/);
  assert.match(css, /\.ml-copilot-pilot-label/);
  assert.match(live, /AVEROMIRA_COPILOT_PILOT_NO_BACKUP_RISK_ACCEPTED/);
  assert.match(live, /AVEROMIRA_COPILOT_PILOT_ACTOR_ID/);
  assert.match(live, /AVEROMIRA_COPILOT_PILOT_ORGANIZATION_ID/);
});
