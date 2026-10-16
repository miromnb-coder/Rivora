# Averomira — Phase 4.3 Production AI Readiness (NO-GO pending approvals)

## Current verified facts (2026-10-16)

- Vercel project `rivora`: `prj_69utcxbvaCPDSle5W3zptTa946rv`, production domain `averomira.com`.
- The Vercel production project contains `OPENAI_API_KEY` and `SUPABASE_SECRET_KEY` keys. Their **values, validity, scopes and balances have NOT been verified** and must never be logged.
- The project currently does NOT define `AVEROMIRA_COPILOT_ENABLED`, `OPENAI_COPILOT_MODEL`, `AVEROMIRA_AI_PRICING_JSON`, or any of the newly proposed production release flags.
- `utvxopmdxqnxqgaxugxm` is the repository's **fallback** Supabase project reference, NOT proof of the actual live production DB. The existing P0 production DB linkage, migrations and backup/recovery need independent verification.
- `reserve_ai_usage_server` in the checked-in migrations rejects `copilot_ai`; production schema state was NOT inspected directly.
- PR created in Phase 4.3 does **not** enable real AI requests, apply SQL or merge to production.

## Implementation

`lib/rivora/copilot-live.ts` adds a **separate production gate** to the existing isolated Preview gate. `app/api/copilot/stream/route.ts` selects the gate based on Vercel environment:

**Production requires all of these** before a model call can be reached:

1. `VERCEL_ENV=production` and `VERCEL_PROJECT_ID` matches the exact designated Rivora production project.
2. `AVEROMIRA_COPILOT_ENABLED=true` and `AVEROMIRA_COPILOT_LEDGER_ENABLED=true`.
3. `AVEROMIRA_COPILOT_PRODUCTION_APPROVED=true`, `AVEROMIRA_COPILOT_PRODUCTION_BACKUP_VERIFIED=true` and `AVEROMIRA_COPILOT_PRODUCTION_ROLLBACK_VERIFIED=true`. These are operator assertions, **not proof**; collect actual signed-off evidence before setting them.
4. `AVEROMIRA_COPILOT_PRODUCTION_DB_REF` explicitly pins the audited production Supabase reference; the effective `NEXT_PUBLIC_SUPABASE_URL` must match an exact HTTPS Supabase project host. The current code uses the repository's fallback ref until the real live connection is verified.
5. OpenAI and Supabase server keys must exist. Separate pricing and pre-flight database reservation are still mandatory before calling OpenAI.

The normal Phase 4.2 isolated Preview policy remains unchanged. Preview approval never grants production approval. On any missing field the endpoint still returns `503` (model off).

## Direct read-only Supabase findings (2026-10-16)

Using the connected Supabase account, the `Rivora` project with ref `utvxopmdxqnxqgaxugxm` was confirmed to exist and be active. Its reported migration history ended at 2026-10-07 (58 entries); the 2026-10-11 Operations Foundation and AI ledger migrations were **not recorded as applied**.

A read-only SQL query on that project directly verified:

- `private.operation_limits` **absent**
- `private.ai_usage_ledger` **absent**
- `public.reserve_ai_usage_server` **absent**
- `public.settle_ai_usage_server` **absent**
- `private.integration_secrets` **exists, RLS disabled**, but direct `SELECT` privileges for both `anon` and `authenticated` were **false**. The general listing tool flagged RLS as critical; the specific privilege check narrows the immediate exposure assessment. Still review grants, policies, and security hardening before launch. Do not apply a blanket RLS fix without access-path review.
- Supabase security advisor reported **leaked password protection disabled** ([Supabase guidance](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection)).

The Vercel `NEXT_PUBLIC_SUPABASE_URL` value was not readable with the available permissions because it is stored as a sensitive variable. **An exact Vercel-to-Supabase production connection has therefore not been proven.** Independently confirm it before touching SQL.

These findings upgrade database readiness to a **verified NO-GO**, not merely a suspected gap. The release patch candidate **cannot be safely executed against the observed schema** because its foundation objects are missing. Do NOT apply the patch alone or deploy Operations Foundation migrations into production without a separate reviewed migration, backup/restore rehearsal, and explicit authorization.

Reproduce the read-only schema/privileges probe with `docs/copilot/PRODUCTION_PREFLIGHT_READONLY.sql`. It does not view any secret values or customer rows.

## Model and billing requirements

- Select the actual supported `OPENAI_COPILOT_MODEL`, verify current official API prices and agreed input/output accounting including any special token types. The model must match its entry in `AVEROMIRA_AI_PRICING_JSON`. **No model or USD amount has been guessed in code.**
- Configure reviewed positive per-million-token rates, `reservationMicroUsd` sufficient for the worst-case input + output, `maxOutputTokens` at most 700 and reviewed pricing version. This code is configured in **micro-USD**, not EUR.
- Explicitly set conservative global and chosen organization's `private.operation_limits` daily/monthly caps and `enabled_types` only **after** schema verification; default disabled is intentional.
- Review `docs/copilot/PRODUCTION_LEDGER_PATCH_CANDIDATE.sql` against the actual production DB function definition and all existing callers. It adds `copilot_ai` to reserve's allowlist and guards against silently successful zero-row settlements. **It was not executed**. Its compatibility change for other AI flows requires review.
- The patch deliberately does **not** add `copilot_ai` to any limits. Database operations should be done only after confirming correct project linkage, a recoverable backup and a tested rollback procedure. No direct SQL migrations are approved by this PR.
- Each request remains subject to a short-window + daily rate limit, up-front maximum ledger reservation, no provider retries, bounded output, and final verified token-based settlement. Interrupted/unknown results conservatively preserve reserved budget.

## Required independent verification before enabling anything

1. **Production DB mapping:** compare Vercel's effective production `NEXT_PUBLIC_SUPABASE_URL`, service-key project and Supabase dashboard project ID (do not copy secrets into GitHub). Verify actual database migrations and function signatures. The repository fallback is not evidence.
2. **Recovery:** verify Supabase project backups/PITR or documented snapshot/export; test restoration and state the recovery point/objective. Do not claim backups are enabled merely because the project exists.
3. **Tenant safety:** verify authenticated organization isolation, expected membership, no customer-facing enablement, and rate-limit table/RPC functionality in the intended DB.
4. **Spend control:** approve a small maximum daily/monthly micro-USD cap at both global and test organization scopes; verify reservation denial and `billed_unknown` retention under a synthetic/cancelled request. Ensure operator can see ambiguous/reserved entries.
5. **Real provider:** only after explicit user consent to incur charges, test a small harmless synthetic conversation with a production-isolated test user, verify streaming stage/delta/done, provider-reported token usage, DB ledger settlement, error/retry/abort and disabled behavior. No user/customer records in prompts. A real provider call was **not** made during Phase 4.3.
6. **Authenticated UI & rollback:** check mobile/tablet/desktop, Copilot vs AI Support, focus and request errors, and rehearse reversal by setting `AVEROMIRA_COPILOT_ENABLED=false` with redeployment. Check outstanding reservations before and after; unknown usage must never be silently written off.

## Approval conditions

**NO-GO** until every step above has evidence and the user separately authorizes both any production DB migration and live AI/model activation. Deploying code that merely adds this gate does not itself constitute the user's approval to activate it.

No new paid Vercel/Supabase project is mandatory for this plan, but that does not eliminate the need for a backup, verified production DB state, a private test tenant and controlled real-model spending.

The next phase, Context-Aware Copilot, remains out of scope: no orders, customer records, ERP actions or cross-organization lookups are exposed here.
