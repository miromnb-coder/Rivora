-- M4 — Controlled Expansion
--
-- Expands the M1-M3 Smart Memory core with two deliberately narrow scalar
-- memory types:
--   * customer_unit_alias: evidence-backed unit spelling/alias equivalence used
--     only by Quote ↔ PO reconciliation. It never performs quantity conversion.
--   * customer_po_field_alias: owner/admin-confirmed structured PO column-header
--     interpretation used only by CSV/XLSX purchase-order imports.
--
-- Safety invariants:
--   * only verified memory is reusable
--   * unit memory can only be learned atomically while a human accepts an
--     existing unit_mismatch exception with equal quantities
--   * PO-field memory can only target an allow-listed canonical field
--   * scalar memory never becomes a product/customer entity reference
--   * all privileged M4 mutation RPCs are service-role-only and actor-bound
--   * memory usage is recorded idempotently from database triggers
--   * source documents and original extracted values are never rewritten

alter table public.workspace_memory_entries
  add column if not exists target_value text;

alter table public.workspace_memory_entries
  alter column target_entity_id drop not null;

alter table public.workspace_memory_entries
  drop constraint if exists workspace_memory_entries_target_type_check;

alter table public.workspace_memory_entries
  add constraint workspace_memory_entries_target_type_check
  check (target_entity_type in ('product', 'customer', 'unit', 'po_field'));

alter table public.workspace_memory_entries
  drop constraint if exists workspace_memory_entries_target_shape_check;

alter table public.workspace_memory_entries
  add constraint workspace_memory_entries_target_shape_check
  check (
    (
      target_entity_type in ('product', 'customer')
      and target_entity_id is not null
      and target_value is null
    )
    or
    (
      target_entity_type in ('unit', 'po_field')
      and target_entity_id is null
      and target_value is not null
      and char_length(trim(target_value)) between 1 and 120
    )
  );

comment on column public.workspace_memory_entries.target_value is
  'Verified scalar target for controlled Smart Memory types such as unit aliases and PO field interpretations. Entity memories keep this null.';

create index if not exists workspace_memory_entries_scalar_lookup_idx
  on public.workspace_memory_entries(
    organization_id,
    customer_id,
    memory_type,
    source_key,
    target_value
  )
  where verification_state = 'verified'
    and target_entity_id is null;


create or replace function private.normalize_unit_memory_key(raw_value text)
returns text
language sql
immutable
set search_path = ''
as $$
  select lower(
    regexp_replace(
      trim(coalesce(raw_value, '')),
      '[[:space:].]+',
      '',
      'g'
    )
  )
$$;

revoke all on function private.normalize_unit_memory_key(text) from public;
revoke all on function private.normalize_unit_memory_key(text) from anon;
revoke all on function private.normalize_unit_memory_key(text) from authenticated;


create or replace function private.normalize_po_header_memory_key(raw_value text)
returns text
language sql
immutable
set search_path = ''
as $$
  select lower(
    regexp_replace(
      trim(coalesce(raw_value, '')),
      '[^[:alnum:]åäöÅÄÖ]+',
      '',
      'g'
    )
  )
$$;

revoke all on function private.normalize_po_header_memory_key(text) from public;
revoke all on function private.normalize_po_header_memory_key(text) from anon;
revoke all on function private.normalize_po_header_memory_key(text) from authenticated;


create or replace function private.normalize_scalar_memory_target(
  target_memory_type text,
  raw_value text
)
returns text
language plpgsql
immutable
set search_path = ''
as $$
declare
  normalized_type text := lower(trim(coalesce(target_memory_type, '')));
  normalized_value text := lower(trim(coalesce(raw_value, '')));
begin
  if normalized_type = 'customer_unit_alias' then
    normalized_value := regexp_replace(normalized_value, '[[:space:]]+', '', 'g');
    if normalized_value !~ '^[a-zåäö%°/_-]{1,40}$' then
      raise exception 'Unit alias target must be a short unit token without a conversion factor';
    end if;
    return normalized_value;
  end if;

  if normalized_type = 'customer_po_field_alias' then
    if normalized_value not in (
      'customer_sku',
      'description',
      'manufacturer',
      'manufacturer_part_number',
      'quantity',
      'unit',
      'unit_price',
      'net_unit_price',
      'discount_percent',
      'line_total'
    ) then
      raise exception 'Unsupported purchase-order field target';
    end if;
    return normalized_value;
  end if;

  raise exception 'Unsupported scalar memory type';
end;
$$;

