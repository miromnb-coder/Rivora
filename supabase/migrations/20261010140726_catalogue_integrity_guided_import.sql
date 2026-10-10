-- Run only after conflict preflight. No automatic product merge/rename/delete.
-- Immutable IDs and display SKUs preserve mappings and commercial snapshots.
begin;
create or replace function private.catalogue_sku_key(value text) returns text
language sql immutable strict set search_path = ''
as $$ select lower(btrim(value)) $$;
revoke all on function private.catalogue_sku_key(text) from public;
grant execute on function private.catalogue_sku_key(text) to authenticated;

-- Use the database's exact normalization for server-side row diagnostics too.
create or replace function public.catalogue_sku_keys(skus text[]) returns text[]
language sql immutable strict security invoker set search_path = '' as $$
  select case when cardinality(skus) between 1 and 25000 and octet_length(array_to_string(skus,''))<=10*1024*1024
    then array(select private.catalogue_sku_key(sku) from unnest(skus) sku) else null end
$$;
revoke all on function public.catalogue_sku_keys(text[]) from public,anon;
grant execute on function public.catalogue_sku_keys(text[]) to authenticated;

do $$ begin
  if exists (select 1 from public.products group by organization_id, private.catalogue_sku_key(sku) having count(*) > 1) then
    raise exception 'SKU_CONFLICT: resolve existing catalogue identities through separately reviewed data changes';
  end if;
end $$;
create unique index if not exists products_org_sku_identity on public.products(organization_id, private.catalogue_sku_key(sku));

create table if not exists private.catalogue_versions (
  organization_id uuid primary key references public.organizations(id) on delete cascade,
  revision bigint not null default 0
);
create table if not exists private.catalogue_imports (
  id uuid primary key,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  actor_id uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '1 hour',
  mode text not null check (mode in ('merge','replace')),
  file_hash text not null check (file_hash ~ '^[0-9a-f]{64}$'),
  payload_hash text not null,
  revision bigint not null,
  payload jsonb,
  plan jsonb not null,
  committed_at timestamptz,
  result jsonb
);
create index if not exists catalogue_imports_org_created on private.catalogue_imports(organization_id, created_at);
alter table private.catalogue_versions enable row level security;
alter table private.catalogue_imports enable row level security;
revoke all on private.catalogue_versions, private.catalogue_imports from public, anon, authenticated;

-- All product writes participate, including existing direct editing routes.
create or replace function private.catalogue_product_revision() returns trigger
language plpgsql security definer set search_path = '' as $$
declare org uuid := case when TG_OP = 'DELETE' then old.organization_id else new.organization_id end;
begin
  if TG_OP = 'DELETE' and not exists(select 1 from public.organizations where id=org) then return old; end if;
  if TG_OP = 'UPDATE' and new.organization_id is distinct from old.organization_id then
    raise exception 'Product organization cannot be reassigned';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(org::text, 641));
  insert into private.catalogue_versions(organization_id, revision) values (org, 1)
  on conflict (organization_id) do update set revision = catalogue_versions.revision + 1;
  if TG_OP = 'DELETE' then return old; end if;
  return new;
end $$;
revoke all on function private.catalogue_product_revision() from public, anon, authenticated;
drop trigger if exists catalogue_product_revision on public.products;
create trigger catalogue_product_revision before insert or update or delete on public.products
for each row execute function private.catalogue_product_revision();

create table if not exists public.catalogue_field_maps (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 100),
  format text not null check (format in ('csv','xlsx')),
  headers jsonb not null check (jsonb_typeof(headers) = 'array' and jsonb_array_length(headers) between 1 and 100),
  mapping jsonb not null check (jsonb_typeof(mapping) = 'object'),
  updated_at timestamptz not null default now(),
  unique(organization_id, name, format)
);
alter table public.catalogue_field_maps enable row level security;
drop policy if exists catalogue_maps_select on public.catalogue_field_maps;
create policy catalogue_maps_select on public.catalogue_field_maps for select to authenticated
using (private.has_org_role(organization_id, array['owner','admin']));
drop policy if exists catalogue_maps_insert on public.catalogue_field_maps;
create policy catalogue_maps_insert on public.catalogue_field_maps for insert to authenticated
with check (private.has_org_role(organization_id, array['owner','admin']));
drop policy if exists catalogue_maps_update on public.catalogue_field_maps;
create policy catalogue_maps_update on public.catalogue_field_maps for update to authenticated
using (private.has_org_role(organization_id, array['owner','admin']))
with check (private.has_org_role(organization_id, array['owner','admin']));
drop policy if exists catalogue_maps_delete on public.catalogue_field_maps;
create policy catalogue_maps_delete on public.catalogue_field_maps for delete to authenticated
using (private.has_org_role(organization_id, array['owner','admin']));
revoke all on public.catalogue_field_maps from public, anon, authenticated;
grant select, insert, update, delete on public.catalogue_field_maps to authenticated;

