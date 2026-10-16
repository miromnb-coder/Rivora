import { randomUUID } from "node:crypto";
import { operationPricing, usageMicroUsd, type Pricing } from "./operations/usage.ts";

export const COPILOT_LEDGER_TYPE = "copilot_ai";
const PRODUCTION_VERCEL_PROJECT = "prj_69utcxbvaCPDSle5W3zptTa946rv";
const PRODUCTION_SUPABASE_REF = "utvxopmdxqnxqgaxugxm";
const REF = /^[a-z0-9]{20}$/;

/**
 * Phase 4.2 deliberately supports only a different Vercel Preview project,
 * with a different, explicitly pinned Supabase test project. A future
 * production release needs a separately reviewed change to this policy.
 */
export function isolatedCopilotReadiness(env: Record<string, string | undefined> = process.env) {
  if (env.AVEROMIRA_COPILOT_ENABLED !== "true")
    return { ready: false, reason: "feature_off" } as const;
  if (env.VERCEL_ENV !== "preview" ||
      !env.VERCEL_PROJECT_ID ||
      env.VERCEL_PROJECT_ID === PRODUCTION_VERCEL_PROJECT)
    return { ready: false, reason: "isolation_required" } as const;
  if (env.AVEROMIRA_COPILOT_ISOLATED_PREVIEW !== "true" ||
      env.AVEROMIRA_COPILOT_LEDGER_ENABLED !== "true")
    return { ready: false, reason: "approval_required" } as const;
  const expected = env.AVEROMIRA_COPILOT_TEST_DB_REF?.trim() ?? "";
  let actual = "";
  try {
    const url = new URL(env.NEXT_PUBLIC_SUPABASE_URL ?? "");
    if (url.protocol === "https:" && url.hostname.endsWith(".supabase.co"))
      actual = url.hostname.slice(0, -".supabase.co".length);
  } catch { /* Invalid or missing URL fails closed. */ }
  if (!REF.test(expected) || expected === PRODUCTION_SUPABASE_REF ||
      actual !== expected)
    return { ready: false, reason: "database_isolation_required" } as const;
  if (!env.OPENAI_API_KEY?.trim() || !(
      env.SUPABASE_SECRET_KEY?.trim() || env.SUPABASE_SERVICE_ROLE_KEY?.trim()))
    return { ready: false, reason: "credentials_missing" } as const;
  return { ready: true, reason: "ready" } as const;
}

/**
 * Production is a separate opt-in release, NOT an extension of preview.
 * Flags record operator approval, but do not themselves prove that backups,
 * live database integrity, billing RPCs, or rollback were independently checked.
 * No production environment has these flags configured in Phase 4.3.
 */
export function productionCopilotReadiness(env: Record<string, string | undefined> = process.env) {
  if (env.AVEROMIRA_COPILOT_ENABLED !== "true")
    return { ready: false, reason: "feature_off" } as const;
  if (env.VERCEL_ENV !== "production" ||
      env.VERCEL_PROJECT_ID !== PRODUCTION_VERCEL_PROJECT)
    return { ready: false, reason: "production_project_required" } as const;
  if (env.AVEROMIRA_COPILOT_PRODUCTION_APPROVED !== "true" ||
      env.AVEROMIRA_COPILOT_PRODUCTION_BACKUP_VERIFIED !== "true" ||
      env.AVEROMIRA_COPILOT_PRODUCTION_ROLLBACK_VERIFIED !== "true" ||
      env.AVEROMIRA_COPILOT_LEDGER_ENABLED !== "true")
    return { ready: false, reason: "production_approval_required" } as const;
  // A matching project URL is necessary, but not sufficient, to confirm
  // production DB linkage. The preflight SQL checklist remains mandatory.
  const expected = env.AVEROMIRA_COPILOT_PRODUCTION_DB_REF?.trim();
  let actual = "";
  try {
    const url = new URL(env.NEXT_PUBLIC_SUPABASE_URL ?? "");
    if (url.protocol === "https:" &&
        url.hostname.endsWith(".supabase.co") &&
        !url.username && !url.password && !url.port)
      actual = url.hostname.slice(0, -".supabase.co".length);
  } catch { /* Invalid or missing Supabase address fails closed. */ }
  if (expected !== PRODUCTION_SUPABASE_REF || actual !== expected)
    return { ready: false, reason: "production_database_required" } as const;
  if (!env.OPENAI_API_KEY?.trim() || !(
      env.SUPABASE_SECRET_KEY?.trim() || env.SUPABASE_SERVICE_ROLE_KEY?.trim()))
    return { ready: false, reason: "credentials_missing" } as const;
  return { ready: true, reason: "ready" } as const;
}

/** Preview and production can never accidentally share an approval path. */
export function copilotActivationReadiness(env: Record<string, string | undefined> = process.env) {
  if (env.VERCEL_ENV === "production") return productionCopilotReadiness(env);
  return isolatedCopilotReadiness(env);
}

