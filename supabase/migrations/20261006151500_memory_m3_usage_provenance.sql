-- M3 provenance hardening
--
-- Preserve the meaning of a Product Memory match at the moment it is used.
-- This keeps historical RFQ explainability correct even if an admin later
-- changes or disables the canonical memory entry.
--
-- The usage event remains the idempotency key. This migration only enriches
-- its metadata with a point-in-time snapshot and updates the explain RPC to
-- prefer that snapshot over the mutable current memory target.

create or replace function private.snapshot_workspace_memory_usage_event()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  mem public.workspace_memory_entries;
begin
  select m.*
  into mem
  from public.workspace_memory_entries m
  where m.id = new.memory_id;

  if mem.id is null then
    raise exception 'Memory entry not found for usage event';
  end if;

  if mem.organization_id <> new.organization_id then
    raise exception 'Memory usage event workspace mismatch';
  end if;

  new.metadata := coalesce(new.metadata, '{}'::jsonb)
    || jsonb_build_object(
      'memory_target_entity_type', mem.target_entity_type,
      'memory_target_entity_id', mem.target_entity_id,
      'memory_source_value', mem.source_value,
      'memory_source', mem.source,
      'memory_confidence', mem.confidence,
      'memory_verification_state', mem.verification_state,
      'memory_verified_at', mem.verified_at,
      'memory_customer_id', mem.customer_id
    );

  return new;
end;
$$;

revoke all on function private.snapshot_workspace_memory_usage_event() from public;
revoke all on function private.snapshot_workspace_memory_usage_event() from anon;
revoke all on function private.snapshot_workspace_memory_usage_event() from authenticated;

drop trigger if exists workspace_memory_usage_events_snapshot
  on public.workspace_memory_usage_events;

create trigger workspace_memory_usage_events_snapshot
before insert on public.workspace_memory_usage_events
for each row
execute function private.snapshot_workspace_memory_usage_event();


-- Backfill any pre-M3 usage rows before memory management starts mutating their
-- targets. Production currently has no usage rows, but this makes the migration
-- safe for staging / future restores that already contain M2 usage history.
update public.workspace_memory_usage_events usage
set metadata = coalesce(usage.metadata, '{}'::jsonb)
  || jsonb_build_object(
    'memory_target_entity_type', mem.target_entity_type,
    'memory_target_entity_id', mem.target_entity_id,
    'memory_source_value', mem.source_value,
    'memory_source', mem.source,
    'memory_confidence', mem.confidence,
    'memory_verification_state', mem.verification_state,
    'memory_verified_at', mem.verified_at,
    'memory_customer_id', mem.customer_id
  )
from public.workspace_memory_entries mem
where mem.id = usage.memory_id
  and not (coalesce(usage.metadata, '{}'::jsonb) ? 'memory_target_entity_id');


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
    coalesce(
      nullif(usage.metadata ->> 'memory_source_value', ''),
      mem.source_value
    ) as source_value,
    coalesce(
      nullif(usage.metadata ->> 'memory_target_entity_id', '')::uuid,
      mem.target_entity_id
    ) as target_product_id,
    coalesce(
      nullif(usage.metadata ->> 'memory_verification_state', ''),
      mem.verification_state
    ) as verification_state,
    coalesce(
      nullif(usage.metadata ->> 'memory_source', ''),
      mem.source
    ) as memory_source,
    coalesce(
      nullif(usage.metadata ->> 'memory_confidence', '')::numeric,
      mem.confidence
    ) as confidence,
    coalesce(
      nullif(usage.metadata ->> 'memory_verified_at', '')::timestamptz,
      mem.verified_at
    ) as verified_at,
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
  where l.rfq_id = target_rfq_id
    and l.organization_id = target_org_id
    and coalesce(
      nullif(usage.metadata ->> 'memory_target_entity_id', '')::uuid,
      mem.target_entity_id
    ) = l.selected_product_id
  order by l.id, usage.used_at desc;
end;
$$;

revoke all on function public.get_rfq_product_memory_explanations_server(uuid,uuid) from public;
revoke all on function public.get_rfq_product_memory_explanations_server(uuid,uuid) from anon;
revoke all on function public.get_rfq_product_memory_explanations_server(uuid,uuid) from authenticated;
grant execute on function public.get_rfq_product_memory_explanations_server(uuid,uuid) to service_role;
