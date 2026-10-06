# Averomira production runbook

This runbook is for production incidents and pre-release checks. Do not paste client secrets, access tokens, customer documents, or raw authentication headers into tickets or chat.

## Release gate

Before a broad production release:

1. GitHub CI must pass typecheck, tests, and build.
2. Vercel preview must be healthy before merge.
3. Production `/api/health` must return HTTP 200 with `{"status":"ok"}`.
4. Supabase security advisor must have no unresolved application-schema security findings.
5. The workspace Production status page must show no stale ERP attempts.
6. Microsoft Business Central workspaces must have a verified workspace-scoped ERP connection.
7. A manual Business Central write smoke is required after material ERP adapter changes. Create one Draft Sales Order only; never post, ship, or invoice as part of the smoke.
8. Confirm the active Supabase backup/PITR policy in the Supabase dashboard before broad sales and record the latest restore-drill date outside the application.

## ERP export incident

### Pending for more than 10 minutes

Treat the attempt as ambiguous.

- Do not click export again.
- Open the Sales Order Draft and note the ERP attempt ID, customer PO number, provider, and timestamp.
- Search the ERP using the customer + customer PO number.
- If an order exists, compare customer, item numbers, quantities, units, prices, and lines before taking any corrective action.
- If the external order exists but Averomira did not receive the response, do not create another order. Escalate for reconciliation.
- If no order exists, review the Vercel function logs and ERP API availability before deciding whether a retry is safe.

Business Central adapter behavior: every normal retry performs a duplicate lookup before creation. If the create response is ambiguous, Averomira re-checks the same customer + PO idempotency key and locks the result for review if it finds an order.

### Partial

A partial attempt means an ERP order/header may exist. Automatic retry is intentionally locked.

- Inspect the external order first.
- Repair or remove the draft order in ERP only under the customer's normal ERP process.
- Never use a blind retry to repair missing lines.

### Existing

`existing` means duplicate prevention found an order with the same customer + customer PO number. It is not a successful new export and it is not data loss. Compare the existing order and reconcile it.

## Email incident

For quote email failures:

- Check the quote's email attempt and provider status.
- Check Vercel runtime logs using the request/error reference.
- Check Resend delivery status.
- If a real signed Resend event was received but the application state is stale, use the existing webhook replay procedure rather than manually editing quote state.
- Do not resend repeatedly until the prior provider status is understood.

## Authentication incident

If account compromise is suspected:

- Disable or rotate the affected account/session using Supabase Auth administration.
- Rotate exposed server keys immediately if a server secret may have leaked.
- For Business Central, replace the workspace credential from ERP settings and verify the connection again.
- Never expose a stored client secret back to the browser.

Supabase leaked-password protection is an account-level setting and must be enabled from Supabase Auth settings before broad sales if the security advisor reports it disabled.

## Lead abuse

The public lead endpoint has server-side HMAC-keyed rate limits:

- per client address: 10 requests / 10 minutes
- per normalized email: 4 requests / hour

Only keyed hashes are stored in the rate-limit table. Raw client addresses are not persisted there. A 429 response includes `Retry-After`.

If abuse continues, lower the limits or add an edge/WAF control before weakening validation.

## Upload incident

Limits:

- uploaded CSV/XLSX/PDF: 10 MB
- catalogue: 25,000 rows
- RFQ: 1,000 rows
- purchase order: 2,000 rows
- generic tabular safety bound: 50,000 rows, 100 columns, 5,000 characters per cell

Do not increase these limits for a single customer without profiling memory/runtime behavior first.

## Application error reference

The app error boundary sends authenticated error events to `app_error_events`. API endpoints also emit a request correlation ID as `X-Request-Id`.

Use the request ID to correlate:

- Vercel runtime logs
- `app_error_events.metadata.requestId`
- webhook logs
- user-reported failures

Do not add secrets or full document payloads to structured operational logs.

## Database and migration incident

- Never edit production schema manually when a forward migration can express the change.
- Before a destructive migration, verify backup/PITR and test the migration on a branch or equivalent environment.
- On migration failure, stop application changes that depend on the new schema.
- Prefer a forward corrective migration over schema drift.
- After DDL changes, run Supabase security and performance advisors.

## Restore drill

A restore drill is an operational requirement and cannot be proven by application code alone.

At least before broad sales, and then periodically:

1. Verify the production backup/PITR policy.
2. Restore to an isolated recovery environment or supported recovery target.
3. Verify organizations, RFQs, quotes, purchase orders, Sales Order Drafts, ERP mappings/attempts, and email attempt history.
4. Verify private Storage objects can be retrieved according to the backup product's documented scope.
5. Record the drill date, recovery time, and any missing data classes.
6. Do not point production traffic to the drill environment.

## Credential rotation

Business Central:

1. Create/rotate the Microsoft client secret.
2. In Averomira, update the workspace ERP connection.
3. Run "verify connection".
4. Confirm company/environment.
5. Only after verification, revoke the previous Microsoft secret.

Resend/OpenAI/Supabase server secrets:

1. Add the replacement secret to production environment variables.
2. Deploy and verify health/functionality.
3. Revoke the old secret.
4. Never log either value.

## Production smoke levels

**Non-write smoke:** automatic GitHub workflow checks homepage, login, and `/api/health`.

**Application write smoke:** run the main RFQ → quote → approval/PDF/email → PO → Sales Order Draft flow in a controlled test workspace when material workflow changes ship.

**ERP write smoke:** only after material adapter changes; create one ERP Draft Sales Order and verify it end-to-end. Do not post, ship, or invoice it.
