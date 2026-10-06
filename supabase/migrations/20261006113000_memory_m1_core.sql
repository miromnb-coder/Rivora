-- M1 — Smart Memory Core
--
-- Structured, auditable workspace memory for confirmed business decisions.
-- This migration adds the persistence/security layer only; it does not yet
-- change RFQ matching behavior or automatically create memory entries.

create schema if not exists private;


create or replace function private.normalize_memory_key(raw_value text)
returns text
language sql
immutable
set search_path = ''
as $$
  select lower(
    regexp_replace(
      trim(coalesce(raw_value, '')),
      '[[:space:]]+',
      ' ',
      'g'
    )
  )
$$;

revoke all on function private.normalize_memory_key(text) from public;
revoke all on function private.normalize_memory_key(text) from anon;
revoke all on function private.normalize_memory_key(text) from authenticated;


create table if not exists public.workspace_memory_entries (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  customer_id uuid references public.customers(id) on delete cascade,
  scope text not null default 'customer',
  memory_type text not null,
  source_value text not null,
  source_key text not null,
  target_entity_type text not null,
  target_entity_id uuid not null,
  confidence numeric(5,2) not null default 100,
  verification_state text not null default 'proposed',
  source text not null,
  source_entity_type text,
  source_entity_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  verified_by uuid,
  verified_at timestamptz,
  last_used_at timestamptz,
  use_count integer not null default 0,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint workspace_memory_entries_scope_check
    check (scope in ('customer', 'workspace')),

  constraint workspace_memory_entries_customer_scope_check
    check (
      (scope = 'customer' and customer_id is not null)
      or
      (scope = 'workspace' and customer_id is null)
    ),

  constraint workspace_memory_entries_memory_type_check
    check (memory_type ~ '^[a-z][a-z0-9_]{0,63}$'),

  constraint workspace_memory_entries_source_value_check
    check (
      char_length(trim(source_value)) between 1 and 500
      and char_length(source_key) between 1 and 500
    ),

  constraint workspace_memory_entries_target_type_check
    check (target_entity_type in ('product', 'customer')),

  constraint workspace_memory_entries_confidence_check
    check (confidence >= 0 and confidence <= 100),

  constraint workspace_memory_entries_verification_state_check
    check (verification_state in ('proposed', 'verified', 'conflict', 'disabled')),

  constraint workspace_memory_entries_source_check
    check (
      source in (
        'manual_confirmation',
        'approved_quote',
        'approved_po_reconciliation',
        'verified_erp_mapping',
        'system_import'
      )
    ),

  constraint workspace_memory_entries_source_entity_type_check
    check (
      source_entity_type is null
      or source_entity_type ~ '^[a-z][a-z0-9_]{0,63}$'
    ),

  constraint workspace_memory_entries_metadata_object_check
    check (jsonb_typeof(metadata) = 'object'),

  constraint workspace_memory_entries_use_count_check
    check (use_count >= 0),

  constraint workspace_memory_entries_verified_state_check
    check (
      verification_state <> 'verified'
      or (verified_by is not null and verified_at is not null)
    )
);

comment on table public.workspace_memory_entries is
  'Structured Averomira memory. Confirmed customer/workspace decisions are reusable only when verification_state=verified.';

comment on column public.workspace_memory_entries.source_value is
  'Original human/business value that was remembered, for example a customer SKU or alias.';

comment on column public.workspace_memory_entries.source_key is
  'Normalized exact-match key generated from source_value.';

comment on column public.workspace_memory_entries.verification_state is
  'proposed is advisory only; verified may be reused; conflict and disabled must never be auto-applied.';

comment on column public.workspace_memory_entries.source is
  'Auditable origin of the memory decision.';

comment on column public.workspace_memory_entries.metadata is
  'Non-secret supporting context only. Do not store credentials, document bodies, or raw authentication data.';


create unique index if not exists workspace_memory_entries_identity_key
  on public.workspace_memory_entries (
    organization_id,
    scope,
    memory_type,
    coalesce(customer_id, '00000000-0000-0000-0000-000000000000'::uuid),
    source_key
  );

create index if not exists workspace_memory_entries_customer_lookup_idx
  on public.workspace_memory_entries (
    organization_id,
    customer_id,
    memory_type,
    source_key
  )
  where verification_state = 'verified';

create index if not exists workspace_memory_entries_workspace_lookup_idx
  on public.workspace_memory_entries (
    organization_id,
    memory_type,
    source_key
  )
  where scope = 'workspace'
    and verification_state = 'verified';