-- Plan and commit use the same incoming projection, preserving omitted stock.
create or replace function private.catalogue_incoming(org uuid, payload jsonb)
returns table(sku text, name text, manufacturer text, manufacturer_part_number text, unit text, unit_price numeric, stock_quantity numeric)
language sql stable set search_path = '' as $$
  select btrim(x.sku), btrim(x.name), nullif(btrim(x.manufacturer),''), nullif(btrim(x.manufacturer_part_number),''),
    coalesce(nullif(btrim(x.unit),''),'pcs'), x.unit_price,
    case when x.stock_quantity_provided then x.stock_quantity else p.stock_quantity end
  from jsonb_to_recordset(payload) x(sku text, name text, manufacturer text, manufacturer_part_number text, unit text,
    unit_price numeric, stock_quantity numeric, stock_quantity_provided boolean)
  left join public.products p on p.organization_id = org and private.catalogue_sku_key(p.sku) = private.catalogue_sku_key(x.sku)
$$;
revoke all on function private.catalogue_incoming(uuid,jsonb) from public, anon, authenticated;

create or replace function private.catalogue_plan(org uuid, payload jsonb, mode text) returns jsonb
language sql stable set search_path = '' as $$
  with incoming as (select * from private.catalogue_incoming(org,payload)),
  changes as (
    select coalesce(p.sku,i.sku) sku,
      case when p.id is null then 'created'
        when row(p.name,p.manufacturer,p.manufacturer_part_number,p.unit,p.unit_price,p.stock_quantity,p.active)
          is distinct from row(i.name,i.manufacturer,i.manufacturer_part_number,i.unit,i.unit_price,i.stock_quantity,true)
        then 'updated' else 'unchanged' end action,
      case when p.id is null then null else jsonb_build_object('name',p.name,'manufacturer',p.manufacturer,
        'manufacturer_part_number',p.manufacturer_part_number,'unit',p.unit,'unit_price',p.unit_price,'stock_quantity',p.stock_quantity,'active',p.active) end before,
      jsonb_build_object('name',i.name,'manufacturer',i.manufacturer,'manufacturer_part_number',i.manufacturer_part_number,
        'unit',i.unit,'unit_price',i.unit_price,'stock_quantity',i.stock_quantity,'active',true) after
    from incoming i left join public.products p on p.organization_id = org and private.catalogue_sku_key(p.sku)=private.catalogue_sku_key(i.sku)
    union all
    select p.sku, 'deactivated', jsonb_build_object('name',p.name,'unit_price',p.unit_price,'active',true), jsonb_build_object('active',false)
    from public.products p where mode='replace' and p.organization_id=org and p.active
      and not exists(select 1 from incoming i where private.catalogue_sku_key(i.sku)=private.catalogue_sku_key(p.sku))
  )
  select jsonb_build_object('total', jsonb_array_length(payload),
    'created',count(*) filter(where action='created'), 'updated',count(*) filter(where action='updated'),
    'unchanged',count(*) filter(where action='unchanged'), 'deactivated',count(*) filter(where action='deactivated'),
    'missing_price',(select count(*) from incoming where unit_price is null),
    'active_before',(select count(*) from public.products where organization_id=org and active),
    'changes',coalesce(jsonb_agg(jsonb_build_object('sku',sku,'action',action,'before',before,'after',after) order by sku),'[]'::jsonb)) from changes
$$;
revoke all on function private.catalogue_plan(uuid,jsonb,text) from public, anon, authenticated;

