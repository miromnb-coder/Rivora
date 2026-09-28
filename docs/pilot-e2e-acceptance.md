# Nodra Pilot Launch Acceptance

Date: 2026-09-28

## 14. Preview / staging E2E — SAFE READ-ONLY PASS WITH ENVIRONMENT LIMITATION

- Acceptance branch: `pilot-e2e-acceptance`
- Latest Preview deployment for the branch: READY
- GitHub CI for the acceptance PR: PASS
- Preview runtime warnings/errors in the checked window: none
- Preview is intentionally not used for write-path testing because it shares the production Supabase project.
- No Preview test created or mutated users, workspaces, catalogue data, RFQs, quotes or email sends.

Result: PASS for the agreed safe read-only Preview acceptance scope.
Limitation: this is not a fully isolated staging environment.

## 15. Fresh-user Production E2E — BLOCKED AT AUTH BOOTSTRAP

A Chromium production E2E runner was added for:
onboarding → settings → catalogue → customer/contact → structured RFQ → matching → human confirmation → Customer Memory → quote → PDF → ready → approval → email → delivered → first-run 4/4 → history.

The run stops before workspace creation because Supabase Auth returns:
`429 over_email_send_rate_limit`

No E2E workspace or commercial data was created by the blocked attempts.

Important: the customer pilot flow itself uses the Nodra invite path (`generateLink(type: "invite")` + Resend), not ordinary public signup. The runner's bootstrap currently cannot create a completely new Auth user while the project-wide built-in email quota is exhausted.

Result: BLOCKED, not PASS.

## 16. Vercel + Supabase logs — PASS, with expected E2E Auth warnings

### Vercel
- Production deployment: READY
- Acceptance Preview deployment: READY
- Production runtime error/fatal/warning logs in checked 4h window: none
- Preview runtime error/fatal/warning logs in checked 4h window: none

### Supabase
- Full `supabase/tests/pilot_reliability.sql` regression suite re-run against production in BEGIN/ROLLBACK: PASS.
- Database integrity checks:
  - sent quotes without `sent_at`: 0
  - accepted/sent/delivered email attempts without provider id: 0
  - delivered attempts without reconciliation timestamp: 0
  - products without active flag: 0
  - ready RFQs with unconfirmed/missing selected product lines: 0
- Auth logs contain only the expected E2E bootstrap failures from the exhausted signup email quota.
- Security Advisor: one known warning, `Leaked Password Protection Disabled`.

Result: PASS for application/runtime/database reliability. Auth email quota is tracked as the remaining launch-test blocker.

## 17. Pilot launch checklist

- [x] Production deployment READY
- [x] Preview acceptance deployment READY
- [x] Main/PR CI green
- [x] RLS tenant-isolation regression suite green
- [x] Catalogue integration regression suite green
- [x] RFQ matching regression suite green
- [x] Customer Memory regression suite green
- [x] Quote pricing/state/approval regression suite green
- [x] PDF golden regression green
- [x] Resend webhook regression green
- [x] Email reconciliation invariants clean in production data
- [x] No ready RFQ with unconfirmed product lines
- [x] No Vercel production runtime warning/error/fatal logs in checked window
- [x] No Vercel Preview runtime warning/error/fatal logs in checked window
- [x] Preview write-path intentionally avoided because it shares production Supabase
- [ ] Fresh Auth user production browser E2E completes end-to-end
- [ ] Final delivered email confirmed from that fresh-user browser E2E

Current launch gate: NOT FULLY GREEN.

Remaining blocker: Supabase Auth project-wide built-in email send rate limit prevents creation of the completely fresh E2E Auth user. Do not bypass this with direct inserts into `auth.users`.