create index if not exists workspace_memory_entries_target_idx
  on public.workspace_memory_entries (
    organization_id,
    target_entity_type,
    target_entity_id
  );

create index if not exists workspace_memory_entries_recent_use_idx
  on public.workspace_memory_entries (
    organization_id,
    last_used_at desc nulls last
  );


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
  new.source_key := private.normalize_memory_key(new.source_value);
  new.memory_type := lower(trim(new.memory_type));
  new.source := lower(trim(new.source));
  new.target_entity_type := lower(trim(new.target_entity_type));
  new.source_entity_type := nullif(lower(trim(coalesce(new.source_entity_type, ''))), '');
  new.metadata := coalesce(new.metadata, '{}'::jsonb);
  new.updated_at := now();
  new.updated_by := coalesce(new.updated_by, actor_id);

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

drop trigger if exists workspace_memory_entries_validate
  on public.workspace_memory_entries;

create trigger workspace_memory_entries_validate
before insert or update on public.workspace_memory_entries
for each row
execute function private.validate_workspace_memory_entry();


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
        then 'memory_target_changed'
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
      'verification_state', row_data.verification_state,
      'source', row_data.source,
      'confidence', row_data.confidence,
      'use_count', row_data.use_count
    ),
    actor_id
  );

  return coalesce(new, old);
end;
$$;

revoke all on function private.audit_workspace_memory_entry() from public;
revoke all on function private.audit_workspace_memory_entry() from anon;
revoke all on function private.audit_workspace_memory_entry() from authenticated;

drop trigger if exists workspace_memory_entries_audit
  on public.workspace_memory_entries;

create trigger workspace_memory_entries_audit
after insert or update or delete on public.workspace_memory_entries
for each row
execute function private.audit_workspace_memory_entry();


alter table public.workspace_memory_entries enable row level security;

drop policy if exists workspace_memory_entries_member_select
  on public.workspace_memory_entries;

create policy workspace_memory_entries_member_select
on public.workspace_memory_entries
for select
to authenticated
using (private.is_org_member(organization_id));

revoke all on table public.workspace_memory_entries from anon;
revoke all on table public.workspace_memory_entries from authenticated;
grant select on table public.workspace_memory_entries to authenticated;
grant select, insert, update, delete on table public.workspace_memory_entries to service_role;


create or replace function public.upsert_workspace_memory_entry(
  target_organization_id uuid,
  target_customer_id uuid,
  target_scope text,
  target_memory_type text,
  target_source_value text,
  target_entity_type text,
  target_entity_id uuid,
  target_source text,
  target_confidence numeric default 100,
  target_verification_state text default 'verified',
  target_source_entity_type text default null,
  target_source_entity_id uuid default null,
  target_metadata jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
  normalized_scope text := lower(trim(coalesce(target_scope, '')));
  normalized_type text := lower(trim(coalesce(target_memory_type, '')));
  normalized_key text := private.normalize_memory_key(target_source_value);
  normalized_target_type text := lower(trim(coalesce(target_entity_type, '')));
  normalized_source text := lower(trim(coalesce(target_source, '')));
  normalized_state text := lower(trim(coalesce(target_verification_state, '')));
  existing public.workspace_memory_entries;
  memory_id uuid;
begin
  if actor_id is null then
    raise exception 'Authentication required';
  end if;

  if not private.has_org_role(
    target_organization_id,
    array['owner','admin','member']
  ) then
    raise exception 'Workspace member access is required';
  end if;

  if normalized_scope not in ('customer','workspace') then
    raise exception 'Unsupported memory scope';
  end if;

  if normalized_state not in ('proposed','verified','conflict','disabled') then
    raise exception 'Unsupported memory verification state';
  end if;

  if jsonb_typeof(coalesce(target_metadata, '{}'::jsonb)) <> 'object' then
    raise exception 'Memory metadata must be a JSON object';
  end if;

  select m.*
  into existing
  from public.workspace_memory_entries m
  where m.organization_id = target_organization_id
    and m.scope = normalized_scope
    and m.memory_type = normalized_type
    and m.customer_id is not distinct from target_customer_id
    and m.source_key = normalized_key
  for update;

  if existing.id is not null
     and existing.verification_state = 'verified'
     and (
       existing.target_entity_type is distinct from normalized_target_type
       or existing.target_entity_id is distinct from target_entity_id
     ) then
    raise exception 'Verified memory conflicts with the requested target';
  end if;

  if existing.id is not null
     and existing.verification_state = 'verified'
     and normalized_state <> 'verified' then
    raise exception 'Verified memory cannot be downgraded through upsert';
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
      normalized_scope,
      normalized_type,
      trim(target_source_value),
      normalized_key,
      normalized_target_type,
      target_entity_id,
      target_confidence,
      normalized_state,
      normalized_source,
      nullif(lower(trim(coalesce(target_source_entity_type, ''))), ''),
      target_source_entity_id,
      coalesce(target_metadata, '{}'::jsonb),
      case when normalized_state = 'verified' then actor_id else null end,
      case when normalized_state = 'verified' then now() else null end,
      actor_id,
      actor_id
    )
    returning id into memory_id;
  else
    update public.workspace_memory_entries
    set target_entity_type = normalized_target_type,
        target_entity_id = target_entity_id,
        confidence = target_confidence,
        verification_state = normalized_state,
        source = normalized_source,
        source_entity_type = nullif(lower(trim(coalesce(target_source_entity_type, ''))), ''),
        source_entity_id = target_source_entity_id,
        metadata = coalesce(existing.metadata, '{}'::jsonb)
          || coalesce(target_metadata, '{}'::jsonb),
        verified_by = case
          when normalized_state = 'verified' then actor_id
          else existing.verified_by
        end,
        verified_at = case
          when normalized_state = 'verified' then now()
          else existing.verified_at
        end,
        updated_by = actor_id,
        updated_at = now()
    where id = existing.id
    returning id into memory_id;
  end if;

  return memory_id;
