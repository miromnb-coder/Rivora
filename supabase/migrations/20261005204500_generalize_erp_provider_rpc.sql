-- ERP-A4: generalize ERP provider constraints and delivery RPCs.
--
-- Provider keys are stable lowercase slugs. "none" and "custom" are workspace
-- selection states, not native delivery providers, so they cannot be written
-- to mapping / delivery / exported-draft provider columns.

alter table public.organizations
  drop constraint if exists organizations_erp_provider_check;

alter table public.organizations
  add constraint organizations_erp_provider_check
  check (
    erp_provider ~ '^[a-z][a-z0-9_]{0,63}$'
  );

alter table public.erp_entity_mappings
  drop constraint if exists erp_entity_mappings_provider_check;

alter table public.erp_entity_mappings
  add constraint erp_entity_mappings_provider_check
  check (
    provider ~ '^[a-z][a-z0-9_]{0,63}$'
    and provider not in ('none', 'custom')
  );

alter table public.erp_delivery_attempts
  drop constraint if exists erp_delivery_attempts_provider_check;

alter table public.erp_delivery_attempts
  add constraint erp_delivery_attempts_provider_check
  check (
    provider ~ '^[a-z][a-z0-9_]{0,63}$'
    and provider not in ('none', 'custom')
  );

alter table public.sales_order_drafts
  drop constraint if exists sales_order_drafts_erp_provider_check;

alter table public.sales_order_drafts
  add constraint sales_order_drafts_erp_provider_check
  check (
    erp_provider is null
    or (
      erp_provider ~ '^[a-z][a-z0-9_]{0,63}$'
      and erp_provider not in ('none', 'custom')
    )
  );

comment on column public.organizations.erp_provider is
  'Workspace ERP selection. Native provider keys use lowercase slugs. custom means another ERP is desired but not yet natively connected; none disables ERP export UI.';

comment on column public.erp_entity_mappings.provider is
  'Native ERP adapter key that owns this customer/product mapping.';

comment on column public.erp_delivery_attempts.provider is
  'Native ERP adapter key used for this delivery attempt.';

comment on column public.sales_order_drafts.erp_provider is
  'Native ERP adapter key used for export. Null until an ERP delivery attempt starts.';


