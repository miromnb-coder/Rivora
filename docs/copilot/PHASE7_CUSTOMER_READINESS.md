# Phase 7 — Customer-beta readiness review

**Status: NOT_APPROVED**. This is a checklist, not permission to onboard or access customer records.

- Approve exact tenant account / membership and authorized pilot users privately.
- Collect effective terms, DPA and subprocessor / international-transfer review; validate AI vendor data retention and the privacy notice.
- Obtain informed workspace-context consent UX; test refusal and withdrawal.
- Confirm privacy-safe logging and an incident escalation contact.
- Approve tenant budget ceilings in the independent database ledger; never exceed approved global caps automatically.
- Complete Phase 5 (36), Phase 6 (56), Phase 7 (25) acceptance tests with zero critical failures, and document waivers for non-critical misses.
- Approve an explicit `AVEROMIRA_COPILOT_CUSTOMER_ORGANIZATION_IDS` allowlist of at most 10 UUIDs and **both** beta/release flags; production readiness guards continue to require verified backups/rollback.
- First verify one organization, then review actual trace-free aggregate usage and incident errors before any expansion.
- No default all-customer launch is coded. A general availability stage needs a separate release design and explicit approval.

**Operator responsibility:** set NO_GO if backup/restore, cross-tenant RLS, cost billing, vendor contracts or owner signoff is unknown.
