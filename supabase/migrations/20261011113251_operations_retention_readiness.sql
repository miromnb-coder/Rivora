begin;
grant select,update(payload,plan) on private.catalogue_imports to averomira_operations_owner;
create or replace function private.operation_cleanup_candidates() returns jsonb
language plpgsql security definer set search_path='' as $$
declare n integer;
begin
 -- Retain all domain records, aggregates, activity events and billing evidence.
 update private.catalogue_imports set payload=null,plan=plan-'changes' where id in(select id from private.catalogue_imports where expires_at<now() and payload is not null order by expires_at limit 50);
 get diagnostics n=row_count;
 update private.operation_jobs set checkpoint=null where id in(select id from private.operation_jobs where state in('succeeded','cancelled','dead') and completed_at<now()-interval '7 days' and checkpoint is not null order by completed_at limit 50);
 -- Storage deletion is deliberately a separate least-privilege approval gate.
 return jsonb_build_object('cataloguePayloadsCleared',n,'orphanUploads',(select count(*) from private.operation_uploads u where expires_at<now()-interval '7 days' and not exists(select 1 from private.operation_jobs j where j.id=u.id)));
end $$;
alter function private.operation_cleanup_candidates() owner to averomira_operations_owner;
revoke all on function private.operation_cleanup_candidates() from public,anon,authenticated,service_role;
grant execute on function private.operation_cleanup_candidates() to averomira_worker;
create or replace function public.operation_capabilities(p_org uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
begin
 if not exists(select 1 from public.organization_members where organization_id=p_org and user_id=auth.uid()) then raise exception 'OPERATION_FORBIDDEN'; end if;
 return jsonb_build_object('schemaVersion',1,'catalogueReady',to_regprocedure('public.prepare_catalogue_import(uuid,uuid,jsonb,text,text)') is not null and to_regprocedure('public.commit_catalogue_import(uuid,uuid,boolean)') is not null and to_regclass('private.catalogue_versions') is not null and to_regclass('public.products_org_sku_identity') is not null,
 'operationsReady',to_regprocedure('private.operation_claim(uuid,text)') is not null and to_regprocedure('private.operation_publish_document(uuid,bigint,uuid)') is not null and to_regclass('private.ai_usage_ledger') is not null);
end $$;
alter function public.operation_capabilities(uuid) owner to averomira_operations_owner;
revoke all on function public.operation_capabilities(uuid) from public,anon,service_role;
grant execute on function public.operation_capabilities(uuid) to authenticated;
commit;
