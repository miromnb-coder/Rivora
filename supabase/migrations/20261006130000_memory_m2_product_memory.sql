-- M2 — Product Memory
--
-- Makes M1's generic memory core the canonical product-memory source for RFQ
-- matching. The legacy customer_product_mappings table remains a compatibility
-- mirror for the existing Memory UI, but it is no longer a matching source.
--
-- Safety principles:
--   * only verified product memory participates in matching
--   * remembered matches still require explicit human RFQ confirmation
--   * a verified memory cannot be silently overwritten by confirming a
--     different product
--   * usage counting is idempotent per RFQ line
--   * mutation RPCs are service-role-only and require an explicit actor

create table if not exists public.workspace_memory_usage_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  memory_id uuid not null references public.workspace_memory_entries(id) on delete cascade,
  source_entity_type text not null,
  source_entity_id uuid not null,
  actor_user_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  used_at timestamptz not null default now(),
  constraint workspace_memory_usage_events_source_type_check
    check (source_entity_type ~ '^[a-z][a-z0-9_]{0,63}$'),
  constraint workspace_memory_usage_events_metadata_object_check
    check (jsonb_typeof(metadata) = 'object'),
  constraint workspace_memory_usage_events_identity_key
    unique (memory_id, source_entity_type, source_entity_id)
);

create index if not exists workspace_memory_usage_events_org_used_idx
  on public.workspace_memory_usage_events(organization_id, used_at desc);

create index if not exists workspace_memory_usage_events_source_idx
  on public.workspace_memory_usage_events(source_entity_type, source_entity_id);

alter table public.workspace_memory_usage_events enable row level security;

drop policy if exists workspace_memory_usage_events_member_select
  on public.workspace_memory_usage_events;

create policy workspace_memory_usage_events_member_select
on public.workspace_memory_usage_events
for select
to authenticated
using (private.is_org_member(organization_id));

revoke all on table public.workspace_memory_usage_events from anon;
revoke all on table public.workspace_memory_usage_events from authenticated;
grant select on table public.workspace_memory_usage_events to authenticated;
grant select, insert, update, delete on table public.workspace_memory_usage_events to service_role;


-- Carry forward the existing Customer Memory so M2 does not forget what the
-- pilot has already learned. Rows without a historical confirming actor remain
-- proposed and therefore are never auto-reused by the new memory layer.
insert into public.workspace_memory_entries(
  organization_id,
  customer_id,
  scope,
  memory_type,
  source_value,
  source_key,
  target_entity_type,
  target_entity_id,
  confidence,
  verification_state,
  source,
  source_entity_type,
  source_entity_id,
  metadata,
  verified_by,
  verified_at,
  last_used_at,
  use_count,
  created_by,
  updated_by,
  created_at,
  updated_at
)
select
  m.organization_id,
  m.customer_id,
  'customer',
  'customer_sku_product',
  trim(m.customer_sku),
  private.normalize_memory_key(m.customer_sku),
  'product',
  m.product_id,
  greatest(0, least(100, coalesce(m.confidence, 100))),
  case when m.confirmed_by_user_id is not null then 'verified' else 'proposed' end,
  'manual_confirmation',
  'customer_product_mapping',
  m.id,
  jsonb_build_object(
    'legacy_mapping_id', m.id,
    'customer_description', m.customer_description,
    'migrated_from_legacy_memory', true
  ),
  m.confirmed_by_user_id,
  case
    when m.confirmed_by_user_id is not null
      then coalesce(m.last_used_at, m.updated_at, m.created_at)
    else null
  end,
  m.last_used_at,
  greatest(coalesce(m.times_used, 0), 0),
  m.confirmed_by_user_id,
  m.confirmed_by_user_id,
  m.created_at,
  m.updated_at
from public.customer_product_mappings m
where nullif(trim(m.customer_sku), '') is not null
on conflict (
  organization_id,
  scope,
  memory_type,
  coalesce(customer_id, '00000000-0000-0000-0000-000000000000'::uuid),
  source_key
)
do nothing;


