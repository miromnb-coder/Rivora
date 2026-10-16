-- Phase 4.3 — READ-ONLY database schema and privileges verification.
-- Safe to run on the intended production Supabase project; does not inspect
-- secrets, customer records or mutable operational rows.
-- Results must be corroborated against the effective Vercel production
-- URL and Supabase dashboard: a matching name/ref alone is insufficient.
select
  current_database() as database_name,
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
