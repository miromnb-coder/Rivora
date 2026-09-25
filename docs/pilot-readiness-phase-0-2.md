# Nodra Pilot Readiness — Phase 0–2

This document is the implementation record and verification matrix for the first pilot hardening pass.

## Phase 0 — Current-state audit

Critical workflow:

`workspace → catalogue → customer → RFQ → extraction → matching → human confirmation → quote → pricing → ready → approval → PDF → email → delivery event`

### Invariants

| Area | Required invariant |
| --- | --- |
| Tenant isolation | Every customer, product, RFQ, mapping, quote and delivery event must stay inside one organization. |
| Product resolution | AI/deterministic matching may suggest a product, but only a human confirmation may make an RFQ line quote-ready. |
| Pricing | A missing catalogue price is not the same as a zero price. Missing prices must be explicitly priced by a user. |
| Quote lifecycle | Only `draft → ready → approved → sent` plus controlled rollback/retry transitions are allowed. |
| Approved content | Approved/sent quote lines are immutable. |
| Catalogue import | An import must either commit as one validated unit or fail without a partial batch update. |
| RFQ recovery | A failure after RFQ creation must leave an explicit `failed` state and a recovery path. |
| Roles | Reviewers are read-only; members can process/review RFQs; catalogue and commercial approval remain owner/admin operations. |

### Phase 0 production facts verified before implementation

- Dedicated Supabase project: `Rivora`.
- RLS enabled on tenant tables.
- Cross-workspace preflight found zero existing relation violations.
- Latest production Vercel deployment was healthy before changes.
- Resend webhook already verifies Svix signature/timestamp and stores delivery events.
- Production had RFQ/extraction data but no quote or delivery-event history yet, so the commercial tail still needs a real golden-path pilot test.

## Phase 1 — Pilot blockers implemented

- Human confirmation gate for every RFQ line.
- Explicit `pricing_required` quote-line state.
- Commercial readiness checks before Ready/Approved.
- Database quote-state transition guard.
- Database lock on approved/sent quote-line mutation.
- Database tenant relation guard for critical cross-table references.
- RLS write-role tightening.
- Public workspace bootstrap changed from a public SECURITY DEFINER function to a SECURITY INVOKER wrapper around a private implementation.

### Password protection note

The current Supabase organization is on the Free plan. Supabase leaked-password protection is a Pro-plan feature, so it cannot be enabled in the current project without a plan change. This is tracked as an environment limitation rather than silently marked complete.

## Phase 2 — Reliability implemented

- Catalogue rows fail fast on invalid required fields.
- Catalogue imports use one database RPC transaction instead of multiple 500-row partial upserts.
- Duplicate SKUs are rejected.
- Missing catalogue prices are counted and carried safely into Quote Builder.
- Structured RFQ rows fail fast on missing/invalid quantity.
- RFQs created before a downstream processing failure are moved to `failed` and store a bounded `processing_error`.
- Failed RFQs with saved lines can retry matching without duplicate RFQ creation.
- AI extraction warnings/confidence remain visible, while every product suggestion still requires human confirmation.

## Required release verification

Before merging/deploying:

1. Preview build is READY.
2. Apply the matching production migration transactionally.
3. Re-run Supabase Security Advisor.
4. Verify `bootstrap_rivora_workspace` is no longer reported as a public SECURITY DEFINER function.
5. Run tenant-isolation SQL checks.
6. Run quote-state and missing-price negative tests.
7. Merge to main and confirm production deployment READY.
8. Scan Vercel runtime errors after deployment.
9. Run one real new-workspace golden path before inviting the pilot customer.
