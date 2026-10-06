-- M3 — Explainability + Management
--
-- Adds an actor-bound read model for explaining Product Memory on RFQ lines
-- and canonical memory-id based management RPCs. The M1 memory core remains
-- the source of truth; customer_product_mappings stays a compatibility mirror.
--
-- Safety:
--   * memory explanations are workspace-bound and server-only
--   * explicit management may change a verified target, but never silently
--   * disabled memory remains in the canonical audit trail and is removed from
--     the legacy compatibility mirror
--   * only verified memory is reused by M2 matching

create or replace function public.get_rfq_product_memory_explanations_server(
  target_rfq_id uuid,
  target_actor_id uuid
)
returns table (
  rfq_line_id uuid,
  memory_id uuid,
  source_value text,
  target_product_id uuid,
  verification_state text,
  memory_source text,
  confidence numeric,
  verified_at timestamptz,
  use_count integer,
  last_used_at timestamptz,
  matched_at timestamptz,
  source_entity_type text,
  source_entity_id uuid
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_org_id uuid;
begin
  if target_actor_id is null then
    raise exception 'Actor is required';
  end if;

  select r.organization_id
  into target_org_id
  from public.rfqs r
  where r.id = target_rfq_id;

  if target_org_id is null then
    raise exception 'RFQ not found';
  end if;

  if not exists (
    select 1
    from public.organization_members om
    where om.organization_id = target_org_id
      and om.user_id = target_actor_id
  ) then
    raise exception 'Workspace member access is required';
  end if;

  return query
  select distinct on (l.id)
    l.id as rfq_line_id,
    mem.id as memory_id,
    mem.source_value,
    mem.target_entity_id as target_product_id,
    mem.verification_state,
    mem.source as memory_source,
    mem.confidence,
    mem.verified_at,
    mem.use_count,
    mem.last_used_at,
    usage.used_at as matched_at,
    mem.source_entity_type,
    mem.source_entity_id
  from public.rfq_lines l
  join public.rfqs r
    on r.id = l.rfq_id
   and r.organization_id = l.organization_id
  join public.workspace_memory_usage_events usage
    on usage.organization_id = l.organization_id
   and usage.source_entity_type = 'rfq_line'
   and usage.source_entity_id = l.id
  join public.workspace_memory_entries mem
    on mem.id = usage.memory_id
   and mem.organization_id = l.organization_id
   and mem.scope = 'customer'
   and mem.customer_id is not distinct from r.customer_id
   and mem.memory_type = 'customer_sku_product'
   and mem.target_entity_type = 'product'
   and mem.target_entity_id = l.selected_product_id
  where l.rfq_id = target_rfq_id
    and l.organization_id = target_org_id
  order by l.id, usage.used_at desc;
end;
$$;

revoke all on function public.get_rfq_product_memory_explanations_server(uuid,uuid) from public;
revoke all on function public.get_rfq_product_memory_explanations_server(uuid,uuid) from anon;
revoke all on function public.get_rfq_product_memory_explanations_server(uuid,uuid) from authenticated;
grant execute on function public.get_rfq_product_memory_explanations_server(uuid,uuid) to service_role;


create or replace function public.update_customer_product_memory_by_memory_server(
  target_memory_id uuid,
  target_product_id uuid,
  target_actor_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  memory_row public.workspace_memory_entries;
begin
  if target_actor_id is null then
    raise exception 'Actor is required';
  end if;

  select mem.*
  into memory_row
  from public.workspace_memory_entries mem
  where mem.id = target_memory_id
  for update;

  if memory_row.id is null then
    raise exception 'Memory entry not found';
  end if;

  if memory_row.scope <> 'customer'
     or memory_row.memory_type <> 'customer_sku_product'
     or memory_row.customer_id is null
     or memory_row.target_entity_type <> 'product' then
    raise exception 'Unsupported Product Memory entry';
  end if;

  if not exists (
    select 1
    from public.organization_members om
    where om.organization_id = memory_row.organization_id
      and om.user_id = target_actor_id
      and om.role in ('owner','admin','member')
  ) then
    raise exception 'Reviewer access is required';
  end if;

  if not exists (
    select 1
    from public.products p
    where p.id = target_product_id
      and p.organization_id = memory_row.organization_id
      and p.active = true
  ) then
    raise exception 'Active catalogue product not found';
  end if;

  update public.workspace_memory_entries
  set target_entity_type = 'product',
      target_entity_id = target_product_id,
      confidence = 100,
      verification_state = 'verified',
      source = 'manual_confirmation',
      verified_by = target_actor_id,
      verified_at = now(),
      metadata = coalesce(metadata, '{}'::jsonb)
        || jsonb_build_object('managed_in_m3', true),
      updated_by = target_actor_id,
      updated_at = now()
  where id = memory_row.id;

  insert into public.customer_product_mappings(
    organization_id,
    customer_id,
    customer_sku,
    customer_description,
    product_id,
    confidence,
    source,
    times_used,
    confirmed_by_user_id,
    last_used_at
  )
  values (
    memory_row.organization_id,
    memory_row.customer_id,
    memory_row.source_value,
    nullif(memory_row.metadata ->> 'customer_description', ''),
    target_product_id,
    100,
    'user_confirmed',
    greatest(coalesce(memory_row.use_count, 0), 0),
    target_actor_id,
    memory_row.last_used_at
  )
  on conflict (organization_id, customer_id, normalized_customer_sku)
  do update set
    customer_sku = excluded.customer_sku,
    customer_description = coalesce(
      excluded.customer_description,
      public.customer_product_mappings.customer_description
    ),
    product_id = excluded.product_id,
    confidence = 100,
    source = 'user_confirmed',
    confirmed_by_user_id = target_actor_id,
    updated_at = now();
end;
$$;

revoke all on function public.update_customer_product_memory_by_memory_server(uuid,uuid,uuid) from public;
revoke all on function public.update_customer_product_memory_by_memory_server(uuid,uuid,uuid) from anon;
revoke all on function public.update_customer_product_memory_by_memory_server(uuid,uuid,uuid) from authenticated;
grant execute on function public.update_customer_product_memory_by_memory_server(uuid,uuid,uuid) to service_role;


create or replace function public.disable_customer_product_memory_by_memory_server(
  target_memory_id uuid,
  target_actor_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  memory_row public.workspace_memory_entries;
begin
  if target_actor_id is null then
    raise exception 'Actor is required';
  end if;

  select mem.*
  into memory_row
  from public.workspace_memory_entries mem
  where mem.id = target_memory_id
  for update;

  if memory_row.id is null then
    raise exception 'Memory entry not found';
  end if;

  if memory_row.scope <> 'customer'
     or memory_row.memory_type <> 'customer_sku_product'
     or memory_row.customer_id is null
     or memory_row.target_entity_type <> 'product' then
    raise exception 'Unsupported Product Memory entry';
  end if;

  if not exists (
    select 1
    from public.organization_members om
    where om.organization_id = memory_row.organization_id
      and om.user_id = target_actor_id
      and om.role in ('owner','admin')
  ) then
    raise exception 'Owner or admin access is required';
  end if;

  update public.workspace_memory_entries
  set verification_state = 'disabled',
      metadata = coalesce(metadata, '{}'::jsonb)
        || jsonb_build_object('managed_in_m3', true),
      updated_by = target_actor_id,
      updated_at = now()
  where id = memory_row.id;

  update public.customer_product_mappings legacy
  set confirmed_by_user_id = target_actor_id,
      updated_at = now()
  where legacy.organization_id = memory_row.organization_id
    and legacy.customer_id = memory_row.customer_id
    and private.normalize_memory_key(legacy.customer_sku) = memory_row.source_key;

  delete from public.customer_product_mappings legacy
  where legacy.organization_id = memory_row.organization_id
    and legacy.customer_id = memory_row.customer_id
    and private.normalize_memory_key(legacy.customer_sku) = memory_row.source_key;
end;
$$;

revoke all on function public.disable_customer_product_memory_by_memory_server(uuid,uuid) from public;
revoke all on function public.disable_customer_product_memory_by_memory_server(uuid,uuid) from anon;
revoke all on function public.disable_customer_product_memory_by_memory_server(uuid,uuid) from authenticated;
grant execute on function public.disable_customer_product_memory_by_memory_server(uuid,uuid) to service_role;