create or replace function public.confirm_rfq_line_match_with_memory_server(
  target_line_id uuid,
  target_product_id uuid,
  remember_for_customer boolean,
  target_actor_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  org_id uuid;
  rfq_uuid uuid;
  customer_uuid uuid;
  alias_text text;
  description_text text;
  previous_product uuid;
  unresolved integer;
  memory_id uuid;
  normalized_alias text;
  existing_memory public.workspace_memory_entries;
begin
  if target_actor_id is null then
    raise exception 'Actor is required';
  end if;

  select
    l.organization_id,
    l.rfq_id,
    r.customer_id,
    l.customer_sku,
    l.raw_description,
    l.selected_product_id
  into
    org_id,
    rfq_uuid,
    customer_uuid,
    alias_text,
    description_text,
    previous_product
  from public.rfq_lines l
  join public.rfqs r on r.id = l.rfq_id
  where l.id = target_line_id
  for update of l;

  if org_id is null then
    raise exception 'RFQ line not found';
  end if;

  if not exists (
    select 1
    from public.organization_members m
    where m.organization_id = org_id
      and m.user_id = target_actor_id
      and m.role in ('owner','admin','member')
  ) then
    raise exception 'Reviewer access is required';
  end if;

  if not exists (
    select 1
    from public.products p
    where p.id = target_product_id
      and p.organization_id = org_id
      and p.active = true
  ) then
    raise exception 'Product not found';
  end if;

  normalized_alias := private.normalize_memory_key(alias_text);

  if remember_for_customer
     and customer_uuid is not null
     and normalized_alias <> '' then

    select m.*
    into existing_memory
    from public.workspace_memory_entries m
    where m.organization_id = org_id
      and m.scope = 'customer'
      and m.customer_id = customer_uuid
      and m.memory_type = 'customer_sku_product'
      and m.source_key = normalized_alias
    for update;

    if existing_memory.id is not null
       and existing_memory.verification_state = 'verified'
       and (
         existing_memory.target_entity_type <> 'product'
         or existing_memory.target_entity_id <> target_product_id
       ) then
      raise exception
        'Verified Product Memory points to another product. Change the memory explicitly before replacing it.';
    end if;

    memory_id := public.upsert_workspace_memory_entry_server(
      org_id,
      customer_uuid,
      'customer',
      'customer_sku_product',
      alias_text,
      'product',
      target_product_id,
      'manual_confirmation',
      100,
      'verified',
      'rfq_line',
      target_line_id,
      jsonb_build_object(
        'customer_description', description_text,
        'rfq_id', rfq_uuid
      ),
      target_actor_id
    );

    -- Compatibility mirror for the current Customer Memory management UI.
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
      org_id,
      customer_uuid,
      trim(alias_text),
      description_text,
      target_product_id,
      100,
      'user_confirmed',
      1,
      target_actor_id,
      now()
    )
    on conflict (organization_id, customer_id, normalized_customer_sku)
    do update set
      customer_sku = excluded.customer_sku,
      customer_description = excluded.customer_description,
      product_id = excluded.product_id,
      confidence = 100,
      source = 'user_confirmed',
      times_used = public.customer_product_mappings.times_used + 1,
      confirmed_by_user_id = target_actor_id,
      last_used_at = now(),
      updated_at = now();
  end if;

  update public.rfq_lines
  set selected_product_id = target_product_id,
      match_confidence = 100,
      match_method = 'manual',
      review_status = 'confirmed',
      updated_at = now()
  where id = target_line_id
    and organization_id = org_id;

  insert into public.match_feedback(
    organization_id,
    rfq_line_id,
    selected_product_id,
    previous_product_id,
    remember_for_customer,
    user_id
  )
  values (
    org_id,
    target_line_id,
    target_product_id,
    previous_product,
    remember_for_customer,
    target_actor_id
  );

  select count(*) into unresolved
  from public.rfq_lines
  where rfq_id = rfq_uuid
    and review_status <> 'confirmed';

  update public.rfqs
  set status = case when unresolved = 0 then 'ready' else 'needs_review' end,
      overall_confidence = (
        select round(avg(coalesce(match_confidence,0)), 2)
        from public.rfq_lines
        where rfq_id = rfq_uuid
      ),
      processing_error = null
  where id = rfq_uuid
    and organization_id = org_id;

  return jsonb_build_object(
    'ok', true,
    'rfq_id', rfq_uuid,
    'remaining_review_lines', unresolved,
    'remembered', remember_for_customer
      and customer_uuid is not null
      and normalized_alias <> '',
    'memory_id', memory_id
  );
end;
$$;

revoke all on function public.confirm_rfq_line_match_with_memory_server(
  uuid,uuid,boolean,uuid
) from public;
revoke all on function public.confirm_rfq_line_match_with_memory_server(
  uuid,uuid,boolean,uuid
) from anon;
revoke all on function public.confirm_rfq_line_match_with_memory_server(
  uuid,uuid,boolean,uuid
) from authenticated;
grant execute on function public.confirm_rfq_line_match_with_memory_server(
  uuid,uuid,boolean,uuid
) to service_role;


