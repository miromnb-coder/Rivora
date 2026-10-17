# Phase 5.1B.2 + 5.1B.3 — RFQ Explanations & Copilot Integration

Stacked on **PR #122** (RFQ Data Reader). Until #122 is merged, this PR's base is its feature branch. Never merge in reverse order.

- 5.1B.2 deterministically maps stored match methods and review statuses into a strictly read-only explanation. Confidence is not confirmation. Product Memory provenance, earlier approval dates or authors are not invented, and service-role RPC is not invoked.
- 5.1B.3 connects authorized RFQ snapshots through the existing Copilot stream path only when context, active-record and RFQ-intelligence feature flags are ALL true, the user has opted in, a server-verified active organization and RFQ exist, and the private-pilot gate succeeds.
- Keeps existing orders-overview query working and sends no RFQ business data when flags are OFF. Question classification is deterministic, no model-picked SQL/tools. Limited first-50 scan, first-10 explanations and at most three candidates; exact counts and truncation are included.
- New `AVEROMIRA_COPILOT_RFQ_INTELLIGENCE_ENABLED` defaults OFF; status endpoint only advertises RFQ for already-authorized pilot.
- RFQ source points to pre-existing `/app/orders/case/rfq/:id` link; no untrusted/line-specific URLs.
- Model input hard capped at 6000 chars for RFQ evidence, then checked against existing billing reservation before AI call. Stream source emission still only follows successful usage settlement. Errors fail closed.
- No database migrations, writes, new external services, production activation, or auto-merge.

## Check before merge
CI typecheck/test/build, synthetic PostgreSQL/RLS and Playwright; a READY preview for the exact final commit, and owner review. Keep production flag unset until separate activation approval.
