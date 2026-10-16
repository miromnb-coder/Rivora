import test from "node:test";
import assert from "node:assert/strict";
import {
  isolatedCopilotReadiness, productionCopilotReadiness, copilotActivationReadiness,
  privateCopilotPilotReadiness, copilotActorAuthorizedForEnvironment,
  prepareCopilotPricing, verifyCopilotUsage,
  copilotReservation, COPILOT_LEDGER_TYPE, type CopilotLedger,
} from "../lib/rivora/copilot-live.ts";

const TEST_REF = "abcdefghijklmnopqrst";
const fixtureEnv: Record<string, string> = {
  AVEROMIRA_COPILOT_ENABLED: "true",
  VERCEL_ENV: "preview",
  VERCEL_PROJECT_ID: "prj_isolated_test_fixture",
  AVEROMIRA_COPILOT_ISOLATED_PREVIEW: "true",
  AVEROMIRA_COPILOT_LEDGER_ENABLED: "true",
  AVEROMIRA_COPILOT_TEST_DB_REF: TEST_REF,
  NEXT_PUBLIC_SUPABASE_URL: "https://" + TEST_REF + ".supabase.co",
  OPENAI_API_KEY: "synthetic-not-a-provider-key",
  SUPABASE_SECRET_KEY: "synthetic-not-a-database-key",
  OPENAI_COPILOT_MODEL: "synthetic-model",
};
const pricing = {
  model: "synthetic-model", version: "synthetic-reviewed",
  inputUsdPerMillion: 1, outputUsdPerMillion: 2,
  reservationMicroUsd: 20000, maxOutputTokens: 700,
};
const pricedEnv = {
  ...fixtureEnv,
  AVEROMIRA_AI_PRICING_JSON: JSON.stringify({ [COPILOT_LEDGER_TYPE]: pricing }),
};

test("Averomira production project, default Supabase and missing flags always fail closed", () => {
  assert.equal(isolatedCopilotReadiness(fixtureEnv).ready, true);
  const overrides = [
    { AVEROMIRA_COPILOT_ENABLED: "false" },
    { VERCEL_ENV: "production" },
    { VERCEL_ENV: "development" },
    { VERCEL_PROJECT_ID: "prj_69utcxbvaCPDSle5W3zptTa946rv" },
    { VERCEL_PROJECT_ID: "" },
    { AVEROMIRA_COPILOT_ISOLATED_PREVIEW: "" },
    { AVEROMIRA_COPILOT_LEDGER_ENABLED: "" },
    { AVEROMIRA_COPILOT_TEST_DB_REF: "utvxopmdxqnxqgaxugxm" },
    { NEXT_PUBLIC_SUPABASE_URL: "https://utvxopmdxqnxqgaxugxm.supabase.co" },
    { NEXT_PUBLIC_SUPABASE_URL: "https://example.com" },
    { NEXT_PUBLIC_SUPABASE_URL: "" },
    { SUPABASE_SECRET_KEY: "", SUPABASE_SERVICE_ROLE_KEY: "" },
    { OPENAI_API_KEY: "" },
  ];
  for (const overridesItem of overrides) {
    const result = isolatedCopilotReadiness({ ...fixtureEnv, ...overridesItem });
    assert.equal(result.ready, false, JSON.stringify(overridesItem));
  }
});

test("Copilot cost bound fails closed on missing pricing, mismatch or insufficient reserve", () => {
  const cfg = prepareCopilotPricing("SYSTEM", "QUESTION", pricedEnv);
  assert.equal(cfg.maxOutputTokens, 700);
  assert.ok(cfg.maximumMicroUsd <= cfg.pricing.reservationMicroUsd);
  assert.throws(() => prepareCopilotPricing("SYSTEM", "QUESTION", fixtureEnv));
  assert.throws(() => prepareCopilotPricing("SYSTEM", "QUESTION", {
    ...pricedEnv, OPENAI_COPILOT_MODEL: "different-model",
  }), /mismatch/);
  assert.throws(() => prepareCopilotPricing("SYSTEM", "QUESTION", {
    ...pricedEnv,
    AVEROMIRA_AI_PRICING_JSON: JSON.stringify({ copilot_ai: { ...pricing, reservationMicroUsd: 1 } }),
  }), /worst-case/);
  assert.throws(() => prepareCopilotPricing("S".repeat(30000), "QUESTION", pricedEnv), /worst-case/);
});

