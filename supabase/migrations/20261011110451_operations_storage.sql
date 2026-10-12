begin;
do $$ begin
 if not exists(select from pg_roles where rolname='averomira_storage_reader') then create role averomira_storage_reader nologin nosuperuser nocreatedb nocreaterole noinherit nobypassrls; end if;
 if exists(select from pg_roles where rolname='authenticator') then grant averomira_storage_reader to authenticator with inherit false,set true; end if;
end $$;
grant usage on schema storage,private to averomira_storage_reader;
grant select on storage.objects to averomira_storage_reader;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('operation-inputs','operation-inputs',false,10485760,array['application/pdf']) on conflict(id) do nothing;
do $$ begin
 if exists(select 1 from storage.buckets where id='operation-inputs' and (public or file_size_limit is null or file_size_limit>10485760)) then raise exception 'OPERATION_UNSAFE_BUCKET'; end if;
end $$;
create or replace function private.operation_storage_access(p_path text,p_write boolean) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from private.operation_uploads u where u.input_ref=p_path and u.actor_id=auth.uid() and private.operation_actor_allowed(u.organization_id,auth.uid()) and u.expires_at>now() and not exists(select 1 from private.operation_jobs j where j.id=u.id))
 or (not p_write and exists(select 1 from private.operation_jobs j where j.input_ref=p_path and exists(select 1 from public.organization_members m where m.organization_id=j.organization_id and m.user_id=auth.uid())));
$$;
create or replace function private.operation_storage_worker_access(p_path text) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from private.operation_jobs where input_ref=p_path and state='running' and lease_until>now());
$$;
alter function private.operation_storage_access(text,boolean) owner to averomira_operations_owner;
alter function private.operation_storage_worker_access(text) owner to averomira_operations_owner;
revoke all on function private.operation_storage_access(text,boolean),private.operation_storage_worker_access(text) from public,anon,authenticated,service_role,averomira_worker;
grant execute on function private.operation_storage_access(text,boolean) to authenticated;
grant execute on function private.operation_storage_worker_access(text) to averomira_storage_reader;
drop policy if exists operation_input_insert on storage.objects;
create policy operation_input_insert on storage.objects for insert to authenticated with check(bucket_id='operation-inputs' and private.operation_storage_access(name,true));
drop policy if exists operation_input_insert_guard on storage.objects;
create policy operation_input_insert_guard on storage.objects as restrictive for insert to authenticated with check(bucket_id<>'operation-inputs' or private.operation_storage_access(name,true));
drop policy if exists operation_input_select on storage.objects;
create policy operation_input_select on storage.objects for select to authenticated using(bucket_id='operation-inputs' and private.operation_storage_access(name,false));
drop policy if exists operation_input_read_guard on storage.objects;
create policy operation_input_read_guard on storage.objects as restrictive for select to authenticated using(bucket_id<>'operation-inputs' or private.operation_storage_access(name,false));
drop policy if exists operation_input_no_update on storage.objects;
create policy operation_input_no_update on storage.objects as restrictive for update to authenticated using(bucket_id<>'operation-inputs') with check(bucket_id<>'operation-inputs');
drop policy if exists operation_input_no_delete on storage.objects;
create policy operation_input_no_delete on storage.objects as restrictive for delete to authenticated using(bucket_id<>'operation-inputs');
drop policy if exists operation_worker_storage_read on storage.objects;
create policy operation_worker_storage_read on storage.objects for select to averomira_storage_reader using(bucket_id='operation-inputs' and private.operation_storage_worker_access(name));
-- Provision a short-lived custom Storage JWT separately; no service-key fallback.
commit;
