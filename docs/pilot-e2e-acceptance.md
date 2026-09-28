# Nodra Pilot E2E Acceptance

This branch is used for the final pilot acceptance pass.

## Preview safety
- Preview smoke tests are read-only while Preview points at the production Supabase project.
- No user, workspace, catalogue, RFQ, quote, or email data is created from Preview.
- Full write-path E2E is executed only in Production with a dedicated disposable test workspace.

## Acceptance flow
1. New user onboarding
2. Company settings
3. Catalogue import
4. Customer/contact
5. RFQ extraction and matching
6. Human review
7. Customer Memory
8. Quote pricing and approval
9. PDF
10. Quote email
11. Delivery reconciliation
12. History/audit
13. Vercel and Supabase log review