-- Bound HTTP response sizes even for 25 000 products: inspect 50 changes per page.
create or replace function private.catalogue_page(plan jsonb, page_number integer) returns jsonb
language sql immutable set search_path = '' as $$
  select (plan - 'changes') || jsonb_build_object(
    'change_count', jsonb_array_length(coalesce(plan->'changes','[]'::jsonb)),
    'changes', coalesce((select jsonb_agg(value order by ordinality)
      from jsonb_array_elements(coalesce(plan->'changes','[]'::jsonb)) with ordinality
      where ordinality between page_number * coalesce((plan->>'page_size')::integer,50) + 1
        and (page_number + 1) * coalesce((plan->>'page_size')::integer,50)),'[]'::jsonb))
$$;
revoke all on function private.catalogue_page(jsonb,integer) from public,anon,authenticated;

-- Privileged implementation is private; public wrappers remain SECURITY INVOKER.
create or replace function private.prepare_catalogue_import_impl(target_organization_id uuid, import_id uuid, payload jsonb, import_mode text, file_hash text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare rev bigint; planned jsonb; existing private.catalogue_imports; payload_digest text;
begin
  if auth.uid() is null or not private.has_org_role(target_organization_id,array['owner','admin']) then raise exception 'CATALOGUE_FORBIDDEN'; end if;
  if import_mode is null or import_mode not in ('merge','replace') or import_id is null or file_hash is null or file_hash !~ '^[0-9a-f]{64}$' then raise exception 'CATALOGUE_INVALID_REQUEST'; end if;
  if payload is null or jsonb_typeof(payload)<>'array' or jsonb_array_length(payload) not between 1 and 25000 or octet_length(payload::text)>32*1024*1024 then raise exception 'CATALOGUE_INVALID_PAYLOAD'; end if;
  if exists(select 1 from jsonb_array_elements(payload) x where jsonb_typeof(x)<>'object'
    or jsonb_typeof(x->'sku') is distinct from 'string' or nullif(btrim(x->>'sku'),'') is null
    or jsonb_typeof(x->'name') is distinct from 'string' or nullif(btrim(x->>'name'),'') is null
    or char_length(x->>'sku')>5000 or char_length(x->>'name')>5000
    or char_length(x->>'manufacturer')>5000 or char_length(x->>'manufacturer_part_number')>5000 or char_length(x->>'unit')>5000
    or jsonb_typeof(x->'stock_quantity_provided') is distinct from 'boolean'
    or (x->'unit_price' is not null and jsonb_typeof(x->'unit_price') not in ('number','null'))
    or (x->'stock_quantity' is not null and jsonb_typeof(x->'stock_quantity') not in ('number','null')))
  then raise exception 'CATALOGUE_INVALID_ROW'; end if;
  if exists(select 1 from private.catalogue_incoming(target_organization_id,payload) i
    where i.unit_price<0 or i.unit_price>=10000000000 or i.unit_price<>trunc(i.unit_price,4)
       or i.stock_quantity<0 or i.stock_quantity>=10000000000 or i.stock_quantity<>trunc(i.stock_quantity,4)) then raise exception 'CATALOGUE_INVALID_NUMBER'; end if;
  if exists(select 1 from private.catalogue_incoming(target_organization_id,payload) group by private.catalogue_sku_key(sku) having count(*)>1) then raise exception 'CATALOGUE_DUPLICATE_SKU'; end if;
  perform pg_advisory_xact_lock(hashtextextended(target_organization_id::text,641));
  payload_digest := encode(sha256(convert_to(payload::text,'UTF8')),'hex');
  select * into existing from private.catalogue_imports where id=import_id;
  if found then
    if existing.organization_id<>target_organization_id or existing.actor_id<>auth.uid() or existing.payload_hash<>payload_digest or existing.file_hash<>file_hash or existing.mode<>import_mode then raise exception 'CATALOGUE_IDEMPOTENCY_CONFLICT'; end if;
    if existing.expires_at<now() and existing.committed_at is null then raise exception 'CATALOGUE_PREVIEW_EXPIRED'; end if;
    return jsonb_build_object('importId',existing.id,'mode',existing.mode,'summary',private.catalogue_page(existing.plan,0));
  end if;
  -- Bound per-organization pending data; no job infrastructure or permanent source documents.
  update private.catalogue_imports j set payload=null, plan=j.plan-'changes' where j.organization_id=target_organization_id and j.expires_at<now() and j.payload is not null;
  if (select count(*) from private.catalogue_imports where organization_id=target_organization_id and expires_at>now() and committed_at is null)>=5 then raise exception 'CATALOGUE_TOO_MANY_PREVIEWS'; end if;
  select coalesce((select revision from private.catalogue_versions where organization_id=target_organization_id),0) into rev;
  planned := private.catalogue_plan(target_organization_id,payload,import_mode);
  -- Worst record size determines page size; preserve full values under Vercel's
  -- response ceiling, including heavily escaped source strings.
  planned := planned || jsonb_build_object('page_size',greatest(1,least(50,
    (3*1024*1024) / (select greatest(1,max(octet_length(value::text))) from jsonb_array_elements(planned->'changes')))));

  insert into private.catalogue_imports(id,organization_id,actor_id,mode,file_hash,payload_hash,revision,payload,plan)
  values(import_id,target_organization_id,auth.uid(),import_mode,file_hash,payload_digest,rev,payload,planned);
  return jsonb_build_object('importId',import_id,'mode',import_mode,'summary',private.catalogue_page(planned,0));
end $$;
revoke all on function private.prepare_catalogue_import_impl(uuid,uuid,jsonb,text,text) from public, anon;
grant execute on function private.prepare_catalogue_import_impl(uuid,uuid,jsonb,text,text) to authenticated;
create or replace function public.prepare_catalogue_import(target_organization_id uuid, import_id uuid, payload jsonb, import_mode text, file_hash text)
returns jsonb language sql security invoker set search_path = '' as $$ select private.prepare_catalogue_import_impl($1,$2,$3,$4,$5) $$;
revoke all on function public.prepare_catalogue_import(uuid,uuid,jsonb,text,text) from public, anon;
grant execute on function public.prepare_catalogue_import(uuid,uuid,jsonb,text,text) to authenticated;

create or replace function private.commit_catalogue_import_impl(target_organization_id uuid, import_id uuid, confirm_replace boolean)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare job private.catalogue_imports; final_plan jsonb; rev bigint;
begin
  if auth.uid() is null or not private.has_org_role(target_organization_id,array['owner','admin']) then raise exception 'CATALOGUE_FORBIDDEN'; end if;
  perform pg_advisory_xact_lock(hashtextextended(target_organization_id::text,641));
  select * into job from private.catalogue_imports where id=import_id and organization_id=target_organization_id and actor_id=auth.uid() for update;
  if not found then raise exception 'CATALOGUE_PREVIEW_NOT_FOUND'; end if;
  if job.mode='replace' and confirm_replace is distinct from true then raise exception 'CATALOGUE_REPLACE_CONFIRMATION_REQUIRED'; end if;
  if job.committed_at is not null then return job.result; end if;
  if job.expires_at<now() or job.payload is null then raise exception 'CATALOGUE_PREVIEW_EXPIRED'; end if;
  select coalesce((select revision from private.catalogue_versions where organization_id=target_organization_id),0) into rev;
  if rev<>job.revision then raise exception 'CATALOGUE_PREVIEW_STALE'; end if;
  final_plan := private.catalogue_plan(target_organization_id,job.payload,job.mode);
  if final_plan is distinct from (job.plan-'page_size') then raise exception 'CATALOGUE_PREVIEW_STALE'; end if;
  insert into public.products(organization_id,sku,name,manufacturer,manufacturer_part_number,unit,unit_price,stock_quantity,active,updated_at)
    select target_organization_id,i.sku,i.name,i.manufacturer,i.manufacturer_part_number,i.unit,i.unit_price,i.stock_quantity,true,now()
    from private.catalogue_incoming(target_organization_id,job.payload) i
  on conflict (organization_id, (private.catalogue_sku_key(sku))) do update
    set name=excluded.name, manufacturer=excluded.manufacturer, manufacturer_part_number=excluded.manufacturer_part_number,
      unit=excluded.unit, unit_price=excluded.unit_price, stock_quantity=excluded.stock_quantity, active=true, updated_at=now()
    where row(products.name,products.manufacturer,products.manufacturer_part_number,products.unit,products.unit_price,products.stock_quantity,products.active)
      is distinct from row(excluded.name,excluded.manufacturer,excluded.manufacturer_part_number,excluded.unit,excluded.unit_price,excluded.stock_quantity,true);
  if job.mode='replace' then
    update public.products p set active=false,updated_at=now() where p.organization_id=target_organization_id and p.active
      and not exists(select 1 from private.catalogue_incoming(target_organization_id,job.payload) i where private.catalogue_sku_key(i.sku)=private.catalogue_sku_key(p.sku));
  end if;
  -- Keep only aggregate audit metadata after commit, not customer catalogue contents.
  final_plan := final_plan - 'changes';
  update private.catalogue_imports set committed_at=now(), result=final_plan, payload=null, plan=final_plan where id=import_id;
  perform private.write_activity_event(target_organization_id,'catalogue',import_id,'catalogue_imported',
    jsonb_build_object('import_id',import_id,'mode',job.mode,'file_hash',job.file_hash,'summary',final_plan),auth.uid());
  return final_plan;
end $$;
revoke all on function private.commit_catalogue_import_impl(uuid,uuid,boolean) from public, anon;
grant execute on function private.commit_catalogue_import_impl(uuid,uuid,boolean) to authenticated;
create or replace function public.commit_catalogue_import(target_organization_id uuid, import_id uuid, confirm_replace boolean default false)
returns jsonb language sql security invoker set search_path = '' as $$ select private.commit_catalogue_import_impl($1,$2,$3) $$;
revoke all on function public.commit_catalogue_import(uuid,uuid,boolean) from public, anon;
grant execute on function public.commit_catalogue_import(uuid,uuid,boolean) to authenticated;

create or replace function private.catalogue_preview_action_impl(target_organization_id uuid, import_id uuid, page_number integer, discard boolean)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare job private.catalogue_imports;
begin
  if auth.uid() is null or not private.has_org_role(target_organization_id,array['owner','admin']) then raise exception 'CATALOGUE_FORBIDDEN'; end if;
  if page_number is null or page_number not between 0 and 25000 then raise exception 'CATALOGUE_INVALID_REQUEST'; end if;
  perform pg_advisory_xact_lock(hashtextextended(target_organization_id::text,641));
  select * into job from private.catalogue_imports where id=import_id and organization_id=target_organization_id and actor_id=auth.uid();
  if not found then raise exception 'CATALOGUE_PREVIEW_NOT_FOUND'; end if;
  if discard then
    if job.committed_at is null then
      update private.catalogue_imports set expires_at=now()-interval '1 second',payload=null,plan=plan-'changes' where id=import_id;
    end if;
    return jsonb_build_object('discarded',true,'committed',job.committed_at is not null);
  end if;
  if job.committed_at is not null or job.expires_at<now() then raise exception 'CATALOGUE_PREVIEW_EXPIRED'; end if;
  return jsonb_build_object('summary',private.catalogue_page(job.plan,page_number));
end $$;
revoke all on function private.catalogue_preview_action_impl(uuid,uuid,integer,boolean) from public,anon;
grant execute on function private.catalogue_preview_action_impl(uuid,uuid,integer,boolean) to authenticated;
create or replace function public.catalogue_preview_action(target_organization_id uuid, import_id uuid, page_number integer default 0, discard boolean default false)
returns jsonb language sql security invoker set search_path = '' as $$ select private.catalogue_preview_action_impl($1,$2,$3,$4) $$;
revoke all on function public.catalogue_preview_action(uuid,uuid,integer,boolean) from public,anon;
grant execute on function public.catalogue_preview_action(uuid,uuid,integer,boolean) to authenticated;

-- Close the old full-sync path, including direct RPC callers and old server actions.
create or replace function public.import_catalogue_rows(target_organization_id uuid,payload jsonb) returns jsonb
language plpgsql security invoker set search_path = '' as $$ begin
  raise exception 'CATALOGUE_PREVIEW_REQUIRED: use prepare_catalogue_import and commit_catalogue_import';
end $$;
notify pgrst, 'reload schema';
commit;