create or replace function public.refresh_rfq_matches_with_memory_server(
  target_rfq_id uuid,
  target_actor_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  org_id uuid;
  total_lines integer;
  review_lines integer;
  memory_uses integer := 0;
begin
  if target_actor_id is null then
    raise exception 'Actor is required';
  end if;

  select r.organization_id
  into org_id
  from public.rfqs r
  where r.id = target_rfq_id
  for update;

  if org_id is null then
    raise exception 'RFQ not found';
  end if;

  if not exists (
    select 1
    from public.organization_members m
    where m.organization_id = org_id
      and m.user_id = target_actor_id
      and m.role in ('owner','admin','member')
  ) then
    raise exception 'Reviewer access is required';
  end if;

  delete from public.product_match_candidates
  where rfq_line_id in (
    select id
    from public.rfq_lines
    where rfq_id = target_rfq_id
      and organization_id = org_id
  );

  with raw_candidates as (
    select
      l.id as rfq_line_id,
      mem.target_entity_id as product_id,
      100::numeric as confidence,
      'product_memory'::text as method,
      5 as method_priority
    from public.rfq_lines l
    join public.rfqs r
      on r.id = l.rfq_id
     and r.organization_id = l.organization_id
    join public.workspace_memory_entries mem
      on mem.organization_id = l.organization_id
     and mem.scope = 'customer'
     and mem.customer_id = r.customer_id
     and mem.memory_type = 'customer_sku_product'
     and mem.target_entity_type = 'product'
     and mem.source_key = private.normalize_memory_key(l.customer_sku)
     and mem.verification_state = 'verified'
    join public.products p
      on p.id = mem.target_entity_id
     and p.organization_id = l.organization_id
     and p.active = true
    where l.rfq_id = target_rfq_id
      and nullif(trim(l.customer_sku), '') is not null

    union all

    select l.id, p.id, 99::numeric, 'exact_sku'::text, 3
    from public.rfq_lines l
    join public.products p
      on p.organization_id = l.organization_id
     and p.active = true
     and p.normalized_sku = l.normalized_customer_sku
    where l.rfq_id = target_rfq_id
      and l.normalized_customer_sku <> ''

    union all

    select l.id, p.id, 97::numeric, 'exact_mpn'::text, 2
    from public.rfq_lines l
    join public.products p
      on p.organization_id = l.organization_id
     and p.active = true
     and p.normalized_mpn <> ''
     and p.normalized_mpn = l.normalized_customer_sku
    where l.rfq_id = target_rfq_id
      and l.normalized_customer_sku <> ''

    union all

    select
      l.id,
      p.id,
      least(
        89,
        round(
          greatest(
            extensions.similarity(l.normalized_text, p.normalized_search),
            extensions.similarity(l.normalized_customer_sku, p.normalized_sku)
          ) * 100
        )
      )::numeric,
      'fuzzy'::text,
      1
    from public.rfq_lines l
    join public.products p
      on p.organization_id = l.organization_id
     and p.active = true
    where l.rfq_id = target_rfq_id
      and greatest(
        extensions.similarity(l.normalized_text, p.normalized_search),
        extensions.similarity(l.normalized_customer_sku, p.normalized_sku)
      ) >= 0.25
  ),
  dedup as (
    select distinct on (rfq_line_id, product_id)
      rfq_line_id,
      product_id,
      confidence,
      method,
      method_priority
    from raw_candidates
    order by
      rfq_line_id,
      product_id,
      confidence desc,
      method_priority desc
  ),
  ranked as (
    select
      d.*,
      row_number() over (
        partition by rfq_line_id
        order by confidence desc, method_priority desc, product_id
      ) as candidate_rank
    from dedup d
  )
  insert into public.product_match_candidates(
    organization_id,
    rfq_line_id,
    product_id,
    confidence,
    method,
    rank
  )
  select
    org_id,
    rfq_line_id,
    product_id,
    confidence,
    method,
    candidate_rank
  from ranked
  where candidate_rank <= 5;

  update public.rfq_lines l
  set selected_product_id = best.product_id,
      match_confidence = best.confidence,
      match_method = best.method,
      review_status = 'needs_review',
      updated_at = now()
  from (
    select distinct on (rfq_line_id)
      rfq_line_id,
      product_id,
      confidence,
      method
    from public.product_match_candidates
    where rfq_line_id in (
      select id
      from public.rfq_lines
      where rfq_id = target_rfq_id
        and organization_id = org_id
    )
    order by rfq_line_id, rank
  ) best
  where l.id = best.rfq_line_id
    and l.organization_id = org_id;

  update public.rfq_lines l
  set selected_product_id = null,
      match_confidence = 0,
      match_method = null,
      review_status = 'unmatched',
      updated_at = now()
  where l.rfq_id = target_rfq_id
    and l.organization_id = org_id
    and not exists (
      select 1
      from public.product_match_candidates c
      where c.rfq_line_id = l.id
    );

  -- Count each remembered suggestion once per RFQ line, even if matching is
  -- retried. The usage event is the idempotency key. The legacy mapping table
  -- is updated only as a compatibility mirror for the current Memory UI.
  with matching_memory as (
    select
      mem.id as memory_id,
      l.id as rfq_line_id
    from public.rfq_lines l
    join public.rfqs r
      on r.id = l.rfq_id
     and r.organization_id = l.organization_id
    join public.workspace_memory_entries mem
      on mem.organization_id = l.organization_id
     and mem.scope = 'customer'
     and mem.customer_id = r.customer_id
     and mem.memory_type = 'customer_sku_product'
     and mem.target_entity_type = 'product'
     and mem.target_entity_id = l.selected_product_id
     and mem.source_key = private.normalize_memory_key(l.customer_sku)
     and mem.verification_state = 'verified'
    where l.rfq_id = target_rfq_id
      and l.organization_id = org_id
      and l.match_method = 'product_memory'
  ),
  inserted as (
    insert into public.workspace_memory_usage_events(
      organization_id,
      memory_id,
      source_entity_type,
      source_entity_id,
      actor_user_id,
      metadata
    )
    select
      org_id,
      mm.memory_id,
      'rfq_line',
      mm.rfq_line_id,
      target_actor_id,
      jsonb_build_object('rfq_id', target_rfq_id)
    from matching_memory mm
    on conflict (memory_id, source_entity_type, source_entity_id)
    do nothing
    returning memory_id
  ),
  counts as (
    select memory_id, count(*)::integer as added_uses
    from inserted
    group by memory_id
  ),
  updated_memory as (
    update public.workspace_memory_entries m
    set use_count = m.use_count + counts.added_uses,
        last_used_at = now(),
        updated_by = target_actor_id,
        updated_at = now()
    from counts
    where m.id = counts.memory_id
    returning m.id
  ),
  updated_legacy as (
    update public.customer_product_mappings legacy
    set times_used = legacy.times_used + counts.added_uses,
        last_used_at = now(),
        updated_at = now()
    from counts
    join public.workspace_memory_entries mem
      on mem.id = counts.memory_id
    where legacy.organization_id = mem.organization_id
      and legacy.customer_id = mem.customer_id
      and legacy.product_id = mem.target_entity_id
      and private.normalize_memory_key(legacy.customer_sku) = mem.source_key
    returning legacy.id
  )
  select count(*)::integer
  into memory_uses
  from inserted;

  select count(*) into total_lines
  from public.rfq_lines
  where rfq_id = target_rfq_id
    and organization_id = org_id;

  select count(*) into review_lines
  from public.rfq_lines
  where rfq_id = target_rfq_id
    and organization_id = org_id
    and review_status <> 'confirmed';

  update public.rfqs
  set overall_confidence = (
        select round(avg(coalesce(match_confidence,0)), 2)
        from public.rfq_lines
        where rfq_id = target_rfq_id
          and organization_id = org_id
      ),
      status = case
        when review_lines = 0 and total_lines > 0 then 'ready'
        else 'needs_review'
      end,
      processing_error = null
  where id = target_rfq_id
    and organization_id = org_id;

  return jsonb_build_object(
    'rfq_id', target_rfq_id,
    'total_lines', total_lines,
    'review_lines', review_lines,
    'ready', review_lines = 0 and total_lines > 0,
    'product_memory_rows_used', memory_uses
  );
end;
$$;

revoke all on function public.refresh_rfq_matches_with_memory_server(uuid,uuid) from public;
revoke all on function public.refresh_rfq_matches_with_memory_server(uuid,uuid) from anon;
revoke all on function public.refresh_rfq_matches_with_memory_server(uuid,uuid) from authenticated;
grant execute on function public.refresh_rfq_matches_with_memory_server(uuid,uuid) to service_role;


create or replace function public.update_customer_product_memory_server(
  target_mapping_id uuid,
  target_product_id uuid,
  target_actor_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  mapping_row public.customer_product_mappings;
  normalized_alias text;
  existing_memory public.workspace_memory_entries;
begin
  if target_actor_id is null then
    raise exception 'Actor is required';
  end if;

  select m.*
  into mapping_row
  from public.customer_product_mappings m
  where m.id = target_mapping_id
  for update;

  if mapping_row.id is null then
    raise exception 'Customer Memory mapping not found';
  end if;

  if not exists (
    select 1
    from public.organization_members om
    where om.organization_id = mapping_row.organization_id
      and om.user_id = target_actor_id
      and om.role in ('owner','admin','member')
  ) then
    raise exception 'Reviewer access is required';
  end if;

  if not exists (
    select 1
    from public.products p
    where p.id = target_product_id
      and p.organization_id = mapping_row.organization_id
      and p.active = true
  ) then
    raise exception 'Active catalogue product not found';
  end if;

  update public.customer_product_mappings
  set product_id = target_product_id,
      confidence = 100,
      source = 'user_confirmed',
      confirmed_by_user_id = target_actor_id,
      updated_at = now()
  where id = mapping_row.id;

  normalized_alias := private.normalize_memory_key(mapping_row.customer_sku);

  select m.*
  into existing_memory
  from public.workspace_memory_entries m
  where m.organization_id = mapping_row.organization_id
    and m.scope = 'customer'
    and m.customer_id = mapping_row.customer_id
    and m.memory_type = 'customer_sku_product'
    and m.source_key = normalized_alias
  for update;

  if existing_memory.id is null then
    perform public.upsert_workspace_memory_entry_server(
      mapping_row.organization_id,
      mapping_row.customer_id,
      'customer',
      'customer_sku_product',
      mapping_row.customer_sku,
      'product',
      target_product_id,
      'manual_confirmation',
      100,
      'verified',
      'customer_product_mapping',
      mapping_row.id,
      jsonb_build_object(
        'customer_description', mapping_row.customer_description,
        'legacy_mapping_id', mapping_row.id
      ),
      target_actor_id
    );
  else
    update public.workspace_memory_entries
    set target_entity_type = 'product',
        target_entity_id = target_product_id,
        confidence = 100,
        verification_state = 'verified',
        source = 'manual_confirmation',
        source_entity_type = 'customer_product_mapping',
        source_entity_id = mapping_row.id,
        metadata = coalesce(metadata, '{}'::jsonb)
          || jsonb_build_object(
            'customer_description', mapping_row.customer_description,
            'legacy_mapping_id', mapping_row.id
          ),
        verified_by = target_actor_id,
        verified_at = now(),
        updated_by = target_actor_id,
        updated_at = now()
    where id = existing_memory.id;
  end if;
end;
$$;

revoke all on function public.update_customer_product_memory_server(uuid,uuid,uuid) from public;
revoke all on function public.update_customer_product_memory_server(uuid,uuid,uuid) from anon;
revoke all on function public.update_customer_product_memory_server(uuid,uuid,uuid) from authenticated;
grant execute on function public.update_customer_product_memory_server(uuid,uuid,uuid) to service_role;


create or replace function public.disable_customer_product_memory_server(
  target_mapping_id uuid,
  target_actor_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  mapping_row public.customer_product_mappings;
  normalized_alias text;
begin
  if target_actor_id is null then
    raise exception 'Actor is required';
  end if;

  select m.*
  into mapping_row
  from public.customer_product_mappings m
  where m.id = target_mapping_id
  for update;

  if mapping_row.id is null then
    raise exception 'Customer Memory mapping not found';
  end if;

  if not exists (
    select 1
    from public.organization_members om
    where om.organization_id = mapping_row.organization_id
      and om.user_id = target_actor_id
      and om.role in ('owner','admin')
  ) then
    raise exception 'Owner or admin access is required';
  end if;

  normalized_alias := private.normalize_memory_key(mapping_row.customer_sku);

  update public.workspace_memory_entries
  set verification_state = 'disabled',
      updated_by = target_actor_id,
      updated_at = now()
  where organization_id = mapping_row.organization_id
    and scope = 'customer'
    and customer_id = mapping_row.customer_id
    and memory_type = 'customer_sku_product'
    and source_key = normalized_alias;

  delete from public.customer_product_mappings
  where id = mapping_row.id;
end;
$$;

revoke all on function public.disable_customer_product_memory_server(uuid,uuid) from public;
revoke all on function public.disable_customer_product_memory_server(uuid,uuid) from anon;
revoke all on function public.disable_customer_product_memory_server(uuid,uuid) from authenticated;
grant execute on function public.disable_customer_product_memory_server(uuid,uuid) to service_role;
