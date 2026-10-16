# Phase 4.3 — Production DB linkage, backup and migration runbook

**Status: NO-GO / documentation and read-only evidence only.** This runbook is not approval to deploy, apply a migration, export customer records into GitHub, switch on AI, or pay for any Supabase add-on.

## A. Evidence gathered (2026-10-16)

| Evidence | Read-only finding |
| --- | --- |
| Supabase project | `Rivora`, ref `utvxopmdxqnxqgaxugxm`, active/healthy, `eu-west-1`, PostgreSQL 17.6 |
| Organization subscription | `Liiketoiminta` uses Supabase **Free** |
| Database size | approximately **18 MB** (database only, not Storage objects) |
| Applied migration history | 58 entries; last reported version `20261007053707` |
| Operations owner role | `averomira_operations_owner` **missing** |
| Operations limits and ledger | `private.operation_limits`, `private.ai_usage_ledger` **missing** |
| AI ledger functions | Both `reserve_ai_usage_server` and `settle_ai_usage_server` **missing** |
| General prerequisites | `private` schema and `organizations`/`organization_members` tables exist |
| Vercel environment | Project ID `prj_69utcxbvaCPDSle5W3zptTa946rv`; `NEXT_PUBLIC_SUPABASE_URL` is a **sensitive** variable shared by production and Preview; its actual value was not returned, even with decryption requested |
| Recovery | Supabase's Free plan has **no automatic daily database backups or PITR**. No recent manual dump, integrity check, or successful restore rehearsal has been provided or verified |

A Supabase project with the same ref as a repository fallback is **not proof** that Vercel's effective production server requests are reaching it. Until the value is independently compared with the Vercel production environment, the link is **unverified**. Do not infer connection by app appearance, project name or migration history.

Security observations: `private.integration_secrets` RLS is off, but the checked direct `anon` and `authenticated` table `SELECT` grants were both false. Supabase's Auth leaked-password protection security advisor is also active. Audit these separately; changing RLS without reviewing application access paths can break existing functionality.

## B. Verify the *effective* production connection (human/authorized environment check)

1. In the production Vercel project, verify the actual `NEXT_PUBLIC_SUPABASE_URL` **only in its protected configuration UI**. Check that its HTTPS hostname is exactly `utvxopmdxqnxqgaxugxm.supabase.co` and that it targets **Production**, not only Preview. The value is not to be copied into chat, tickets or logs. Verify that the server-side Supabase key is issued for the **same** project; do not reveal the key.
2. In the Supabase dashboard, confirm the project ref and region, current URL, target database and the applied migrations. Run `docs/copilot/PRODUCTION_PREFLIGHT_READONLY.sql`, which reads metadata only.
3. Check whether the deployed **production** Vercel commit corresponds to the planned code, and explicitly establish which organization/test identity will be used. No anonymous/debug endpoint exposing environment variables.
4. Record only `match=yes/no`, time, person who verified, project ref and evidence location. Do not record database credentials.

**Decision:** any mismatch or missing access => **NO-GO**. A completed config comparison still does not authorize database writes or AI billing.

## C. Free-plan backup and restore gate (before any migration)

Supabase's current docs confirm that *automatic daily backups* are for Pro/Team/Enterprise, and Free projects should create and keep their own off-site logical exports: https://supabase.com/docs/guides/platform/backups

The documented official CLI flow is https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore. Run it from a **trusted machine you control** (or a trusted, explicitly approved operator environment) with compatible PostgreSQL tools and a database connection string obtained through Supabase's protected dashboard. **Never provide the string, password or dump to ChatGPT, GitHub, Vercel logs or public storage.**

Prepare three separate exports: roles, application schemas, and data. Official command shapes, with the connection URL provided through a private shell variable (not pasted into the terminal history), are:

```bash
supabase db dump --db-url "$SOURCE_DB_URL" -f roles.sql --role-only
supabase db dump --db-url "$SOURCE_DB_URL" -f schema.sql
supabase db dump --db-url "$SOURCE_DB_URL" -f data.sql --use-copy --data-only
```

