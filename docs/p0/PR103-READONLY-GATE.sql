-- Read-only diagnostics, to be run only after production runtime -> project proof.
-- No customer rows, identifiers, SKUs, connection strings or credentials in output.
-- Use a verified read-only transaction/role. Never use this as a migration script.
begin transaction read only;
select 'catalogue_sku_keys' object, to_regprocedure('public.catalogue_sku_keys(text[])') is not null present
union all select 'prepare_catalogue_import',to_regprocedure('public.prepare_catalogue_import(uuid,uuid,jsonb,text,text)') is not null
union all select 'commit_catalogue_import',to_regprocedure('public.commit_catalogue_import(uuid,uuid,boolean)') is not null
union all select 'catalogue_preview_action',to_regprocedure('public.catalogue_preview_action(uuid,uuid,integer,boolean)') is not null
union all select 'catalogue_field_maps',to_regclass('public.catalogue_field_maps') is not null
union all select 'catalogue_imports',to_regclass('private.catalogue_imports') is not null
union all select 'catalogue_versions',to_regclass('private.catalogue_versions') is not null
union all select 'products_org_sku_identity',to_regclass('public.products_org_sku_identity') is not null
union all select 'catalogue_product_revision',exists(select 1 from pg_trigger where tgrelid='public.products'::regclass and tgname='catalogue_product_revision' and tgenabled<>'D');
select count(*) as sku_conflicting_groups,coalesce(sum(rows_in_group-1),0) as sku_excess_rows
from (select count(*) rows_in_group from public.products group by organization_id,lower(btrim(sku)) having count(*)>1) conflicts;
select 'catalogue_field_maps' object,coalesce((select relrowsecurity from pg_class where oid=to_regclass('public.catalogue_field_maps')),false) rls_enabled
union all select 'catalogue_imports',coalesce((select relrowsecurity from pg_class where oid=to_regclass('private.catalogue_imports')),false)
union all select 'catalogue_versions',coalesce((select relrowsecurity from pg_class where oid=to_regclass('private.catalogue_versions')),false);
select 'prepare' endpoint,
 coalesce(has_function_privilege('authenticated',to_regprocedure('public.prepare_catalogue_import(uuid,uuid,jsonb,text,text)'),'EXECUTE'),false) authenticated_execute,
 coalesce(has_function_privilege('anon',to_regprocedure('public.prepare_catalogue_import(uuid,uuid,jsonb,text,text)'),'EXECUTE'),false) anonymous_execute
union all select 'commit',coalesce(has_function_privilege('authenticated',to_regprocedure('public.commit_catalogue_import(uuid,uuid,boolean)'),'EXECUTE'),false),coalesce(has_function_privilege('anon',to_regprocedure('public.commit_catalogue_import(uuid,uuid,boolean)'),'EXECUTE'),false)
union all select 'preview',coalesce(has_function_privilege('authenticated',to_regprocedure('public.catalogue_preview_action(uuid,uuid,integer,boolean)'),'EXECUTE'),false),coalesce(has_function_privilege('anon',to_regprocedure('public.catalogue_preview_action(uuid,uuid,integer,boolean)'),'EXECUTE'),false);
select coalesce(has_table_privilege('authenticated',to_regclass('private.catalogue_imports'),'SELECT'),false) authenticated_private_imports_select,
coalesce(has_table_privilege('anon',to_regclass('public.catalogue_field_maps'),'SELECT'),false) anonymous_field_maps_select;
select to_regclass('supabase_migrations.schema_migrations') is not null as migration_history_table_exists;
-- After the previous result is true, inspect migration history read-only in the verified project:
-- select version from supabase_migrations.schema_migrations where version='20261010140726';
commit;
