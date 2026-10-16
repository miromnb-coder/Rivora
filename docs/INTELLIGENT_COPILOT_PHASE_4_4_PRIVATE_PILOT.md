# Averomira — Phase 4.4 Private Copilot Pilot

**Goal:** make the existing production workspace ready for a controlled, real GPT-6 Luna test by exactly one approved authenticated account, without activating AI for all organizations.

**Current posture:** feature OFF. No real OpenAI API calls performed, no Vercel pilot flags enabled, no Supabase spending limits enabled. This phase creates the code gate, not a live AI launch.

## Why a separate pilot gate?

The regular production gate requires independently verified backups and rollback evidence. The owner previously explicitly authorized the small standalone Copilot ledger migration on Supabase Free without a backup; that decision does **not** prove that a backup exists and must not set `AVEROMIRA_COPILOT_PRODUCTION_BACKUP_VERIFIED=true`.

The new **pilot-only** gate demands a separate `AVEROMIRA_COPILOT_PILOT_NO_BACKUP_RISK_ACCEPTED=true` acknowledgment plus a unique approved actor+tenant pair. It never loosens the existing general production release gate. It does not permit reading business records or executing ERP actions.

## Production pilot: required server environment

These are set **only after** the effective production Vercel/Supabase URL and intended human test account have been independently verified and the user explicitly authorizes switching on billable calls:

- `AVEROMIRA_COPILOT_ENABLED=true`
- `AVEROMIRA_COPILOT_LEDGER_ENABLED=true`
- `AVEROMIRA_COPILOT_PILOT_ENABLED=true`
- `AVEROMIRA_COPILOT_PILOT_NO_BACKUP_RISK_ACCEPTED=true` (honest risk acknowledgment, **not** a fake backup verification)
- `AVEROMIRA_COPILOT_PILOT_ACTOR_ID=<verified authenticated Supabase user UUID>`
- `AVEROMIRA_COPILOT_PILOT_ORGANIZATION_ID=<verified workspace UUID>`
- `AVEROMIRA_COPILOT_PRODUCTION_DB_REF=utvxopmdxqnxqgaxugxm` **only if verified as the effective live project**
- `VERCEL_ENV=production` and `VERCEL_PROJECT_ID=prj_69utcxbvaCPDSle5W3zptTa946rv` (verify actually populated in runtime)
- `NEXT_PUBLIC_SUPABASE_URL` exact HTTPS host for the verified project
- existing protected `OPENAI_API_KEY` and `SUPABASE_SECRET_KEY` must be scoped to their expected services

Never expose user UUIDs, tokens, project secrets or credentials in frontend code. Pilot identity is checked against server-authenticated `claims.sub`, active workspace membership and an owner/admin role.

`GET /api/copilot/status` is authenticated, no-store, read-only and returns only two booleans. When the correct account is authorized, a small `AI-koekäyttö` label appears. Without activation the existing UI remains unchanged.

## Approved spend

OpenAI's published GPT-6 Luna Standard price (2026-10-16): **$0.10 / million input tokens** and **$0.50 / million output tokens**. Model: `gpt-6-luna`, Responses API, stream enabled, `reasoning.effort=none` for a short conversational pilot.

- `OPENAI_COPILOT_MODEL=gpt-6-luna` already configured in Vercel production.
- `AVEROMIRA_AI_PRICING_JSON` already set with reviewed model and prices; conservative `reservationMicroUsd=10000` (0.01 USD per request), `maxOutputTokens=700`.
- Connected Rivora Supabase global `private.copilot_ai_limits`: max request **10,000 micro-USD**, daily **250,000 micro-USD**, monthly **1,000,000 micro-USD**.
- Database global scope currently `enabled=false`; **no tenant scope is enabled**. Before the pilot, create and enable **only the verified test tenant scope** with caps not exceeding the global values, and explicitly enable the global scope at the very end.
- These are ledger-reservation ceilings; they are not a hard upstream OpenAI account-level billing block. Actual charged totals can differ if the provider reports ambiguous or out-of-band usage; conservative unknown reservations stay held.

The existing rate limiting permits at most 15 requests/10 minutes and 60/day per authenticated user/organization, with provider retries disabled.

## Before switching on actual model calls

1. Identify which **real authenticated Supabase user UUID** and which **single authorized tenant UUID** should be able to test; cross-check the `organization_members` role. Do not infer from a display name.
2. Verify Vercel's protected `NEXT_PUBLIC_SUPABASE_URL` **value inside the Vercel UI**, and validate the service secret belongs to that exact project. Current connector scope does not expose this sensitive value; no verified match was obtained.
3. Confirm the Vercel runtime makes its project ID available to the activation gate; otherwise it will intentionally fail closed.
4. Use read-only DB preflight to confirm standalone ledger RPCs and RLS; test the correct account's membership and check `enabled=false` now.
5. Verify approved limits and the `gpt-6-luna` model entitlement/billing status with the existing OpenAI API account (the API key's presence alone is not proof).
6. Obtain a separate authorization for **live billable model calls**. The previously approved **test budget** does not by itself order us to incur charges.
7. Activate only the actor+tenant pilot configuration and the corresponding two DB budgets; redeploy and verify the `/api/copilot/status` response for the approved authenticated user.
8. Ask a harmless question in Averomira (for example, “Miten käsittelen uuden tarjouspyynnön?”). Verify text streams in parts, the UI shows completed, and the ledger records exactly one settled usage. Test Stop, retry and off switch. Do not send confidential customer text during the first provider call.
9. If anything fails or the pilot must stop: set `AVEROMIRA_COPILOT_ENABLED=false`, redeploy, then disable the global+tenant ledger limits; inspect outstanding reserved or `billed_unknown` entries. Never erase held usage without reconciliation.

**All switches are currently OFF.** The ability to prepare/test this workflow is distinct from putting an AI feature into live production. Only an explicit user's go-ahead for the one-person pilot starts the chargeable step.

## Regression requirements

- Production-wide gate unchanged; no false `BACKUP_VERIFIED`.
- Pilot cannot be authorized by a different actor, role or organization.
- Server checks access before rate limiting, cost reservation and OpenAI calls.
- Preview remains isolated; production and preview approvals do not cross over.
- Zero cost by default: setting the model name/prices alone cannot invoke OpenAI.
- Existing streaming, cancellation, mobile composer, AI Support independence, product/RFQ/ERP nonaccess remain unchanged.

References: https://developers.openai.com/api/docs/models/gpt-6-luna and https://developers.openai.com/api/docs/pricing