test("Only validated final usage can settle below configured reservation", () => {
  const limits = prepareCopilotPricing("SYSTEM", "QUESTION", pricedEnv);
  const result = verifyCopilotUsage({ input_tokens: 30, output_tokens: 20 }, limits.pricing, limits);
  assert.equal(result.micro, 70);
  for (const bad of [
    null, {}, { input_tokens: -1, output_tokens: 2 },
    { input_tokens: NaN, output_tokens: 2 },
    { input_tokens: 30, output_tokens: limits.maxOutputTokens + 1 },
    { input_tokens: limits.maximumInputTokens + 1, output_tokens: 1 },
  ]) assert.throws(() => verifyCopilotUsage(bad, limits.pricing, limits));
});

test("Success settles exactly once, including real usage and response identifier", async () => {
  const calls: unknown[] = [];
  const ledger: CopilotLedger = {
    reserve: async () => "fixture-reservation",
    settle: async args => { calls.push(args); },
  };
  const limits = prepareCopilotPricing("SYSTEM", "QUESTION", pricedEnv);
  const reservation = copilotReservation(ledger, "fixture-reservation", limits.pricing, limits);
  await reservation.complete({ input_tokens: 30, output_tokens: 20 }, "fixture-response");
  await reservation.unknown();
  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0], {
    reservationId: "fixture-reservation", microUsd: 70,
    inputTokens: 30, outputTokens: 20,
    responseId: "fixture-response", unknown: false,
  });
  await assert.rejects(() => reservation.complete({ input_tokens: 1, output_tokens: 1 }, "new"));
});

test("Failure, cancellation, ambiguous usage conservatively keep full reservation", async () => {
  const calls: unknown[] = [];
  const ledger: CopilotLedger = {
    reserve: async () => "fixture-reservation",
    settle: async args => { calls.push(args); },
  };
  const limits = prepareCopilotPricing("SYSTEM", "QUESTION", pricedEnv);
  const reservation = copilotReservation(ledger, "fixture-reservation", limits.pricing, limits);
  await assert.rejects(() => reservation.complete(null, null));
  assert.equal(reservation.finalized, false);
  await reservation.unknown();
  await reservation.unknown();
  assert.deepEqual(calls, [{
    reservationId: "fixture-reservation", microUsd: null,
    inputTokens: null, outputTokens: null,
    responseId: null, unknown: true,
  }]);
});


const productionFixture: Record<string, string> = {
  ...fixtureEnv,
  VERCEL_ENV: "production",
  VERCEL_PROJECT_ID: "prj_69utcxbvaCPDSle5W3zptTa946rv",
  AVEROMIRA_COPILOT_PRODUCTION_APPROVED: "true",
  AVEROMIRA_COPILOT_PRODUCTION_BACKUP_VERIFIED: "true",
  AVEROMIRA_COPILOT_PRODUCTION_ROLLBACK_VERIFIED: "true",
  AVEROMIRA_COPILOT_LEDGER_ENABLED: "true",
  AVEROMIRA_COPILOT_PRODUCTION_DB_REF: "utvxopmdxqnxqgaxugxm",
  NEXT_PUBLIC_SUPABASE_URL: "https://utvxopmdxqnxqgaxugxm.supabase.co",
};

