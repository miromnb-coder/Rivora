-- M1 hardening: keep Smart Memory mutation RPCs server-only.
--
-- The first M1 migration proved the data model and conflict rules. This
-- follow-up removes authenticated SECURITY DEFINER RPC exposure and moves
-- mutations behind service-role-only functions that require an explicit,
-- verified actor ID from the server action layer.

drop function if exists public.upsert_workspace_memory_entry(
  uuid,uuid,text,text,text,text,uuid,text,numeric,text,text,uuid,jsonb
);

drop function if exists public.set_workspace_memory_state(uuid,text);
drop function if exists public.record_workspace_memory_usage(uuid);


create or replace function public.upsert_workspace_memory_entry_server(
  target_organization_id uuid,
  target_customer_id uuid,
  target_scope text,
  target_memory_type text,
  target_source_value text,
  target_entity_type text,
  target_entity_id uuid,
  target_source text,
  target_confidence numeric,
  target_verification_state text,
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
  normalized_scope text := lower(trim(coalesce(target_scope, '')));
  normalized_type text := lower(trim(coalesce(target_memory_type, '')));
  normalized_key text := private.normalize_memory_key(target_source_value);
  normalized_target_type text := lower(trim(coalesce(target_entity_type, '')));
  normalized_source text := lower(trim(coalesce(target_source, '')));
  normalized_state text := lower(trim(coalesce(target_verification_state, '')));
  existing public.workspace_memory_entries;
  memory_id uuid;
begin
  if target_actor_id is null then
    raise exception 'Actor is required';
  end if;

  if not exists (
    select 1
    from public.organization_members m
    where m.organization_id = target_organization_id
      and m.user_id = target_actor_id
      and m.role in ('owner','admin','member')
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
      coalesce(target_confidence, 100),
      normalized_state,
      normalized_source,
      nullif(lower(trim(coalesce(target_source_entity_type, ''))), ''),
      target_source_entity_id,
      coalesce(target_metadata, '{}'::jsonb),
      case when normalized_state = 'verified' then target_actor_id else null end,
      case when normalized_state = 'verified' then now() else null end,
      target_actor_id,
      target_actor_id
    )
    returning id into memory_id;
  else
    update public.workspace_memory_entries
    set target_entity_type = normalized_target_type,
        target_entity_id = target_entity_id,
        confidence = coalesce(target_confidence, 100),
        verification_state = normalized_state,
        source = normalized_source,
        source_entity_type = nullif(lower(trim(coalesce(target_source_entity_type, ''))), ''),
        source_entity_id = target_source_entity_id,
        metadata = coalesce(existing.metadata, '{}'::jsonb)
          || coalesce(target_metadata, '{}'::jsonb),
        verified_by = case
          when normalized_state = 'verified' then target_actor_id
          else existing.verified_by
        end,
        verified_at = case
          when normalized_state = 'verified' then now()
          else existing.verified_at
        end,
        updated_by = target_actor_id,
        updated_at = now()
    where id = existing.id
    returning id into memory_id;
  end if;

  return memory_id;
end;
$$;

revoke all on function public.upsert_workspace_memory_entry_server(
  uuid,uuid,text,text,text,text,uuid,text,numeric,text,text,uuid,jsonb,uuid
) from public;
revoke all on function public.upsert_workspace_memory_entry_server(
  uuid,uuid,text,text,text,text,uuid,text,numeric,text,text,uuid,jsonb,uuid
) from anon;
revoke all on function public.upsert_workspace_memory_entry_server(
  uuid,uuid,text,text,text,text,uuid,text,numeric,text,text,uuid,jsonb,uuid
) from authenticated;
grant execute on function public.upsert_workspace_memory_entry_server(
  uuid,uuid,text,text,text,text,uuid,text,numeric,text,text,uuid,jsonb,uuid
) to service_role;


create or replace function public.set_workspace_memory_state_server(
  target_memory_id uuid,
  target_state text,
  target_actor_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_org uuid;
  normalized_state text := lower(trim(coalesce(target_state, '')));
begin
  if target_actor_id is null then
    raise exception 'Actor is required';
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

  if not exists (
    select 1
    from public.organization_members m
    where m.organization_id = target_org
      and m.user_id = target_actor_id
      and m.role in ('owner','admin','member')
  ) then
    raise exception 'Workspace member access is required';
  end if;

  update public.workspace_memory_entries
  set verification_state = normalized_state,
      verified_by = case
        when normalized_state = 'verified' then target_actor_id
        else verified_by
      end,
      verified_at = case
        when normalized_state = 'verified' then now()
        else verified_at
      end,
      updated_by = target_actor_id,
      updated_at = now()
  where id = target_memory_id;
end;
$$;

revoke all on function public.set_workspace_memory_state_server(uuid,text,uuid) from public;
revoke all on function public.set_workspace_memory_state_server(uuid,text,uuid) from anon;
revoke all on function public.set_workspace_memory_state_server(uuid,text,uuid) from authenticated;
grant execute on function public.set_workspace_memory_state_server(uuid,text,uuid) to service_role;


create or replace function public.record_workspace_memory_usage_server(
  target_memory_id uuid,
  target_actor_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_org uuid;
  target_state text;
begin
  if target_actor_id is null then
    raise exception 'Actor is required';
  end if;

  select m.organization_id, m.verification_state
  into target_org, target_state
  from public.workspace_memory_entries m
  where m.id = target_memory_id
  for update;

  if target_org is null then
    raise exception 'Memory entry not found';
  end if;

  if not exists (
    select 1
    from public.organization_members m
    where m.organization_id = target_org
      and m.user_id = target_actor_id
      and m.role in ('owner','admin','member')
  ) then
    raise exception 'Workspace member access is required';
  end if;

  if target_state <> 'verified' then
    raise exception 'Only verified memory can be recorded as used';
  end if;

  update public.workspace_memory_entries
  set use_count = use_count + 1,
      last_used_at = now(),
      updated_by = target_actor_id,
      updated_at = now()
  where id = target_memory_id;
end;
$$;

revoke all on function public.record_workspace_memory_usage_server(uuid,uuid) from public;
revoke all on function public.record_workspace_memory_usage_server(uuid,uuid) from anon;
revoke all on function public.record_workspace_memory_usage_server(uuid,uuid) from authenticated;
grant execute on function public.record_workspace_memory_usage_server(uuid,uuid) to service_role;
