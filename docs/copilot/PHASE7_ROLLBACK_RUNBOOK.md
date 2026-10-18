# Phase 7 — Controlled Copilot rollback
**Prepared procedure; no actual production rollback drill is claimed.**

1. Verify owner incident authority and the active production alias/SHA. Keep a separate operator who can validate the result.
2. To isolate a **newly approved customer beta**, disable `AVEROMIRA_COPILOT_CUSTOMER_BETA_ENABLED` or `AVEROMIRA_COPILOT_PHASE7_RELEASE_APPROVED`; redeploy and verify the live configuration. Existing approved single-owner private pilot remains separately controlled.
3. If Copilot as a whole must stop, disable `AVEROMIRA_COPILOT_ENABLED` and confirm `/api/copilot/status` denies access; never assume an env edit takes effect before a successful deployment.
4. Monitor held reservations and `billed_unknown` usage; do not zero balances without reconciliation.
5. For a code regression, select last independently verified READY deployment in Vercel and explicitly approve rollback. Confirm aliases and exact SHA afterward.
6. Use `/api/health`, signed-in status, unauthorized users, RLS, RFQ read and cost ceilings as post-rollback probes. Do not use untrusted public requests to prove tenant isolation.
7. Database recovery is NOT a routine Copilot rollback. It needs a separate, explicit approval and successful isolated restore proof. Store all private recovery evidence outside the repository.

**Success criteria:** harmful feature inaccessible, old functional paths verified, no customer data changed, budget reservations safely reconciled, incident and root cause recorded.
