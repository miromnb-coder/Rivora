# AVEROMIRA — Phase 6 Advanced Copilot Intelligence

Status: **draft implementation, not approved for production**. All seven phases in one GitHub development branch and one draft PR.

## Architecture
- 6.0: Pure evidence types, source-allowlisted registry, typed bounded SSE contract.
- 6.1: Product Memory usage-event provenance through authenticated JWT/RLS reads. An event's point-in-time metadata is distinguished from mutable current mapping. Existing service-role-only explanation RPC is **not** invoked.
- 6.2: RFQ → quotes → purchase orders / sales drafts by explicit UUID foreign keys and same organization+customer validation. At most 3 quotes, 2 POs, 2 sales drafts, plus root RFQ; queries use sentinel counts.
- 6.3: Bounded deterministic facts, sourceIds and verification classifications. Unverified history and absent external ERP status must not be presented as known. Model performs no SQL or arbitrary tool calls.
- 6.4: Follow-up router is anchored to the currently authorized RFQ and most recent user turn. AI answers cannot choose targets.
- 6.5: Optional post-settlement source-linked evidence SSE, Minimal Linen typography, no HTML or user-provided links; only render after completed turn and verified sources.
- 6.6: Automated tests + a separate **56-case owner-run acceptance matrix** (`PHASE6_ACCEPTANCE_CASES.json`).

## Feature flags
Default OFF, independent of current pilot:
- `AVEROMIRA_COPILOT_PHASE6_ENABLED`
- `AVEROMIRA_COPILOT_MEMORY_EVIDENCE_ENABLED`
- `AVEROMIRA_COPILOT_MULTISOURCE_ENABLED`

No new paid infrastructure, production data mutation, automatic match approval, quote/email/ERP action, model-selected SQL, or open-ended agent loops. The existing per-request ($0.01), daily ($0.25) and monthly ($1) ledger caps must not increase.

## Production rollout: not authorized
1. Merge only with owner approval after all CI and Vercel Preview pass.
2. Phase 5's 36-case real-pilot acceptance must be checked separately; a merged PR does not prove it.
3. Verify scoped JWT+RLS two-tenant tests, backup/restore state, and actual billing caps; no backup claims without evidence.
4. Explicitly approve activating *only* owner/tenant pilot Phase6 flags. Redeploy same approved commit and check logs+ledger.
5. Complete 56 live acceptance cases, critical zero-violation gates, and at least 90% of remaining cases; owner signs off. Until then mark Phase 6 incomplete.

## Known limits / follow-up decisions
- Memory history can be missing or lack a point-in-time snapshot; never replace it with mutable current value.
- A line cannot be shown as physically compatible solely due to match-confidence.
- Product Memory explanation is a source-verified read, not technical suitability certification.
- Related records rely only on explicit FK relations. No customer-name/date fuzziness.
- No real-time ERP status, generalized historical search, multi-tool agent or automatic business action.
- Complex business comparisons beyond saved workflow statuses are **not** claimed supported.
- The current architecture deliberately stays in the single approved RFQ and selected organization.