end;
$$;

revoke all on function public.upsert_workspace_memory_entry(
  uuid,uuid,text,text,text,text,uuid,text,numeric,text,text,uuid,jsonb
) from public;
revoke all on function public.upsert_workspace_memory_entry(
  uuid,uuid,text,text,text,text,uuid,text,numeric,text,text,uuid,jsonb
) from anon;
grant execute on function public.upsert_workspace_memory_entry(
  uuid,uuid,text,text,text,text,uuid,text,numeric,text,text,uuid,jsonb
) to authenticated;
grant execute on function public.upsert_workspace_memory_entry(
  uuid,uuid,text,text,text,text,uuid,text,numeric,text,text,uuid,jsonb
) to service_role;


create or replace function public.set_workspace_memory_state(
  target_memory_id uuid,
  target_state text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
  target_org uuid;
  normalized_state text := lower(trim(coalesce(target_state, '')));
begin
  if actor_id is null then
    raise exception 'Authentication required';
  end if;

  if normalized_state not in ('proposed','verified','conflict','disabled') then
    raise exception 'Unsupported memory verification state';
  end if;

  select m.organization_id
  into target_org
  from public.workspace_memory_entries m
  where m.id = target_memory_id
  for update;

  if target_org is null then
    raise exception 'Memory entry not found';
  end if;

  if not private.has_org_role(
    target_org,
    array['owner','admin','member']
  ) then
    raise exception 'Workspace member access is required';
  end if;

  update public.workspace_memory_entries
  set verification_state = normalized_state,
      verified_by = case
        when normalized_state = 'verified' then actor_id
        else verified_by
      end,
      verified_at = case
        when normalized_state = 'verified' then now()
        else verified_at
      end,
      updated_by = actor_id,
      updated_at = now()
  where id = target_memory_id;
end;
$$;

revoke all on function public.set_workspace_memory_state(uuid,text) from public;
revoke all on function public.set_workspace_memory_state(uuid,text) from anon;
grant execute on function public.set_workspace_memory_state(uuid,text) to authenticated;
grant execute on function public.set_workspace_memory_state(uuid,text) to service_role;


create or replace function public.record_workspace_memory_usage(
  target_memory_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
  target_org uuid;
  target_state text;
begin
  if actor_id is null then
    raise exception 'Authentication required';
  end if;

  select m.organization_id, m.verification_state
  into target_org, target_state
  from public.workspace_memory_entries m
  where m.id = target_memory_id
  for update;

  if target_org is null then
    raise exception 'Memory entry not found';
  end if;

  if not private.has_org_role(
    target_org,
    array['owner','admin','member']
  ) then
    raise exception 'Workspace member access is required';
  end if;

  if target_state <> 'verified' then
    raise exception 'Only verified memory can be recorded as used';
  end if;

  update public.workspace_memory_entries
  set use_count = use_count + 1,
      last_used_at = now(),
      updated_by = actor_id,
      updated_at = now()
  where id = target_memory_id;
end;
$$;

revoke all on function public.record_workspace_memory_usage(uuid) from public;
revoke all on function public.record_workspace_memory_usage(uuid) from anon;
grant execute on function public.record_workspace_memory_usage(uuid) to authenticated;
grant execute on function public.record_workspace_memory_usage(uuid) to service_role;