test("Production stays disabled by default and requires independent approvals", () => {
  assert.equal(productionCopilotReadiness({}).ready, false);
  assert.equal(copilotActivationReadiness({ VERCEL_ENV: "production" }).ready, false);
  assert.equal(productionCopilotReadiness(productionFixture).ready, true);
  for (const overrides of [
    { AVEROMIRA_COPILOT_ENABLED: "" },
    { VERCEL_ENV: "preview" },
    { VERCEL_PROJECT_ID: "prj_other" },
    { VERCEL_PROJECT_ID: "" },
    { AVEROMIRA_COPILOT_PRODUCTION_APPROVED: "" },
    { AVEROMIRA_COPILOT_PRODUCTION_BACKUP_VERIFIED: "" },
    { AVEROMIRA_COPILOT_PRODUCTION_ROLLBACK_VERIFIED: "" },
    { AVEROMIRA_COPILOT_LEDGER_ENABLED: "" },
    { AVEROMIRA_COPILOT_PRODUCTION_DB_REF: "" },
    { AVEROMIRA_COPILOT_PRODUCTION_DB_REF: "abcdefghijklmnopqrst" },
    { NEXT_PUBLIC_SUPABASE_URL: "https://abcdefghijklmnopqrst.supabase.co" },
    { NEXT_PUBLIC_SUPABASE_URL: "http://utvxopmdxqnxqgaxugxm.supabase.co" },
    { NEXT_PUBLIC_SUPABASE_URL: "https://utvxopmdxqnxqgaxugxm.supabase.co.evil.test" },
    { NEXT_PUBLIC_SUPABASE_URL: "https://user:pass@utvxopmdxqnxqgaxugxm.supabase.co" },
    { OPENAI_API_KEY: "" },
    { SUPABASE_SECRET_KEY: "", SUPABASE_SERVICE_ROLE_KEY: "" },
  ]) {
    const result = productionCopilotReadiness({ ...productionFixture, ...overrides });
    assert.equal(result.ready, false, JSON.stringify(overrides));
  }
});

test("Preview flags cannot activate production and production approvals cannot enable Preview", () => {
  const previewWithProductionFlags = {
    ...fixtureEnv,
    AVEROMIRA_COPILOT_PRODUCTION_APPROVED: "true",
    AVEROMIRA_COPILOT_PRODUCTION_BACKUP_VERIFIED: "true",
    AVEROMIRA_COPILOT_PRODUCTION_ROLLBACK_VERIFIED: "true",
    AVEROMIRA_COPILOT_PRODUCTION_DB_REF: "utvxopmdxqnxqgaxugxm",
  };
  assert.equal(copilotActivationReadiness(previewWithProductionFlags).ready, true);
  assert.equal(copilotActivationReadiness({
    ...previewWithProductionFlags,
    AVEROMIRA_COPILOT_ISOLATED_PREVIEW: "",
  }).ready, false);
  assert.equal(copilotActivationReadiness({
    ...productionFixture,
    AVEROMIRA_COPILOT_ISOLATED_PREVIEW: "true",
    AVEROMIRA_COPILOT_PRODUCTION_APPROVED: "",
  }).ready, false);
  assert.equal(copilotActivationReadiness({
    ...productionFixture,
    VERCEL_ENV: "development",
  }).ready, false);
});

const PILOT_ACTOR_ID = "11111111-2222-4333-8444-555555555555";
const PILOT_ORG_ID = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";
const pilotFixture: Record<string, string> = {
  ...productionFixture,
  AVEROMIRA_COPILOT_PILOT_ENABLED: "true",
  AVEROMIRA_COPILOT_PILOT_NO_BACKUP_RISK_ACCEPTED: "true",
  AVEROMIRA_COPILOT_PILOT_ACTOR_ID: PILOT_ACTOR_ID,
  AVEROMIRA_COPILOT_PILOT_ORGANIZATION_ID: PILOT_ORG_ID,
};

