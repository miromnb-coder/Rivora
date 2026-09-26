# Nodra Pilot E2E checklist

Use this checklist before the first paid pilot and after material auth/onboarding changes.

## Public conversion
- [ ] Open the public homepage signed out.
- [ ] Header CTA scrolls to Nodra Pilot pricing/request form.
- [ ] Hero CTA scrolls to Nodra Pilot pricing/request form.
- [ ] Final CTA scrolls to Nodra Pilot pricing/request form.
- [ ] Submit a pilot request with a dedicated test email.
- [ ] Lead appears in the Leads view.

## Approval and invitation
- [ ] Open the lead as an owner/admin.
- [ ] Approve pilot access.
- [ ] Invitation status becomes sent with no invite_error.
- [ ] Invitation email arrives at the test mailbox.
- [ ] Invitation link points to https://www.nodra.fi/auth/confirm.
- [ ] Invitation link opens onboarding on www.nodra.fi.

## Account and workspace
- [ ] Onboarding pre-fills the company name.
- [ ] Set an 8+ character password and create the workspace.
- [ ] Workspace creation succeeds only for the invited email.
- [ ] Invitation is marked accepted.
- [ ] User lands in Nodra setup/inbox.
- [ ] Sign out and sign back in with the new password.

## Password recovery
- [ ] From Login, open Forgot password.
- [ ] Request a recovery link for the test account.
- [ ] Recovery email arrives without exposing account existence in the UI.
- [ ] Link points to https://www.nodra.fi/auth/confirm with type=recovery.
- [ ] Set a new password.
- [ ] Old password no longer signs in.
- [ ] New password signs in.

## First real workflow
- [ ] Complete company/workspace settings.
- [ ] Import a real or representative catalogue.
- [ ] Create/select a customer.
- [ ] Upload a representative PDF/XLSX/CSV RFQ.
- [ ] Extraction completes or shows a useful retry/error state.
- [ ] Product matches require human confirmation.
- [ ] Confirm all product selections.
- [ ] Add/verify prices.
- [ ] Build and approve the quote.
- [ ] Generate the PDF and verify company/customer/quote data.
- [ ] Send the quote to a controlled test recipient.
- [ ] Delivery tracking moves through sent/delivered or shows a clear failure state.

## Exit criteria
A pilot is ready to onboard a paying customer when every item above passes without database edits, manual auth fixes, or developer intervention.
