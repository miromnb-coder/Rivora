-- PHASE 4.3 — READ-ONLY METADATA ONLY / NO MIGRATIONS.
-- Run solely on the target confirmed Supabase project.
-- Never infer production/Vercel linkage from a DB schema query: also verify
-- Vercel's protected production NEXT_PUBLIC_SUPABASE_URL in the dashboard.
-- Never paste connection strings, passwords, JWTs or row data in reports.
-- Supabase Free does not include managed daily DB backups/PITR. That state
-- cannot be verified from SQL; require a separately restored logical dump.

select
  current_database() as database_name,
  current_setting('server_version') as postgres_version,
  pg_size_pretty(pg_database_size(current_database())) as database_size,
  pg_database_size(current_database()) as database_size_bytes,
  exists(select 1 from pg_namespace where nspname = 'private') as private_schema_exists,
  exists(select 1 from pg_roles where rolname = 'averomira_operations_owner') as operations_owner_role_exists,
  to_regclass('public.organizations') is not null as organizations_exists,
  to_regclass('public.organization_members') is not null as org_members_exists,
  to_regclass('private.operation_limits') is not null as operation_limits_exists,
  to_regclass('private.ai_usage_ledger') is not null as ai_usage_ledger_exists,
  to_regprocedure('public.reserve_ai_usage_server(uuid,uuid,text,uuid,text,text,bigint)')
     is not null as reserve_usage_rpc_exists,
  to_regprocedure('public.settle_ai_usage_server(uuid,bigint,bigint,bigint,text,boolean)')
     is not null as settle_usage_rpc_exists,
  to_regclass('private.integration_secrets') is not null as integration_secrets_exists,
  (select relrowsecurity from pg_class
     where oid = to_regclass('private.integration_secrets')) as integration_secrets_rls_enabled,
  has_schema_privilege('anon', 'private', 'USAGE') as anon_private_usage,
  has_schema_privilege('authenticated', 'private', 'USAGE') as authenticated_private_usage,
  has_table_privilege('anon', 'private.integration_secrets', 'SELECT') as anon_integration_select,
  has_table_privilege('authenticated', 'private.integration_secrets', 'SELECT') as authenticated_integration_select;
