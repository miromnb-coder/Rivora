# Averomira AI Support 2.0 — Phase S7/S8 (development draft)

This implementation extends the existing S5/S6 PR #106; **nothing has been merged into main**.

## S7: record evidence

- Only after a user enables **Use current page data**. The option is shown only if the server environment flag `AVEROMIRA_SUPPORT_RECORD_CONTEXT_ENABLED=true` has been deliberately activated.
- API has a matching server-side feature gate. Default is **disabled**.
- Routes: `/app/rfq/:uuid`, `/app/quotes/:uuid`, `/app/purchase-orders/:uuid`, `/app/sales-orders/:uuid`, the four `/app/orders/case/{rfq,quote,po,sales}/:uuid` variants, `/app/settings/business-central` and `/app`.
- The model is not given database access. Server selects one fixed allowlisted read-only summary function from validated URL path and authenticated workspace context. No model-generated SQL and no database writes.
- Read through the user-scoped Supabase client (RLS) with explicit `organization_id` filters on parent records; child lookups occur only after parent authorization. Mapping counts additionally require owner/admin role.
- Record evidence contains only status labels and bounded aggregate counts. No customer names, line texts, prices, documents, raw error messages, secrets, tokens or order references. 100-row maximum with a completeness indicator.
- On unavailable or unauthorized lookups the AI receives no verified record evidence. Generic approved article help remains available.
- An answer based on verified current-page data is labeled as such in the UI.

### Activation gates (not passed by code CI alone)

1. Confirm the **real** runtime Supabase project, RLS grants and tenant boundaries in a production-like isolated environment; exercise tenant A/B, role and direct URL access.
2. Verify that provider contractual data-processing restrictions allow these status/count summaries; no raw document contents are sent by the new tools.
3. Check production recovery path, model/token pricing and Phase 2A #105 coexistence.
4. Run protected authenticated Preview on mobile/desktop; verify real RFQ, PO, quote and ERP states with synthetic data.
5. Only with explicit deployment approval enable `AVEROMIRA_SUPPORT_RECORD_CONTEXT_ENABLED=true`, first in staging, then as a controlled canary.

## S8: human escalation and reliability

- Existing `support_tickets`, `support_messages`, ticket tracking, screenshot attachment and operator inbox are reused.
- A user may prepare a **draft** from the current-page AI thread; potentially credential-bearing messages are omitted. The draft is editable and is not sent until user submits the form. A request ID is included if syntactically valid.
- Provider call: at most 500 output tokens, 20-second request timeout, no automatic SDK retries.
- Current short/day rate limits remain in effect; on failure the user can still open Help articles and prepare a support request.
- Numeric usage telemetry is recorded without prompts, replies or document data. This is **not** a financial provider-budget reservation.
- PR #105 already contains a shared budget ledger and durable support-notification outbox. Do not duplicate or activate either before PR #105's independent rollout prerequisites are met. Reconcile concurrent edits to `app/api/support/ask/route.ts` and support notification code before merging. Production support notifications still follow the existing implementation until that separate rollout.

## Verification

- Run `npm run typecheck`, `npm test`, `npm run build`.
- S7 unit tests use synthetic multi-tenant data and confirm disallowed paths, parent-first authorization, redaction and mappings role restrictions.
- S8 unit tests check scope, credential omission, explicit review before sending, provider timeout and rate-limit inheritance.
- Static tests and Next.js build are **not** substitutes for authenticated RLS, real OpenAI integration and visual accessibility QA.

## Rollback

- Set `AVEROMIRA_SUPPORT_RECORD_CONTEXT_ENABLED=false` to immediately disable record reads independently of other support functionality.
- Revert the isolated S7/S8 application commit(s) if needed; no S7/S8 database migration or background worker is introduced.
- Keep the existing manual support workflow available. Do not retry previously sent customer email messages as part of this rollback.