test("Private production pilot is independently fail-closed and does not impersonate backup verification", () => {
  assert.deepEqual(privateCopilotPilotReadiness({}), {ready: false, reason: "feature_off"});
  assert.equal(privateCopilotPilotReadiness({
    ...pilotFixture,
    AVEROMIRA_COPILOT_PRODUCTION_BACKUP_VERIFIED: "",
    AVEROMIRA_COPILOT_PRODUCTION_ROLLBACK_VERIFIED: "",
    AVEROMIRA_COPILOT_PRODUCTION_APPROVED: "",
  }).ready, true);
  assert.equal(copilotActivationReadiness({
    ...pilotFixture,
    AVEROMIRA_COPILOT_PRODUCTION_BACKUP_VERIFIED: "",
  }).ready, true);

  for (const overrides of [
    { AVEROMIRA_COPILOT_ENABLED: "false" },
    { AVEROMIRA_COPILOT_PILOT_ENABLED: "" },
    { AVEROMIRA_COPILOT_LEDGER_ENABLED: "false" },
    { AVEROMIRA_COPILOT_PILOT_NO_BACKUP_RISK_ACCEPTED: "" },
    { VERCEL_ENV: "preview" },
    { VERCEL_PROJECT_ID: "prj_something_else" },
    { AVEROMIRA_COPILOT_PILOT_ACTOR_ID: "" },
    { AVEROMIRA_COPILOT_PILOT_ACTOR_ID: "someone@example.com" },
    { AVEROMIRA_COPILOT_PILOT_ACTOR_ID: "00000000-0000-0000-0000-000000000000" },
    { AVEROMIRA_COPILOT_PILOT_ORGANIZATION_ID: "" },
    { AVEROMIRA_COPILOT_PILOT_ORGANIZATION_ID: "not-an-org" },
    { NEXT_PUBLIC_SUPABASE_URL: "https://example.org" },
    { NEXT_PUBLIC_SUPABASE_URL: "https://utvxopmdxqnxqgaxugxm.supabase.co/another-path" },
    { AVEROMIRA_COPILOT_PRODUCTION_DB_REF: "" },
    { OPENAI_API_KEY: "" },
    { SUPABASE_SECRET_KEY: "", SUPABASE_SERVICE_ROLE_KEY: "" },
  ]) {
    assert.equal(privateCopilotPilotReadiness({ ...pilotFixture, ...overrides }).ready,
      false, JSON.stringify(overrides));
  }
});

test("Only the pinned pilot actor and tenant owner/admin can call the model", () => {
  assert.equal(copilotActorAuthorizedForEnvironment(PILOT_ACTOR_ID, PILOT_ORG_ID, "owner", pilotFixture), true);
  assert.equal(copilotActorAuthorizedForEnvironment(PILOT_ACTOR_ID, PILOT_ORG_ID, "admin", pilotFixture), true);
  for (const [actor, org, role] of [
    [PILOT_ACTOR_ID, PILOT_ORG_ID, "member"],
    [PILOT_ACTOR_ID, PILOT_ORG_ID, "viewer"],
    [PILOT_ACTOR_ID, "11111111-aaaa-4aaa-8aaa-111111111111", "owner"],
    ["11111111-2222-4333-8444-999999999999", PILOT_ORG_ID, "owner"],
  ]) {
    assert.equal(copilotActorAuthorizedForEnvironment(actor, org, role, pilotFixture), false);
  }
  const disabled = {...pilotFixture, AVEROMIRA_COPILOT_PILOT_ENABLED: "false"};
  assert.equal(copilotActorAuthorizedForEnvironment("any","any","viewer",disabled), true);
  // A production-wide release is separately gated and does not inherit pilot approval.
  assert.equal(copilotActivationReadiness({
    ...pilotFixture, AVEROMIRA_COPILOT_PILOT_ENABLED: "false",
    AVEROMIRA_COPILOT_PRODUCTION_BACKUP_VERIFIED: "",
  }).ready,false);
});
