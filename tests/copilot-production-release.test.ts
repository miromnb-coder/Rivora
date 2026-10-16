import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  productionCopilotReadiness, copilotActivationReadiness,
} from "../lib/rivora/copilot-live.ts";

const sql = readFileSync("docs/copilot/PRODUCTION_LEDGER_PATCH_CANDIDATE.sql", "utf8");
const docs = readFileSync("docs/INTELLIGENT_COPILOT_PHASE_4_3.md", "utf8");
const route = readFileSync("app/api/copilot/stream/route.ts", "utf8");

test("Phase 4.3 production activation is not enabled by a code deploy", () => {
  assert.deepEqual(productionCopilotReadiness({}), { ready: false, reason: "feature_off" });
  assert.match(route, /copilotActivationReadiness\(\)/);
  assert.match(route, /prepareCopilotPricing\(instructions, input\)/);
  assert.match(route, /await ledger\.reserve\(/);
  assert.match(route, /await billing\.complete\(/);
  assert.match(route, /await billing\.unknown\(/);
  assert.equal(copilotActivationReadiness({ VERCEL_ENV: "production",
    AVEROMIRA_COPILOT_ENABLED: "true" }).ready, false);
});

test("Production ledger SQL is manual-only and does not enable budgets, projects or AI model", () => {
  assert.match(sql, /COPILOT_PRODUCTION_CHANGE_NOT_APPROVED/);
  assert.match(sql, /current_setting\('averomira\.copilot_phase43_reviewed'/);
  assert.match(sql, /'copilot_ai'/);
  assert.match(sql, /get diagnostics changed = row_count/);
  assert.match(sql, /changed<>1/);
  assert.match(sql, /p_actual<=reserved_micro_usd/);
  assert.match(sql, /p_type=any\(l.enabled_types\)/);
  assert.match(sql, /begin;[\s\S]*commit;\s*$/);
  assert.doesNotMatch(sql, /update private\.operation_limits set/);
  assert.doesNotMatch(sql, /ALTER DATABASE/);
  assert.doesNotMatch(sql, /INSERT INTO public\.organization_members/i);
  assert.match(docs, /NO-GO/);
  assert.match(docs, /fallback.*NOT proof/);
});