revoke all on function private.normalize_scalar_memory_target(text,text) from public;
revoke all on function private.normalize_scalar_memory_target(text,text) from anon;
revoke all on function private.normalize_scalar_memory_target(text,text) from authenticated;


create or replace function private.validate_workspace_memory_entry()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
begin
  new.source_value := trim(new.source_value);
  new.memory_type := lower(trim(new.memory_type));
  new.source := lower(trim(new.source));
  new.target_entity_type := lower(trim(new.target_entity_type));
  new.source_entity_type := nullif(lower(trim(coalesce(new.source_entity_type, ''))), '');
  new.metadata := coalesce(new.metadata, '{}'::jsonb);
  new.updated_at := now();
  new.updated_by := coalesce(new.updated_by, actor_id);

  if new.memory_type = 'customer_unit_alias' then
    new.source_key := private.normalize_unit_memory_key(new.source_value);
    new.target_value := private.normalize_scalar_memory_target(
      new.memory_type,
      new.target_value
    );
  elsif new.memory_type = 'customer_po_field_alias' then
    new.source_key := private.normalize_po_header_memory_key(new.source_value);
    new.target_value := private.normalize_scalar_memory_target(
      new.memory_type,
      new.target_value
    );
  else
    new.source_key := private.normalize_memory_key(new.source_value);
    new.target_value := nullif(trim(coalesce(new.target_value, '')), '');
  end if;

  if tg_op = 'INSERT' then
    new.created_at := coalesce(new.created_at, now());
    new.created_by := coalesce(new.created_by, actor_id);
  end if;

  if new.scope = 'customer' then
    if not exists (
      select 1
      from public.customers c
      where c.id = new.customer_id
        and c.organization_id = new.organization_id
    ) then
      raise exception 'Memory customer does not belong to the workspace';
    end if;
  end if;

  if new.memory_type in ('customer_unit_alias', 'customer_po_field_alias') then
    if new.scope <> 'customer' or new.customer_id is null then
      raise exception 'Controlled scalar memory must be customer-scoped';
    end if;

    if new.memory_type = 'customer_unit_alias'
       and new.target_entity_type <> 'unit' then
      raise exception 'Customer unit memory must target a unit value';
    end if;

    if new.memory_type = 'customer_po_field_alias'
       and new.target_entity_type <> 'po_field' then
      raise exception 'Customer PO field memory must target a PO field value';
    end if;

    if new.target_entity_id is not null then
      raise exception 'Scalar memory cannot target an entity ID';
    end if;
  elsif new.target_entity_type not in ('product', 'customer') then
    raise exception 'Existing memory types must target product or customer entities';
  end if;

  if new.target_entity_type = 'product' then
    if not exists (
      select 1
      from public.products p
      where p.id = new.target_entity_id
        and p.organization_id = new.organization_id
    ) then
      raise exception 'Memory target product does not belong to the workspace';
    end if;
  elsif new.target_entity_type = 'customer' then
    if not exists (
      select 1
      from public.customers c
      where c.id = new.target_entity_id
        and c.organization_id = new.organization_id
    ) then
      raise exception 'Memory target customer does not belong to the workspace';
    end if;
  end if;

  if new.verification_state = 'verified' then
    new.verified_by := coalesce(new.verified_by, actor_id);
    new.verified_at := coalesce(new.verified_at, now());

    if new.verified_by is null then
      raise exception 'Verified memory requires an actor';
    end if;
  end if;

  return new;
end;
$$;

revoke all on function private.validate_workspace_memory_entry() from public;
revoke all on function private.validate_workspace_memory_entry() from anon;
revoke all on function private.validate_workspace_memory_entry() from authenticated;


create or replace function private.audit_workspace_memory_entry()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  row_data public.workspace_memory_entries;
  event_name text;
  actor_id uuid;
begin
  if tg_op = 'DELETE' then
    row_data := old;
    event_name := 'memory_deleted';
    actor_id := coalesce(old.updated_by, old.created_by, (select auth.uid()));
  elsif tg_op = 'INSERT' then
    row_data := new;
    event_name := 'memory_created';
    actor_id := coalesce(new.created_by, (select auth.uid()));
  else
    row_data := new;
    event_name := case
      when old.verification_state is distinct from new.verification_state
        then 'memory_state_changed'
      when old.target_entity_type is distinct from new.target_entity_type
        or old.target_entity_id is distinct from new.target_entity_id
        or old.target_value is distinct from new.target_value
        then 'memory_target_changed'
      when old.use_count is distinct from new.use_count
        then 'memory_used'
      else 'memory_updated'
    end;
    actor_id := coalesce(new.updated_by, (select auth.uid()));
  end if;

  perform private.write_activity_event(
    row_data.organization_id,
    'workspace_memory',
    row_data.id,
    event_name,
    jsonb_build_object(
      'memory_type', row_data.memory_type,
      'scope', row_data.scope,
      'customer_id', row_data.customer_id,
      'target_entity_type', row_data.target_entity_type,
      'target_entity_id', row_data.target_entity_id,
      'target_value', row_data.target_value,
      'verification_state', row_data.verification_state,
      'source', row_data.source,
      'confidence', row_data.confidence,
      'use_count', row_data.use_count
    ),
    actor_id
  );

  return null;
