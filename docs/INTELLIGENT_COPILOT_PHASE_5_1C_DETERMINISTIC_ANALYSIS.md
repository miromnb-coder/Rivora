# Phase 5.1C — Orders & RFQ Deterministic Analysis

**Delivery:** separate development branch, read-only rules engine. Feature remains disabled until the owner separately authorizes activation.

## Decisions
- This is an explanation/priority aid, NOT an auto-action engine. No ERP export, matches, RFQ confirmations, email, migrations or writes.
- Existing JWT/RLS organization boundaries and explicit workspace consent remain mandatory. Order priority reuses the exact four scoped order-case queries and the existing 200+sentinel cap.
- New production feature gate `AVEROMIRA_COPILOT_DETERMINISTIC_ANALYSIS_ENABLED` is **default OFF**. It does not alter active Phase 5.1B RFQ reading.
- RFQ analysis comes only from `explainRfq()` over authorized data: exact total/unresolved counts, up to ten selected lines, extracted-confidence threshold less than 60%, and candidate completeness. It does not label candidates confirmed.
- Orders are ranked **among currently retrieved cases**, not against the entire customer history. Scores use only stored workflow statuses. No imagined deadlines, revenue, business value or SLA urgency. When an unknown state is observed, skip instead of guessing.
- Prioritized findings carry existing verified source IDs; the model sees at most five compact rules-engine findings (maximum 1800 characters) alongside existing scoped source records.
- Historic completeness is never claimed: partial source scans or omitted findings mark the analysis as partial, while exact RFQ counts remain distinct from line-level samples.
- The next UX/stream phase may render these as structured cards after successful settlement. In 5.1C, the AI may explain rule-engine findings in its existing streaming answer and links.

## Review / release checks
- Unit tests on rules, ties, unknown states, partial cases, RFQ counters, low-confidence extraction, and candidate completeness.
- `npm run typecheck`, `npm test`, `npm run build`, isolated PostgreSQL and Playwright.
- No Vercel feature flag enabling and no production merge in this PR. Preview READY and explicit owner approval before merge.
- Pilot activation separately requires production READY, existing per-user/org whitelist, explicit opt-in, budget guards and the new feature flag. The work continues to be read-only.