create or replace function public.begin_erp_delivery_attempt_server(
  target_sales_order_draft_id uuid,
  target_provider text,
  target_request_payload jsonb,
  target_actor_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_org uuid;
  target_status text;
  workspace_provider text;
  next_attempt integer;
  created_attempt uuid;
begin
  if target_actor_id is null then
    raise exception 'Actor is required';
  end if;

  target_provider := lower(trim(coalesce(target_provider, '')));

  if target_provider !~ '^[a-z][a-z0-9_]{0,63}$'
     or target_provider in ('none', 'custom') then
    raise exception 'Invalid native ERP provider';
  end if;

  if jsonb_typeof(coalesce(target_request_payload, '{}'::jsonb)) <> 'object' then
    raise exception 'ERP request payload must be a JSON object';
  end if;

  select d.organization_id, d.status, o.erp_provider
  into target_org, target_status, workspace_provider
  from public.sales_order_drafts d
  join public.organizations o on o.id = d.organization_id
  where d.id = target_sales_order_draft_id
  for update of d;

  if target_org is null then
    raise exception 'Sales order draft not found';
  end if;

  if workspace_provider <> target_provider then
    raise exception 'ERP provider does not match the workspace ERP selection';
  end if;

  if not exists (
    select 1
    from public.organization_members m
    where m.organization_id = target_org
      and m.user_id = target_actor_id
      and m.role in ('owner','admin')
  ) then
    raise exception 'Owner or admin access is required for ERP export';
  end if;

  if target_status not in ('draft','erp_failed') then
    raise exception 'Sales order draft is not eligible for ERP export';
  end if;

  if exists (
    select 1
    from public.erp_delivery_attempts a
    where a.sales_order_draft_id = target_sales_order_draft_id
      and a.status in ('pending','created','partial','existing')
  ) then
    raise exception 'An ERP attempt already exists or requires review';
  end if;

  select coalesce(max(a.attempt_no), 0) + 1
  into next_attempt
  from public.erp_delivery_attempts a
  where a.sales_order_draft_id = target_sales_order_draft_id;

  insert into public.erp_delivery_attempts(
    organization_id,
    sales_order_draft_id,
    provider,
    attempt_no,
    status,
    request_payload,
    created_by
  )
  values (
    target_org,
    target_sales_order_draft_id,
    target_provider,
    next_attempt,
    'pending',
    coalesce(target_request_payload, '{}'::jsonb),
    target_actor_id
  )
  returning id into created_attempt;

  update public.sales_order_drafts
  set status = 'erp_pending',
      erp_provider = target_provider,
      erp_error = null,
      updated_at = now()
  where id = target_sales_order_draft_id
    and organization_id = target_org;

  return created_attempt;
end;
$$;

revoke all on function public.begin_erp_delivery_attempt_server(uuid,text,jsonb,uuid) from public;
revoke all on function public.begin_erp_delivery_attempt_server(uuid,text,jsonb,uuid) from anon;
revoke all on function public.begin_erp_delivery_attempt_server(uuid,text,jsonb,uuid) from authenticated;
grant execute on function public.begin_erp_delivery_attempt_server(uuid,text,jsonb,uuid) to service_role;


create or replace function public.finish_erp_delivery_attempt_server(
  target_attempt_id uuid,
  target_status text,
  target_external_order_id text,
  target_external_order_number text,
  target_error_message text,
  target_response_summary jsonb,
  target_actor_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_org uuid;
  target_draft uuid;
  attempt_provider text;
  current_status text;
  draft_provider text;
  draft_status text;
begin
  if target_actor_id is null then
    raise exception 'Actor is required';
  end if;

  if target_status not in ('created','partial','existing','failed') then
    raise exception 'Unsupported ERP attempt result';
  end if;

  if jsonb_typeof(coalesce(target_response_summary, '{}'::jsonb)) <> 'object' then
    raise exception 'ERP response summary must be a JSON object';
  end if;

  select a.organization_id, a.sales_order_draft_id, a.provider, a.status
  into target_org, target_draft, attempt_provider, current_status
  from public.erp_delivery_attempts a
  where a.id = target_attempt_id
  for update;

  if target_org is null then
    raise exception 'ERP delivery attempt not found';
  end if;

  if not exists (
    select 1
    from public.organization_members m
    where m.organization_id = target_org
      and m.user_id = target_actor_id
      and m.role in ('owner','admin')
  ) then
    raise exception 'Owner or admin access is required for ERP export';
  end if;

  if current_status <> 'pending' then
    raise exception 'ERP delivery attempt is already completed';
  end if;

  select d.erp_provider
  into draft_provider
  from public.sales_order_drafts d
  where d.id = target_draft
    and d.organization_id = target_org
  for update;

  if draft_provider is distinct from attempt_provider then
    raise exception 'ERP delivery attempt provider does not match the sales order draft';
  end if;

  draft_status := case
    when target_status = 'created' then 'erp_created'
    when target_status in ('partial','existing') then 'erp_partial'
    else 'erp_failed'
  end;

  update public.erp_delivery_attempts
  set status = target_status,
      external_order_id = nullif(target_external_order_id, ''),
      external_order_number = nullif(target_external_order_number, ''),
      error_message = nullif(left(coalesce(target_error_message, ''), 3000), ''),
      response_summary = coalesce(target_response_summary, '{}'::jsonb),
      completed_at = now()
  where id = target_attempt_id;

  update public.sales_order_drafts
  set status = draft_status,
      external_order_id = nullif(target_external_order_id, ''),
      external_order_number = nullif(target_external_order_number, ''),
      erp_error = nullif(left(coalesce(target_error_message, ''), 3000), ''),
      updated_at = now()
  where id = target_draft
    and organization_id = target_org
    and erp_provider = attempt_provider;

  perform private.write_activity_event(
    target_org,
    'sales_order_draft',
    target_draft,
    case
      when target_status = 'created' then 'erp_sales_order_created'
      when target_status = 'existing' then 'erp_existing_order_detected'
      when target_status = 'partial' then 'erp_sales_order_partial'
      else 'erp_sales_order_failed'
    end,
    jsonb_build_object(
      'attempt_id', target_attempt_id,
      'provider', attempt_provider,
      'result', target_status,
      'external_order_id', nullif(target_external_order_id, ''),
      'external_order_number', nullif(target_external_order_number, ''),
      'error', nullif(left(coalesce(target_error_message, ''), 500), '')
    ),
    target_actor_id
  );
end;
$$;

revoke all on function public.finish_erp_delivery_attempt_server(uuid,text,text,text,text,jsonb,uuid) from public;
revoke all on function public.finish_erp_delivery_attempt_server(uuid,text,text,text,text,jsonb,uuid) from anon;
revoke all on function public.finish_erp_delivery_attempt_server(uuid,text,text,text,text,jsonb,uuid) from authenticated;
grant execute on function public.finish_erp_delivery_attempt_server(uuid,text,text,text,text,jsonb,uuid) to service_role;


create or replace function public.remove_erp_entity_mapping(
  target_provider text,
  target_entity_type text,
  target_local_entity_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_org uuid;
  old_mapping jsonb;
begin
  target_provider := lower(trim(coalesce(target_provider, '')));

  if target_provider !~ '^[a-z][a-z0-9_]{0,63}$'
     or target_provider in ('none', 'custom') then
    raise exception 'Invalid native ERP provider';
  end if;

  if target_entity_type not in ('customer','product') then
    raise exception 'Unsupported ERP mapping entity type';
  end if;

  select organization_id,
         jsonb_build_object(
           'provider', provider,
           'entity_type', entity_type,
           'local_entity_id', local_entity_id,
           'external_id', external_id,
           'external_number', external_number,
           'metadata', metadata
         )
  into target_org, old_mapping
  from public.erp_entity_mappings
  where provider = target_provider
    and entity_type = target_entity_type
    and local_entity_id = target_local_entity_id
  limit 1;

  if target_org is null then
    return;
  end if;

  if not private.has_org_role(target_org, array['owner','admin']) then
    raise exception 'Owner or admin access is required.';
  end if;

  delete from public.erp_entity_mappings
  where organization_id = target_org
    and provider = target_provider
    and entity_type = target_entity_type
    and local_entity_id = target_local_entity_id;

  perform private.write_activity_event(
    target_org,
    target_entity_type,
    target_local_entity_id,
    'erp_mapping_removed',
    jsonb_build_object(
      'provider', target_provider,
      'previous_mapping', old_mapping
    ),
    auth.uid()
  );
end;
$$;

revoke all on function public.remove_erp_entity_mapping(text,text,uuid) from public;
revoke all on function public.remove_erp_entity_mapping(text,text,uuid) from anon;
grant execute on function public.remove_erp_entity_mapping(text,text,uuid) to authenticated;
grant execute on function public.remove_erp_entity_mapping(text,text,uuid) to service_role;


-- Compatibility wrapper for any already-deployed client still using the
-- previous two-argument RPC. It resolves the active provider without assuming
-- Business Central and delegates to the provider-aware function above.
create or replace function public.remove_erp_entity_mapping(
  target_entity_type text,
  target_local_entity_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  resolved_provider text;
begin
  if (select auth.uid()) is null then
    raise exception 'Authentication required';
  end if;

  select m.provider
  into resolved_provider
  from public.erp_entity_mappings m
  join public.organizations o on o.id = m.organization_id
  where m.entity_type = target_entity_type
    and m.local_entity_id = target_local_entity_id
    and private.has_org_role(m.organization_id, array['owner','admin'])
  order by (m.provider = o.erp_provider) desc, m.updated_at desc
  limit 1;

  if resolved_provider is null then
    return;
  end if;

  perform public.remove_erp_entity_mapping(
    resolved_provider,
    target_entity_type,
    target_local_entity_id
  );
end;
$$;

revoke all on function public.remove_erp_entity_mapping(text,uuid) from public;
revoke all on function public.remove_erp_entity_mapping(text,uuid) from anon;
grant execute on function public.remove_erp_entity_mapping(text,uuid) to authenticated;
grant execute on function public.remove_erp_entity_mapping(text,uuid) to service_role;
