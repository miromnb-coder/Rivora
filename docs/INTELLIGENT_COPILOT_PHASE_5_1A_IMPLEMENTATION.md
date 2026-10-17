# Averomira — Phase 5.1A: Active Record Context

## Scope delivered
- A strict parser accepts known RFQ, quote, purchase-order and sales-order page paths; everything else has no active record hint.
- Client hints are validated by the protocol and revalidated on the server using the currently authenticated, RLS-scoped Supabase client and `organization_id`. Unknown and foreign records share a generic error.
- Workspace-identity mismatch between the rendered client and the server is rejected with HTTP 409 before any AI call.
- The Copilot component is keyed by server-provided workspace ID and current pathname: navigation unmounts it, aborts in-flight requests and resets conversation history + consent OFF.
- The `AVEROMIRA_COPILOT_ACTIVE_RECORD_ENABLED` feature flag is **default OFF**, and also requires the existing `AVEROMIRA_COPILOT_CONTEXT_ENABLED` flag plus explicit session-level `useWorkspaceData` consent.
- **No business details or record identifiers are added to model instructions/input.** Phase 5.1B will implement actual RFQ business-data analysis independently.
- No SQL migrations, service-role record reads, ERP operations, emails, paid infrastructure, Vercel changes, or production activation.

## Tests and review gates
- Run `npm run typecheck`, `npm test`, `npm run build`.
- Run synthetic SQL isolation checks using the existing Phase 5.0 two-tenant RLS fixture.
- Run the current Copilot Playwright checks for session reset/consent/stream handling, and review browser navigation between two record paths and workspaces.
- Verify a genuine Vercel Preview deployment after quota recovery; blocked preview is **not** a pass.
- Merge only with owner authorization; enable active-record context only after separate production activation approval.
- Disable `AVEROMIRA_COPILOT_ACTIVE_RECORD_ENABLED` and redeploy to roll back just this feature (subject to actual Vercel deployment availability).

## Follow-up
Phase 5.1B will add bounded RFQ line and candidate queries, deterministically verified citations, record-scoped explanations, and model input constraints. None are enabled in 5.1A.
