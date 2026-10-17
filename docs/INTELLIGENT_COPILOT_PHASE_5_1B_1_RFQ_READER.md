# Averomira — Phase 5.1B.1 RFQ Data Reader

Implementation scope: **read-only data layer**, not an AI feature activation.

- Starts from PR #121 merged into main. No mutations, Supabase migrations, extra services, AI model calls, product matching execution, Vercel flag changes, or production rollouts.
- `readAuthorizedRfqSnapshot()` verifies membership (including explicit org selection for multi-org users) and checks exact RFQ ID + org with the current user's JWT/RLS client before reading rows. `loadRfqSnapshot` is an internal data-layer primitive intended only for use after that authorization.
- Queries are explicitly scoped to both `organization_id` and `rfq_id`, and avoid `createAdminClient` and privileged Product Memory explainability RPC.
- Fetches header, two exact count queries, up to 51 RFQ rows (50 inspected), existence of any quote, and up to 31 matched candidates for at most 10 deterministically selected lines.
- Uses explicit `null` for unknown confidence/warnings; every failed/missing count/query throws a `ContextReadError` (fail closed).
- Preserves distinct match/extraction confidence and review status. No automatic confirmation is inferred. Uses separate `allLinesInspected`, `candidatesComplete`, `truncated` and exact `totalLines/unresolvedLines` semantics.
- Candidate completeness is conservative: when the 31st sentinel is encountered, all selected line candidate subsets are marked incomplete. At most three candidates per selected line are materialized.
- This PR returns a typed snapshot but **does not** add business data to the OpenAI prompt, alter Copilot SSE output, or claim readiness for live RFQ explanation. Phase 5.1B.2/5.1B.3 handle explanation and gated integration.

## Review/testing
- npm run typecheck && npm test && npm run build
- New mocked same-org/different-org, truncation, malicious text, failed count, failed candidates, aborted request tests.
- Existing Playwright Copilot regressions, isolated synthetic PostgreSQL RLS and CI checks.
- Keep the forthcoming RFQ intelligence flag default OFF. Approval required before merge; no production DB changes.
