# Phase 4.2 — Intelligent Copilot Live Readiness

## Result and scope

This phase prepares the existing Copilot streaming endpoint for controlled **isolated live-model testing**. It does **not** activate Copilot, deploy to production, apply SQL, modify customer data, approve ERP actions, or merge PR #115.

### 1. Runtime activation policy (fail closed)

`lib/rivora/copilot-live.ts` rejects requests unless ALL of the following hold:

- `AVEROMIRA_COPILOT_ENABLED=true`
- `VERCEL_ENV=preview`; production and development environments are *not permitted* by this Phase 4.2 code.
- `VERCEL_PROJECT_ID` exists and is **different** from Averomira's verified production-associated project `prj_69utcxbvaCPDSle5W3zptTa946rv`.
- `AVEROMIRA_COPILOT_ISOLATED_PREVIEW=true` and `AVEROMIRA_COPILOT_LEDGER_ENABLED=true`, set deliberately after authorization.
- `NEXT_PUBLIC_SUPABASE_URL` is explicitly configured, points to an HTTPS `*.supabase.co` host, and matches `AVEROMIRA_COPILOT_TEST_DB_REF`. The ref must be different from the existing repository fallback reference `utvxopmdxqnxqgaxugxm`.
- Test DB service credentials and OpenAI API key are configured (never write them to documentation or logs).

These *configuration checks are guardrails*, not independent proof of complete network or database isolation. Before activation, verify a separate Vercel project, separate Supabase project, its backup/recovery status, org/test identity, and absence of production credentials. Current Rivora Preview on the existing Vercel project **cannot activate** this implementation. There is no implicit production transition.

### 2. Streaming AI cost accounting

The endpoint now reserves a reviewed maximum amount in the existing Supabase operations AI ledger **before the provider call**. It requires `AVEROMIRA_AI_PRICING_JSON` to have a reviewed `copilot_ai` entry:

`{ "copilot_ai": { "model": "<reviewed-model>", "version": "<pricing-revision>", "inputUsdPerMillion": <reviewed-number>, "outputUsdPerMillion": <reviewed-number>, "reservationMicroUsd": <reviewed-positive-integer>, "maxOutputTokens": <1-to-700> } }`

The model must match `OPENAI_COPILOT_MODEL`. Both rates must be positive. `reservationMicroUsd` must cover the conservative byte-length-based input bound (including overhead) and maximum output token cost; otherwise the request fails *before model invocation*. The ledger RPC also requires explicitly enabled global and tenant caps. No prices or caps have been invented or set.

On `response.completed`, token counts from the provider's final usage must be in bounds, and the reservation must settle successfully **before** the UI is told the response completed. Cancellation, timeout, provider failure, missing/inconsistent usage, streaming disconnect, or a failed settlement is conservatively treated as ambiguous: preserve the full reservation as `billed_unknown` where possible, otherwise leave the reservation held for an operator review. It is never silently zeroed or released. Only non-sensitive numeric metadata is logged.

The already existing SQL `reserve_ai_usage_server` does not accept `copilot_ai`. Its reviewed expansion is **prepared only** in `docs/copilot/ISOLATED_TEST_LEDGER_PATCH.sql`, *not* in `supabase/migrations`. This file has **not been executed** and must never be applied to production as part of this phase. A designated operator must review and apply it only to a verified, disposable isolated test database, then explicitly set the test DB's enabled types and budget caps. A separate production DB migration request, backup/restore evidence and authorization would be required in a later phase.

### 3. Verification evidence

- Unit tests assert isolation flags, production project rejection, default DB rejection, missing credentials, model/pricing mismatch, underfunded reservation, invalid provider usage, success settlement once and conservative unknown settlement.
- Existing Phase 4/4.1 tests continue guarding untrusted input, real SSE framing, cancellation, unsupported operations, support isolation and UI behavior.
- Synthetic Playwright projects now cover **390, 768, 1024, 1366, 1440 px**. Workflow uploads screenshots from the credential-free synthetic conversation fixture to a short-lived `copilot-visual-synthetic` artifact for review.
- Screenshots of this synthetic test fixture **do not constitute** visual sign-off for an authenticated Vercel Preview, nor do they prove a real OpenAI call.
- CI results must be confirmed from the **last PR head** before claiming automated completion.

### 4. Manual release checklist and GO / NO-GO

NO-GO until a separately verified Vercel Preview and Supabase test project are provisioned, read-only access and test tenant membership verified, cost limits approved, test-only ledger patch reviewed and applied, a synthetic-then-small-real-model test performed with an explicitly approved test key and budget, and authenticated Preview UI reviewed. Test normal responses, billing settlement, interrupted streams, privacy, Help Center coexistence, desktop/tablet/mobile input and focus. Ensure rollback consists of disabling the dedicated test project's feature flag and resolving any held/unknown reservations.

**The current Vercel project and production DB stay untouched. PR #115 remains Draft.** The later production launch requires a separately reviewed and authorized project/environment policy, operations readiness and production backup, rollback and cost controls. Do not reuse the isolated Preview approval as production consent.
