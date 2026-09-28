# Nodra Pilot Launch Acceptance

Date: 2026-09-28

## 14. Preview / staging E2E — PASS WITH SAFE ENVIRONMENT LIMITATION

- Acceptance branch: `pilot-e2e-acceptance`
- Latest Preview deployment for the branch: READY
- Acceptance CI: PASS
- Preview runtime warning/error/fatal logs in the checked window: none
- Preview currently uses the same Supabase project as production.
- Therefore Preview write-path testing was intentionally not performed against separate staging data.
- No destructive or commercial-data mutation was performed merely to make Preview appear isolated.

Result: PASS for the agreed safe Preview acceptance scope.
Environment note: Preview is not a fully isolated staging environment yet.

## 15. Fresh-user Production E2E — PASS

A real Chromium production E2E was executed with a completely fresh approved pilot identity and isolated test workspace.

Verified end-to-end path:

1. fresh Supabase Auth user creation
2. Custom SMTP confirmation email delivered from `noreply@nodra.fi`
3. authentication
4. workspace onboarding
5. company settings saved
6. catalogue import
7. customer + primary contact creation
8. structured RFQ import
9. RFQ matching
10. human confirmation of all RFQ lines
11. Customer Memory creation
12. quote creation
13. recipient selection
14. customer PDF generation and validation
15. quote ready state
16. quote approval
17. quote email accepted by provider
18. Resend webhook delivery
19. first-run setup reached 4/4
20. customer history verified from production data:
    - 1 RFQ
    - 1 quote
    - 2 Customer Memory mappings

Production E2E evidence workspace:
- quote: `Q-2026-0597C3`
- RFQ reference: `RFQ-E2E-PRODUCTION`
- one delivery attempt

During acceptance, the E2E uncovered a real reconciliation edge case:
a delayed `email.sent` reconciliation could regress an already delivered quote/attempt back to `sent`.

This was fixed in production and added as a repository migration:
`20260928171500_keep_reconciled_email_delivery_monotonic.sql`

The production E2E quote was reconciled after the fix and now has:
- quote status: `sent`
- delivery status: `delivered`
- attempt status: `delivered`
- delivery timestamp from the real Resend `delivered` event

The SQL reliability suite was tightened to reproduce delayed `sent` processing after `delivered`; the suite passes.

Result: PASS.

## 16. Vercel + Supabase logs — PASS

### Vercel
- Production deployment: READY
- Acceptance Preview deployment: READY
- Production runtime warning/error/fatal logs in the latest checked window: none
- Preview runtime warning/error/fatal logs in the latest checked window: none

### Supabase
- Full `supabase/tests/pilot_reliability.sql` regression suite re-run against production inside BEGIN/ROLLBACK: PASS.
- Delivery reconciliation regression is covered and passes.
- Production E2E history and delivery consistency were verified directly from the database.
- Security Advisor currently reports one remaining warning:
  `Leaked Password Protection Disabled`.

That warning is an Auth hardening setting and is not a failure in the RFQ → quote → PDF → email pilot flow. It should still be enabled when the project plan/settings permit it.

Result: PASS for application/runtime/database reliability.

## 17. Pilot launch checklist

- [x] Production deployment READY
- [x] Preview acceptance deployment READY
- [x] Main/acceptance CI green
- [x] RLS tenant-isolation regression suite green
- [x] Catalogue integration regression suite green
- [x] RFQ extraction/matching regression suite green
- [x] Customer Memory regression suite green
- [x] Quote pricing/state/approval regression suite green
- [x] PDF golden regression green
- [x] Resend webhook regression green
- [x] Fresh Auth user production browser E2E completed end-to-end
- [x] Custom SMTP confirmation email delivered through `noreply@nodra.fi`
- [x] Catalogue + customer + RFQ + human review completed
- [x] Customer Memory created and verified
- [x] Quote created, PDF validated, approved and sent
- [x] Final delivered email confirmed by Resend webhook
- [x] First-run readiness reached 4/4
- [x] Customer RFQ / quote / memory history verified
- [x] Delivery reconciliation remains monotonic after delayed `sent` event
- [x] Email reconciliation invariants clean for the acceptance quote
- [x] No Vercel production runtime warning/error/fatal logs in checked window
- [x] No Vercel Preview runtime warning/error/fatal logs in checked window
- [x] Preview write-path intentionally avoided because it shares production Supabase
- [x] Production E2E workflow changed to explicit manual dispatch so repository edits do not create disposable production users automatically

Current pilot launch gate: GREEN for the agreed pilot scope.

Known non-blocking hardening item:
- Supabase Security Advisor: `Leaked Password Protection Disabled`
