# CX2 migration and recovery gate
New tables: `copilot_user_preferences`, `copilot_conversations`, `copilot_messages`.
Browser role can only SELECT its own user+tenant rows using RLS. Only the authenticated, CSRF-checked server routes are permitted to make scoped writes with a narrowly used admin client. Existing RFQ/Orders/Product Memory remain read-only and unchanged.

**Do not run against production until a verified database + Storage backup, isolated restore and owner-reviewed rollback procedure are recorded.** The previous Phase 7 `PHASE7_RECOVERY_REPORT.md` explicitly shows backup/restore as unverified. The presence of `AVEROMIRA_COPILOT_PILOT_NO_BACKUP_RISK_ACCEPTED` is not proof of recoverability.

Dry run:
1. Apply this migration in a disposable PostgreSQL/Supabase development DB and verify all constraints, policies and grants.
2. Check user A/org A vs user B/org A and user A/org B; no user can read another user's chat, even as an org owner.
3. Check authenticated INSERT/UPDATE/DELETE denied; service_role scoped REST API actions require verified caller identity in the Next route.
4. Verify cascade deletes, unique (conversation,request,role), and compatibility with RLS/previous Supabase policies.
5. Test safe API/stream flow with CX2 flags ON in isolated deployment, then simulate every expected failure and idempotent retry.
6. If approved for production, execute during maintenance with an off-site protected backup and a validated rollback/restore plan. Feature flags must still start OFF.
7. After migration and CI, activate for **only the existing approved one-actor, one-org pilot**; never enable customer beta or wider tenant access.

90-day retention is a proposal, not an automatically running background job; avoid claiming automatic deletion until the job, legal policy and backup retention are actually validated.