**Important limits:** By default Supabase CLI excludes certain managed schemas such as `auth` and `storage`; the official restore guide describes how to handle auth/storage differences, migration history, extensions, roles and other special cases. A database dump does **not** capture the actual files stored in Supabase Storage. Prepare a *separate, access-controlled Storage object export* and verify it. Include any app-specific migration-history records and custom schema changes in the restore plan.

A checkable backup requires: exact snapshot timestamp, successful command exits, non-empty output files with expected scope, file integrity hashes, encrypted copies stored outside the production account/project, and a **successful restore rehearsal** in a disposable local or other explicitly authorized environment. Test restored roles, table row counts (never paste customer rows), RLS behavior, auth, metadata and Storage object availability. Record observed RPO/RTO rather than guessing them. Retain the prior trusted snapshot until validation is finished.

If no safe restoration environment is available, classify `backup_recovery_verified=false`; **do not set** `AVEROMIRA_COPILOT_PRODUCTION_BACKUP_VERIFIED` or `AVEROMIRA_COPILOT_PRODUCTION_ROLLBACK_VERIFIED`.

This runbook has **not** executed any export or rehearsal.

## D. Missing AI ledger: ordering and options

**Observed root cause:** the Phase 2A foundation was never recorded in the connected Supabase project. The following checked-in files are pending candidates, not authorized migrations:

1. `supabase/migrations/20261011110113_operations_foundation.sql` — defines the missing operations owner role, `private.operation_limits`, `private.ai_usage_ledger`, related jobs and RLS/privileges.
2. `supabase/migrations/20261011110435_operations_document_publish.sql`
3. `supabase/migrations/20261011110444_operations_monitor_outbox.sql`
4. `supabase/migrations/20261011110451_operations_storage.sql`
5. `supabase/migrations/20261011113020_operations_shared_ai_ledger.sql` — defines shared AI RPCs, **but its current allowlist does NOT include `copilot_ai`**.
6. `supabase/migrations/20261011113251_operations_retention_readiness.sql`
7. `docs/copilot/PRODUCTION_LEDGER_PATCH_CANDIDATE.sql` — explicitly reviewed-only **follow-up candidate** to permit `copilot_ai` and guard settlement, once the foundation and shared RPC already exist.

The independent October 10 catalogue migration is also present in the repository, but wasn't recorded in the latest remote migration history. Assess the entire pending schema dependency graph, existing triggers, grants, RLS and possible migration-history renames before executing *any* of these. Never select a migration by filename alone. The Oct 11 Foundation file is **large** and also introduces workers and job tables, so applying it solely for Copilot without reviewing its other effects would be inappropriate.

**Potential alternative:** a narrow *Copilot-only* ledger could be designed later to avoid adopting the whole Phase 2A foundation. This would require its own reviewed tables/RPC permissions, rate limit concurrency, idempotency, budget accounting, update of the Copilot server adapter, regression tests and future reconciliation strategy; do not silently create a parallel ledger or bypass existing caps.

Before approving either approach, decide the intended operations architecture. Then rehearse the exact change on synthetic PostgreSQL with representative, **non-customer**, users and tenants. Verify no public/anon/granted access to private usage records, double-settlement refusal, strict per-user org membership, short/daily/monthly global+tenant limits, rate limiter, and conservative retention of `billed_unknown` on failed/aborted streams.

### Explicit database roll-out gates

- Production project link verified.
- Backup export and isolated restoration both successfully verified.
- Full dependency review including missing role, migrations, grants, schema objects and compatibility.
- Separate approval for *exact migration(s)* after showing expected effects and rollback.
- Confirm no long-lived secrets, production data exports, or credentials in code/PR.
- Only *after* successful migration and read-only validation, approve a tiny guarded pilot budget and a separately authorized real AI call.
- A code PR merge, a status of `READY`, or an environment variable by itself is **not** approval.

## E. Current decision and handoff

**NO-GO for production database changes and live Copilot activation.**

Unblocked now: finish documentation, develop/test synthetic migration proofs, compare versioned schema source, and inspect Supabase/Vercel project metadata read-only.

Blocked until separate evidence: restoring a trusted backup, executing DB migrations, setting approved spend caps, turning on `AVEROMIRA_COPILOT_ENABLED`, or making a real OpenAI call.

Only *after these* can Phase 4.3 production live-model verification proceed. No additional paid service was provisioned.
