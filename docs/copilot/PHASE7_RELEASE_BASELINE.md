# Averomira Phase 7 — Release decision and operator preflight

**Status: NOT APPROVED.** This document defines a policy and cannot confirm backups, restored data, legal review, real pilot tests or deployment status.

The release uses 13 independent evidence gates and 36 Phase 5 + 56 Phase 6 + >=25 Phase 7 acceptance cases. A CI build is not a sign-off.

Run the *read-only* checker using a private, reviewed manifest:
`node --experimental-strip-types scripts/copilot-release-preflight.mjs path/to/private-manifest.json`

Do not commit a completed manifest, customer records, raw SQL exports, credentials or approval-signature images to the repository. A report containing missing gate names is safe; evidence references must be retained privately by the responsible reviewer.

A valid manifest requires the exact target SHA and deployed SHA to match, a real deployment id, dated reviewer-attributed evidence for every mandatory gate, critical failures = 0, and >=90% passing relevant acceptance cases.

Default empty manifest is NO_GO. **Never set backupVerified, rollbackVerified or releaseApproved to true because a migration, code build or CI run succeeded.**

Production audience remains the single-person pilot unless a separate full production gate is actually approved. The new customer beta additionally requires an explicit small organization allowlist and independent Phase 7 release + customer-beta flags. No feature flags are changed by this branch.

Rollout check order: baseline SHA -> verified Vercel aliases -> exact Supabase production DB -> encrypted logical + Storage snapshots -> successful isolated restore -> rollback drill -> RLS & billing checks -> user pilot 36 + 56 + 25 -> privacy and contractual signoff -> owner GO -> one beta organization approval -> monitor -> expansion review.

Stop condition: any missing proof, untrusted status, cost anomaly, security failure or unclear tenant boundary = NO_GO.