end;
$$;

revoke all on function private.audit_workspace_memory_entry() from public;
revoke all on function private.audit_workspace_memory_entry() from anon;
revoke all on function private.audit_workspace_memory_entry() from authenticated;


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
      'memory_target_value', mem.target_value,
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


create or replace function private.upsert_customer_scalar_memory_internal(
  target_organization_id uuid,
  target_customer_id uuid,
  target_memory_type text,
  target_source_value text,
  target_target_value text,
  target_source text,
  target_source_entity_type text,
  target_source_entity_id uuid,
  target_metadata jsonb,
  target_actor_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  normalized_type text := lower(trim(coalesce(target_memory_type, '')));
  normalized_source text := lower(trim(coalesce(target_source, '')));
  normalized_key text;
  normalized_target text;
  normalized_entity_type text;
  existing public.workspace_memory_entries;
  memory_id uuid;
begin
  if target_actor_id is null then
    raise exception 'Actor is required';
  end if;

  if normalized_type not in ('customer_unit_alias', 'customer_po_field_alias') then
    raise exception 'Unsupported scalar memory type';
  end if;

  if normalized_source not in ('manual_confirmation', 'approved_po_reconciliation') then
    raise exception 'Unsupported scalar memory source';
  end if;

  if jsonb_typeof(coalesce(target_metadata, '{}'::jsonb)) <> 'object' then
    raise exception 'Memory metadata must be a JSON object';
  end if;

  if not exists (
    select 1
    from public.customers c
    where c.id = target_customer_id
      and c.organization_id = target_organization_id
  ) then
    raise exception 'Memory customer does not belong to the workspace';
  end if;

  normalized_key := case
    when normalized_type = 'customer_unit_alias'
      then private.normalize_unit_memory_key(target_source_value)
    else private.normalize_po_header_memory_key(target_source_value)
  end;

  if normalized_key = '' then
    raise exception 'Memory source value is required';
  end if;

  normalized_target := private.normalize_scalar_memory_target(
    normalized_type,
    target_target_value
  );
  normalized_entity_type := case
    when normalized_type = 'customer_unit_alias' then 'unit'
    else 'po_field'
  end;

  select m.*
  into existing
  from public.workspace_memory_entries m
  where m.organization_id = target_organization_id
    and m.scope = 'customer'
    and m.customer_id = target_customer_id
    and m.memory_type = normalized_type
    and m.source_key = normalized_key
  for update;

  if existing.id is not null
     and existing.verification_state = 'verified'
     and existing.target_value is distinct from normalized_target then
    raise exception 'Verified scalar memory conflicts with the requested target';
  end if;

  if existing.id is null then
    insert into public.workspace_memory_entries(
      organization_id,
      customer_id,
      scope,
      memory_type,
      source_value,
      source_key,
      target_entity_type,
      target_entity_id,
      target_value,
      confidence,
      verification_state,
      source,
      source_entity_type,
      source_entity_id,
      metadata,
      verified_by,
      verified_at,
      created_by,
      updated_by
    )
    values (
      target_organization_id,
      target_customer_id,
      'customer',
      normalized_type,
      trim(target_source_value),
      normalized_key,
      normalized_entity_type,
      null,
      normalized_target,
      100,
      'verified',
      normalized_source,
      nullif(lower(trim(coalesce(target_source_entity_type, ''))), ''),
      target_source_entity_id,
      coalesce(target_metadata, '{}'::jsonb)
        || jsonb_build_object('m4_controlled', true),
      target_actor_id,
      now(),
      target_actor_id,
      target_actor_id
    )
    returning id into memory_id;
  else
    update public.workspace_memory_entries
    set source_value = trim(target_source_value),
        target_entity_type = normalized_entity_type,
        target_entity_id = null,
        target_value = normalized_target,
        confidence = 100,
        verification_state = 'verified',
        source = normalized_source,
        source_entity_type = nullif(lower(trim(coalesce(target_source_entity_type, ''))), ''),
        source_entity_id = target_source_entity_id,
        metadata = coalesce(existing.metadata, '{}'::jsonb)
          || coalesce(target_metadata, '{}'::jsonb)
          || jsonb_build_object('m4_controlled', true),
        verified_by = target_actor_id,
        verified_at = case
          when existing.verification_state = 'verified' then existing.verified_at
          else now()
        end,
        updated_by = target_actor_id,
        updated_at = now()
    where id = existing.id
    returning id into memory_id;
  end if;

  return memory_id;
end;
$$;

revoke all on function private.upsert_customer_scalar_memory_internal(
  uuid,uuid,text,text,text,text,text,uuid,jsonb,uuid
) from public;
revoke all on function private.upsert_customer_scalar_memory_internal(
  uuid,uuid,text,text,text,text,text,uuid,jsonb,uuid
) from anon;
revoke all on function private.upsert_customer_scalar_memory_internal(
  uuid,uuid,text,text,text,text,text,uuid,jsonb,uuid
) from authenticated;


create or replace function public.upsert_customer_po_field_memory_server(
  target_customer_id uuid,
  target_source_header text,
  target_field text,
  target_metadata jsonb,
  target_actor_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_org uuid;
begin
  if target_actor_id is null then
    raise exception 'Actor is required';
  end if;

  select c.organization_id
  into target_org
  from public.customers c
  where c.id = target_customer_id;

  if target_org is null then
    raise exception 'Customer not found';
  end if;

  if not exists (
    select 1
    from public.organization_members om
    where om.organization_id = target_org
      and om.user_id = target_actor_id
      and om.role in ('owner','admin')
  ) then
    raise exception 'Owner or admin access is required';
  end if;

  return private.upsert_customer_scalar_memory_internal(
    target_org,
    target_customer_id,
    'customer_po_field_alias',
    target_source_header,
    target_field,
    'manual_confirmation',
    null,
    null,
    coalesce(target_metadata, '{}'::jsonb)
      || jsonb_build_object('kind', 'po_field_alias'),
    target_actor_id
  );
end;
$$;

revoke all on function public.upsert_customer_po_field_memory_server(
  uuid,text,text,jsonb,uuid
) from public;
revoke all on function public.upsert_customer_po_field_memory_server(
  uuid,text,text,jsonb,uuid
) from anon;
revoke all on function public.upsert_customer_po_field_memory_server(
  uuid,text,text,jsonb,uuid
) from authenticated;
grant execute on function public.upsert_customer_po_field_memory_server(
  uuid,text,text,jsonb,uuid
) to service_role;


create or replace function public.update_customer_po_field_memory_server(
  target_memory_id uuid,
  target_field text,
  target_actor_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  memory_row public.workspace_memory_entries;
  normalized_target text;
begin
  if target_actor_id is null then
    raise exception 'Actor is required';
  end if;

  select m.*
  into memory_row
  from public.workspace_memory_entries m
  where m.id = target_memory_id
  for update;

  if memory_row.id is null
     or memory_row.memory_type <> 'customer_po_field_alias'
     or memory_row.scope <> 'customer' then
    raise exception 'PO field memory not found';
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

  normalized_target := private.normalize_scalar_memory_target(
    'customer_po_field_alias',
    target_field
  );

  update public.workspace_memory_entries
  set target_entity_type = 'po_field',
      target_entity_id = null,
      target_value = normalized_target,
      confidence = 100,
      verification_state = 'verified',
      source = 'manual_confirmation',
      verified_by = target_actor_id,
      verified_at = now(),
      metadata = coalesce(metadata, '{}'::jsonb)
        || jsonb_build_object('m4_controlled', true, 'managed_in_m4', true),
      updated_by = target_actor_id,
      updated_at = now()
  where id = target_memory_id;
end;
$$;

revoke all on function public.update_customer_po_field_memory_server(uuid,text,uuid)
from public;
revoke all on function public.update_customer_po_field_memory_server(uuid,text,uuid)
from anon;
revoke all on function public.update_customer_po_field_memory_server(uuid,text,uuid)
from authenticated;
grant execute on function public.update_customer_po_field_memory_server(uuid,text,uuid)
to service_role;


create or replace function public.disable_customer_scalar_memory_server(
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

  select m.*
  into memory_row
  from public.workspace_memory_entries m
  where m.id = target_memory_id
  for update;

  if memory_row.id is null
     or memory_row.memory_type not in (
       'customer_unit_alias',
       'customer_po_field_alias'
     )
     or memory_row.scope <> 'customer' then
    raise exception 'Controlled scalar memory not found';
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
        || jsonb_build_object('m4_controlled', true, 'managed_in_m4', true),
      updated_by = target_actor_id,
      updated_at = now()
  where id = target_memory_id;
end;
$$;

revoke all on function public.disable_customer_scalar_memory_server(uuid,uuid)
from public;
revoke all on function public.disable_customer_scalar_memory_server(uuid,uuid)
from anon;
revoke all on function public.disable_customer_scalar_memory_server(uuid,uuid)
from authenticated;
grant execute on function public.disable_customer_scalar_memory_server(uuid,uuid)
to service_role;


alter table public.purchase_orders
  add column if not exists memory_context jsonb not null default '{}'::jsonb;

alter table public.purchase_orders
  drop constraint if exists purchase_orders_memory_context_object_check;

alter table public.purchase_orders
  add constraint purchase_orders_memory_context_object_check
  check (jsonb_typeof(memory_context) = 'object');

comment on column public.purchase_orders.memory_context is
  'Explainability-only snapshot of verified Smart Memory used while interpreting this PO. Source data is never rewritten.';


alter table public.purchase_order_reconciliation_lines
  add column if not exists memory_context jsonb not null default '{}'::jsonb;

alter table public.purchase_order_reconciliation_lines
  drop constraint if exists purchase_order_reconciliation_lines_memory_context_object_check;

alter table public.purchase_order_reconciliation_lines
  add constraint purchase_order_reconciliation_lines_memory_context_object_check
  check (jsonb_typeof(memory_context) = 'object');

comment on column public.purchase_order_reconciliation_lines.memory_context is
  'Explainability-only snapshot of verified Smart Memory used while comparing this PO line.';


create or replace function private.record_po_field_memory_usage()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  item jsonb;
  memory_uuid uuid;
  mem public.workspace_memory_entries;
  inserted_id uuid;
begin
  if coalesce(new.memory_context, '{}'::jsonb) = '{}'::jsonb then
    return null;
  end if;

  if jsonb_typeof(coalesce(new.memory_context -> 'po_field_memories', '[]'::jsonb)) <> 'array' then
    raise exception 'PO field memory context must be an array';
  end if;

  if new.created_by is null then
    raise exception 'PO field memory usage requires an actor';
  end if;

  if not exists (
    select 1
    from public.organization_members om
    where om.organization_id = new.organization_id
      and om.user_id = new.created_by
  ) then
    raise exception 'PO field memory usage actor must belong to the workspace';
  end if;

  for item in
    select value
    from jsonb_array_elements(
      coalesce(new.memory_context -> 'po_field_memories', '[]'::jsonb)
    )
  loop
    memory_uuid := nullif(item ->> 'memory_id', '')::uuid;

    select m.*
    into mem
    from public.workspace_memory_entries m
    where m.id = memory_uuid;

    if mem.id is null
       or mem.organization_id <> new.organization_id
       or mem.customer_id is distinct from new.customer_id
       or mem.scope <> 'customer'
       or mem.memory_type <> 'customer_po_field_alias'
       or mem.target_entity_type <> 'po_field'
       or mem.verification_state <> 'verified'
       or mem.source_key <> private.normalize_po_header_memory_key(
         item ->> 'source_header'
       )
       or mem.target_value is distinct from lower(trim(item ->> 'target_field')) then
      raise exception 'Invalid PO field Smart Memory context';
    end if;

    insert into public.workspace_memory_usage_events(
      organization_id,
      memory_id,
      source_entity_type,
      source_entity_id,
      actor_user_id,
      metadata
    )
    values (
      new.organization_id,
      mem.id,
      'purchase_order',
      new.id,
      new.created_by,
      jsonb_build_object(
        'memory_role', 'po_field_alias',
        'source_header', item ->> 'source_header',
        'target_field', item ->> 'target_field'
      )
    )
    on conflict (memory_id, source_entity_type, source_entity_id)
    do nothing
    returning id into inserted_id;

    if inserted_id is not null then
      update public.workspace_memory_entries
      set use_count = use_count + 1,
          last_used_at = now(),
          updated_by = new.created_by,
          updated_at = now()
      where id = mem.id;
    end if;

    inserted_id := null;
  end loop;

  return null;
end;
$$;

revoke all on function private.record_po_field_memory_usage() from public;
revoke all on function private.record_po_field_memory_usage() from anon;
revoke all on function private.record_po_field_memory_usage() from authenticated;

drop trigger if exists purchase_orders_memory_usage
  on public.purchase_orders;

create trigger purchase_orders_memory_usage
after insert on public.purchase_orders
for each row
when (new.memory_context <> '{}'::jsonb)
execute function private.record_po_field_memory_usage();


create or replace function private.record_po_unit_memory_usage()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  unit_context jsonb;
  memory_uuid uuid;
  mem public.workspace_memory_entries;
  po_customer uuid;
  review_actor uuid;
  inserted_id uuid;
begin
  unit_context := coalesce(new.memory_context -> 'unit_memory', '{}'::jsonb);

  if unit_context = '{}'::jsonb then
    return null;
  end if;

  memory_uuid := nullif(unit_context ->> 'memory_id', '')::uuid;

  select p.customer_id
  into po_customer
  from public.purchase_orders p
  where p.id = new.purchase_order_id
    and p.organization_id = new.organization_id;

  select r.created_by
  into review_actor
  from public.purchase_order_reconciliations r
  where r.id = new.reconciliation_id
    and r.organization_id = new.organization_id;

  if po_customer is null or review_actor is null then
    raise exception 'Unit memory usage requires reconciliation provenance';
  end if;

  select m.*
  into mem
  from public.workspace_memory_entries m
  where m.id = memory_uuid;

  if mem.id is null
     or mem.organization_id <> new.organization_id
     or mem.customer_id is distinct from po_customer
     or mem.scope <> 'customer'
     or mem.memory_type <> 'customer_unit_alias'
     or mem.target_entity_type <> 'unit'
     or mem.verification_state <> 'verified'
     or mem.source_key <> private.normalize_unit_memory_key(
       unit_context ->> 'source_unit'
     )
     or mem.target_value is distinct from private.normalize_scalar_memory_target(
       'customer_unit_alias',
       unit_context ->> 'target_unit'
     ) then
    raise exception 'Invalid unit Smart Memory context';
  end if;

  insert into public.workspace_memory_usage_events(
    organization_id,
    memory_id,
    source_entity_type,
    source_entity_id,
    actor_user_id,
    metadata
  )
  values (
    new.organization_id,
    mem.id,
    'purchase_order_line',
    new.po_line_id,
    review_actor,
    jsonb_build_object(
      'memory_role', 'unit_alias',
      'reconciliation_id', new.reconciliation_id,
      'source_unit', unit_context ->> 'source_unit',
      'target_unit', unit_context ->> 'target_unit'
    )
  )
  on conflict (memory_id, source_entity_type, source_entity_id)
  do nothing
  returning id into inserted_id;

  if inserted_id is not null then
    update public.workspace_memory_entries
    set use_count = use_count + 1,
        last_used_at = now(),
        updated_by = review_actor,
        updated_at = now()
    where id = mem.id;
  end if;

  return null;
end;
$$;

revoke all on function private.record_po_unit_memory_usage() from public;
revoke all on function private.record_po_unit_memory_usage() from anon;
revoke all on function private.record_po_unit_memory_usage() from authenticated;

drop trigger if exists purchase_order_reconciliation_lines_memory_usage
  on public.purchase_order_reconciliation_lines;

create trigger purchase_order_reconciliation_lines_memory_usage
after insert on public.purchase_order_reconciliation_lines
for each row
when (new.memory_context <> '{}'::jsonb)
execute function private.record_po_unit_memory_usage();


create or replace function private.enforce_purchase_order_reconciliation_review()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  review_actor uuid := coalesce((select auth.uid()), new.reviewed_by);
begin
  if old.review_status is distinct from new.review_status then
    if new.review_status = 'accepted' then
      if jsonb_array_length(new.exception_codes) = 0 then
        raise exception 'Clean reconciliation lines do not require exception acceptance';
      end if;

      if review_actor is null or not exists (
        select 1
        from public.organization_members om
        where om.organization_id = new.organization_id
          and om.user_id = review_actor
          and om.role in ('owner','admin','member')
      ) then
        raise exception 'Reviewer access is required to accept a purchase order exception';
      end if;

      new.reviewed_by := review_actor;
      new.reviewed_at := coalesce(new.reviewed_at, now());
    elsif old.review_status = 'accepted' then
      raise exception 'Accepted reconciliation exceptions are immutable';
    end if;
  end if;

  return new;
end;
$$;


create or replace function public.accept_purchase_order_exception_with_memory_server(
  target_reconciliation_line_id uuid,
  target_review_note text,
  remember_unit_alias boolean,
  target_actor_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  line_row public.purchase_order_reconciliation_lines;
  po_customer uuid;
  po_unit text;
  quote_unit text;
  po_quantity numeric;
  quote_quantity numeric;
  remembered_memory_id uuid;
begin
  if target_actor_id is null then
    raise exception 'Actor is required';
  end if;

  select l.*
  into line_row
  from public.purchase_order_reconciliation_lines l
  where l.id = target_reconciliation_line_id
  for update;

  if line_row.id is null then
    raise exception 'Reconciliation exception not found';
  end if;

  if line_row.review_status <> 'open' then
    raise exception 'This exception has already been reviewed';
  end if;

  if not exists (
    select 1
    from public.organization_members om
    where om.organization_id = line_row.organization_id
      and om.user_id = target_actor_id
      and om.role in ('owner','admin','member')
  ) then
    raise exception 'Reviewer access is required';
  end if;

  if remember_unit_alias then
    if not (line_row.exception_codes ? 'unit_mismatch') then
      raise exception 'Unit memory can only be learned from a unit mismatch';
    end if;

    if line_row.po_line_id is null or line_row.quote_line_id is null then
      raise exception 'Unit memory requires a paired PO and quote line';
    end if;

    select
      nullif(trim(coalesce(pol.unit, '')), ''),
      pol.quantity
    into po_unit, po_quantity
    from public.purchase_order_lines pol
    where pol.id = line_row.po_line_id
      and pol.purchase_order_id = line_row.purchase_order_id
      and pol.organization_id = line_row.organization_id;

    select
      nullif(trim(coalesce(ql.unit, '')), ''),
      ql.quantity
    into quote_unit, quote_quantity
    from public.quote_lines ql
    join public.purchase_order_reconciliations r
      on r.id = line_row.reconciliation_id
     and r.quote_id = ql.quote_id
     and r.organization_id = ql.organization_id
    where ql.id = line_row.quote_line_id
      and ql.organization_id = line_row.organization_id;

    if po_unit is null or quote_unit is null then
      raise exception 'Unit memory requires original PO and quote unit evidence';
    end if;

    if po_quantity is null
       or quote_quantity is null
       or abs(po_quantity - quote_quantity) > 0.0001 then
      raise exception 'Unit memory cannot be learned when quantities differ';
    end if;

    if private.normalize_unit_memory_key(po_unit)
       = private.normalize_unit_memory_key(quote_unit) then
      raise exception 'Equivalent unit spelling does not require new Smart Memory';
    end if;

    select p.customer_id
    into po_customer
    from public.purchase_orders p
    where p.id = line_row.purchase_order_id
      and p.organization_id = line_row.organization_id;

    if po_customer is null then
      raise exception 'Purchase order customer not found';
    end if;

    remembered_memory_id := private.upsert_customer_scalar_memory_internal(
      line_row.organization_id,
      po_customer,
      'customer_unit_alias',
      po_unit,
      quote_unit,
      'approved_po_reconciliation',
      'purchase_order_reconciliation_line',
      line_row.id,
      jsonb_build_object(
        'kind', 'unit_alias',
        'alias_only', true,
        'evidence', 'accepted_unit_mismatch',
        'purchase_order_id', line_row.purchase_order_id,
        'po_line_id', line_row.po_line_id,
        'quote_line_id', line_row.quote_line_id
      ),
      target_actor_id
    );
  end if;

  update public.purchase_order_reconciliation_lines
  set review_status = 'accepted',
      review_note = nullif(left(trim(coalesce(target_review_note, '')), 2000), ''),
      reviewed_by = target_actor_id,
      reviewed_at = now()
  where id = line_row.id;

  return remembered_memory_id;
end;
$$;

revoke all on function public.accept_purchase_order_exception_with_memory_server(
  uuid,text,boolean,uuid
) from public;
revoke all on function public.accept_purchase_order_exception_with_memory_server(
  uuid,text,boolean,uuid
) from anon;
revoke all on function public.accept_purchase_order_exception_with_memory_server(
  uuid,text,boolean,uuid
) from authenticated;
grant execute on function public.accept_purchase_order_exception_with_memory_server(
  uuid,text,boolean,uuid
) to service_role;


create or replace function public.commit_purchase_order_reconciliation(
  target_purchase_order_id uuid,
  target_quote_id uuid,
  target_algorithm_version text,
  target_header_exceptions jsonb,
  target_summary jsonb,
  target_lines jsonb
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  target_org uuid;
  target_customer uuid;
  selected_quote uuid;
  quote_customer uuid;
  quote_status text;
  next_run integer;
  reconciliation_status text;
  reconciliation_id uuid;
  header_review text;
  line_exception_count integer;
begin
  select p.organization_id, p.customer_id, p.quote_id
  into target_org, target_customer, selected_quote
  from public.purchase_orders p
  where p.id = target_purchase_order_id
  for update;

  if target_org is null then
    raise exception 'Purchase order not found';
  end if;

  if not private.has_org_role(target_org, array['owner','admin','member']) then
    raise exception 'Reviewer access is required to reconcile a purchase order';
  end if;

  if selected_quote is null or selected_quote <> target_quote_id then
    raise exception 'Purchase order is not linked to the selected quote';
  end if;

  select q.customer_id, q.status
  into quote_customer, quote_status
  from public.quotes q
  where q.id = target_quote_id
    and q.organization_id = target_org;

  if quote_customer is null or quote_customer <> target_customer then
    raise exception 'Quote customer must match purchase order customer';
  end if;

  if quote_status not in ('approved','sent') then
    raise exception 'Purchase order reconciliation requires an approved or sent quote';
  end if;

  if target_lines is null
     or jsonb_typeof(target_lines) <> 'array'
     or jsonb_array_length(target_lines) = 0 then
    raise exception 'Reconciliation payload must contain comparison lines';
  end if;

  if target_header_exceptions is null or jsonb_typeof(target_header_exceptions) <> 'array' then
    raise exception 'Header exceptions must be a JSON array';
  end if;

  if target_summary is null or jsonb_typeof(target_summary) <> 'object' then
    raise exception 'Reconciliation summary must be a JSON object';
  end if;

  select count(*)
  into line_exception_count
  from jsonb_array_elements(target_lines) item
  where jsonb_array_length(coalesce(item->'exception_codes', '[]'::jsonb)) > 0;

  reconciliation_status := case
    when jsonb_array_length(target_header_exceptions) > 0 or line_exception_count > 0
      then 'needs_review'
    else 'matched'
  end;

  header_review := case
    when jsonb_array_length(target_header_exceptions) > 0 then 'open'
    else 'not_required'
  end;

  select coalesce(max(r.run_number), 0) + 1
  into next_run
  from public.purchase_order_reconciliations r
  where r.purchase_order_id = target_purchase_order_id;

  insert into public.purchase_order_reconciliations(
    organization_id,
    purchase_order_id,
    quote_id,
    run_number,
    algorithm_version,
    status,
    header_exceptions,
    header_review_status,
    summary,
    created_by
  )
  values (
    target_org,
    target_purchase_order_id,
    target_quote_id,
    next_run,
    left(trim(target_algorithm_version), 120),
    reconciliation_status,
    target_header_exceptions,
    header_review,
    target_summary,
    (select auth.uid())
  )
  returning id into reconciliation_id;

  insert into public.purchase_order_reconciliation_lines(
    organization_id,
    reconciliation_id,
    purchase_order_id,
    po_line_id,
    quote_line_id,
    line_kind,
    match_method,
    match_score,
    exception_codes,
    review_status,
    po_snapshot,
    quote_snapshot,
    memory_context
  )
  select
    target_org,
    reconciliation_id,
    target_purchase_order_id,
    x.po_line_id,
    x.quote_line_id,
    x.line_kind,
    x.match_method,
    x.match_score,
    coalesce(x.exception_codes, '[]'::jsonb),
    x.review_status,
    x.po_snapshot,
    x.quote_snapshot,
    coalesce(x.memory_context, '{}'::jsonb)
  from jsonb_to_recordset(target_lines) as x(
    po_line_id uuid,
    quote_line_id uuid,
    line_kind text,
    match_method text,
    match_score numeric,
    exception_codes jsonb,
    review_status text,
    po_snapshot jsonb,
    quote_snapshot jsonb,
    memory_context jsonb
  );

  update public.purchase_orders
  set status = reconciliation_status,
      processing_error = null,
      updated_at = now()
  where id = target_purchase_order_id
    and organization_id = target_org;

  return reconciliation_id;
end;
$$;

revoke all on function public.commit_purchase_order_reconciliation(
  uuid,uuid,text,jsonb,jsonb,jsonb
) from public;
grant execute on function public.commit_purchase_order_reconciliation(
  uuid,uuid,text,jsonb,jsonb,jsonb
) to authenticated;