export function prepareCopilotPricing(
  instructions: string, input: string,
  env: Record<string, string | undefined> = process.env,
) {
  const pricing = operationPricing(COPILOT_LEDGER_TYPE, env);
  const model = env.OPENAI_COPILOT_MODEL?.trim();
  if (!model || pricing.model !== model || pricing.inputUsdPerMillion <= 0 ||
      pricing.outputUsdPerMillion <= 0)
    throw new Error("Copilot pricing/model mismatch.");
  const maxOutputTokens = Math.min(700, pricing.maxOutputTokens);
  // One token cannot represent fewer than one UTF-8 byte; add generous
  // overhead for provider framing before reserving the worst-case charge.
  const maximumInputTokens = Buffer.byteLength(instructions + "\n" + input, "utf8") + 4096;
  const maximumMicroUsd = Math.ceil(
    maximumInputTokens * pricing.inputUsdPerMillion +
    maxOutputTokens * pricing.outputUsdPerMillion,
  );
  if (!Number.isSafeInteger(maximumMicroUsd) || maximumMicroUsd <= 0 ||
      pricing.reservationMicroUsd < maximumMicroUsd)
    throw new Error("Copilot reservation does not cover worst-case usage.");
  return { pricing, model, maxOutputTokens, maximumInputTokens, maximumMicroUsd };
}

export type CopilotFinalUsage = {
  input_tokens?: number | null;
  output_tokens?: number | null;
} | null;

export function verifyCopilotUsage(usage: CopilotFinalUsage, pricing: Pricing,
  limits: { maximumInputTokens: number; maxOutputTokens: number; maximumMicroUsd: number }) {
  if (!usage || !Number.isSafeInteger(usage.input_tokens) ||
      !Number.isSafeInteger(usage.output_tokens) ||
      (usage.input_tokens ?? -1) < 0 || (usage.output_tokens ?? -1) < 0 ||
      (usage.input_tokens ?? Infinity) > limits.maximumInputTokens ||
      (usage.output_tokens ?? Infinity) > limits.maxOutputTokens)
    throw new Error("Copilot provider usage is missing or outside reserved bounds.");
  const micro = usageMicroUsd({
    input_tokens: usage.input_tokens!,
    output_tokens: usage.output_tokens!,
  }, pricing);
  if (micro > pricing.reservationMicroUsd || micro > limits.maximumMicroUsd)
    throw new Error("Copilot provider charge exceeded reservation bounds.");
  return { micro, inputTokens: usage.input_tokens!, outputTokens: usage.output_tokens! };
}

export type CopilotLedger = {
  reserve(args: { organizationId: string; actorId: string; model: string;
    pricingVersion: string; reservedMicroUsd: number }): Promise<string>;
  settle(args: { reservationId: string; microUsd: number | null;
    inputTokens: number | null; outputTokens: number | null;
    responseId: string | null; unknown: boolean }): Promise<void>;
};

export function copilotLedger(): CopilotLedger {
  return {
    async reserve(args) {
      const { createAdminClient } = await import("@/lib/supabase/admin");
      const db = createAdminClient();
      const { data, error } = await db.rpc("reserve_ai_usage_server", {
        p_org: args.organizationId, p_actor: args.actorId,
        p_type: COPILOT_LEDGER_TYPE, p_key: randomUUID(),
        p_model: args.model, p_pricing: args.pricingVersion,
        p_micro: args.reservedMicroUsd,
      });
      if (error || typeof data !== "string" || !data)
        throw new Error("Copilot AI reservation unavailable or budget exhausted.");
      return data;
    },
    async settle(args) {
      const { createAdminClient } = await import("@/lib/supabase/admin");
      const db = createAdminClient();
      const { error } = await db.rpc("settle_ai_usage_server", {
        p_id: args.reservationId, p_actual: args.microUsd,
        p_input: args.inputTokens, p_output: args.outputTokens,
        p_response: args.responseId, p_unknown: args.unknown,
      });
      if (error) throw new Error("Copilot AI settlement unavailable.");
    },
  };
}

/**
 * Tracks a single reserved request. Every incomplete, cancelled, or unverified
 * response retains its conservative full reservation as billed_unknown.
 */
export function copilotReservation(ledger: CopilotLedger, reservationId: string,
  pricing: Pricing, limits: { maximumInputTokens: number; maxOutputTokens: number; maximumMicroUsd: number }) {
  let finished = false;
  return {
    async complete(usage: CopilotFinalUsage, responseId: string | null) {
      if (finished) throw new Error("Copilot reservation already finalized.");
      const verified = verifyCopilotUsage(usage, pricing, limits);
      await ledger.settle({
        reservationId, microUsd: verified.micro, inputTokens: verified.inputTokens,
        outputTokens: verified.outputTokens, responseId, unknown: false,
      });
      finished = true;
    },
    async unknown() {
      if (finished) return;
      // No fabricated zero-token settlement and no best-effort release.
      await ledger.settle({
        reservationId, microUsd: null, inputTokens: null,
        outputTokens: null, responseId: null, unknown: true,
      });
      finished = true;
    },
    get finalized() { return finished; },
  };
}
