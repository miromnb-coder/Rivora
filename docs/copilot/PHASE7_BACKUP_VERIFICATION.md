# Phase 7.2 — Backup, isolated restore and rollback (human-run checklist)

**Release gate: NO-GO until observed proof is recorded.** This repository cannot create a real Supabase backup or test restoration through code-only tests. Never commit credentials, private dumps, customer rows, Storage files, or personal information.

## Operator inputs (secure dashboard / trusted machine only)
- Confirm effective Vercel production Supabase hostname and service secret match the intended project without printing secrets.
- Determine actual Supabase backup entitlements, manual export capability and retention; do not assume Free has PITR or built-in daily backups.
- Inspect both database **and Storage** inventory. A database dump is not a copy of Storage objects. Verify Auth and managed-schema coverage separately.
- Before changes, create protected off-site schema + role + data exports with integrity digests. Record exact timestamp, encrypted destination, successful exit code, and backup scope in a private evidence store.
- Restore into a **separate disposable environment** with no external email/webhook/ERP integrations active. Validate table counts, primary/foreign keys, auth flows with synthetic identities, cross-tenant RLS, memory usage history, AI reservation integrity, and Storage object readability.
- Measure actual **RTO/RPO**; the plan makes no SLA claim until measured.
- Preserve last verified snapshot until the new release has met the observation window and acceptance gates.

## Feature rollback
1. Stop expansion; disable `AVEROMIRA_COPILOT_PHASE7_RELEASE_APPROVED` and `AVEROMIRA_COPILOT_CUSTOMER_BETA_ENABLED` first if a wider beta was separately approved. Keep all new access denied. Existing pilot control can be turned OFF separately with `AVEROMIRA_COPILOT_ENABLED=false`.
2. Verify Vercel deployment's exact SHA and production aliases. Restore last independently verified READY deployment only with explicit owner permission.
3. Inspect unsettled / `billed_unknown` AI ledger reservations. Do **not** rewrite balances or set them to zero.
4. Check public health, authenticated status, signed-in tenant isolation, and spending limits. Record the incident timeline with request IDs, not customer text.
5. Database restore is an exceptional, separately authorized operation. Do not replace the production DB in response to an ordinary failed model call.

## Synthetic evidence vs real evidence
Automated PostgreSQL fixtures can validate the backup/restore **procedure**, but they cannot prove this tenant's backups are present, current, complete or recoverable. The manifest's `backupIntegrity`, `databaseRestore`, `storageRestore`, `rollbackRehearsal` gates therefore remain false until a qualified reviewer enters a documented observation.

Relevant original detailed runbook: `docs/copilot/PRODUCTION_DB_BACKUP_MIGRATION_RUNBOOK.md`.
