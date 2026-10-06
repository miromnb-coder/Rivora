-- ERP-A5: workspace-scoped ERP connection credentials.
--
-- Non-secret connection metadata lives in public.erp_connections.
-- Provider secrets are stored only in Supabase Vault and are retrievable only
-- through a service-role-only server RPC. The browser never receives them.

create table if not exists public.erp_connections (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  provider text not null,
  configuration jsonb not null default '{}'::jsonb,
  secret_id uuid,
  status text not null default 'configured',
  verified_at timestamptz,
  verified_company_name text,
  last_error text,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint erp_connections_org_provider_key unique (organization_id, provider),
  constraint erp_connections_provider_check check (
    provider ~ '^[a-z][a-z0-9_]{0,63}$'
    and provider not in ('none', 'custom')
  ),
  constraint erp_connections_configuration_object_check check (
    jsonb_typeof(configuration) = 'object'
  ),
  constraint erp_connections_status_check check (
    status in ('configured', 'verified', 'error', 'disconnected')
  ),
  constraint erp_connections_secret_state_check check (
    status = 'disconnected' or secret_id is not null
  ),
  constraint erp_connections_no_plain_secret_check check (
    not (
      configuration ? 'clientSecret'
      or configuration ? 'client_secret'
      or configuration ? 'secret'
      or configuration ? 'password'
      or configuration ? 'accessToken'
      or configuration ? 'access_token'
      or configuration ? 'refreshToken'
      or configuration ? 'refresh_token'
    )
  )
);

create unique index if not exists erp_connections_secret_id_key
  on public.erp_connections(secret_id)
  where secret_id is not null;

create index if not exists erp_connections_org_idx
  on public.erp_connections(organization_id);

alter table public.erp_connections enable row level security;

-- No browser role receives direct table access. All connection mutations and
-- secret reads pass through server-side service-role RPCs.
revoke all on table public.erp_connections from anon;
revoke all on table public.erp_connections from authenticated;
grant select, insert, update, delete on table public.erp_connections to service_role;

comment on table public.erp_connections is
  'Workspace-scoped ERP connection metadata. Provider secrets are stored in Supabase Vault, never in configuration JSON.';
comment on column public.erp_connections.configuration is
  'Non-secret provider configuration only. Secret/password/token keys are rejected.';
comment on column public.erp_connections.secret_id is
  'Reference to an encrypted Supabase Vault secret. Never expose this value to the browser.';


create or replace function private.cleanup_erp_connection_secret()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.secret_id is not null then
    delete from vault.secrets where id = old.secret_id;
  end if;
  return old;
end;
$$;

revoke all on function private.cleanup_erp_connection_secret() from public;
revoke all on function private.cleanup_erp_connection_secret() from anon;
revoke all on function private.cleanup_erp_connection_secret() from authenticated;

drop trigger if exists erp_connections_cleanup_secret on public.erp_connections;
create trigger erp_connections_cleanup_secret
after delete on public.erp_connections
for each row execute function private.cleanup_erp_connection_secret();


create or replace function public.upsert_erp_connection_server(
  target_organization_id uuid,
  target_provider text,
  target_configuration jsonb,
  target_secret text,
  target_actor_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  connection_id uuid;
  existing_secret_id uuid;
  resolved_secret_id uuid;
  normalized_provider text;
  normalized_secret text;
begin
  if target_actor_id is null then
    raise exception 'Actor is required';
  end if;

  normalized_provider := lower(trim(coalesce(target_provider, '')));
  if normalized_provider !~ '^[a-z][a-z0-9_]{0,63}$'
     or normalized_provider in ('none', 'custom') then
    raise exception 'Invalid native ERP provider';
  end if;

  if jsonb_typeof(coalesce(target_configuration, '{}'::jsonb)) <> 'object' then
    raise exception 'ERP connection configuration must be a JSON object';
  end if;

  if target_configuration ?| array[
    'clientSecret','client_secret','secret','password',
    'accessToken','access_token','refreshToken','refresh_token'
  ] then
    raise exception 'Secrets must not be stored in ERP connection configuration';
  end if;

  if not exists (
    select 1
    from public.organization_members m
    where m.organization_id = target_organization_id
      and m.user_id = target_actor_id
      and m.role in ('owner','admin')
  ) then
    raise exception 'Owner or admin access is required to manage ERP credentials';
  end if;

  if not exists (
    select 1
    from public.organizations o
    where o.id = target_organization_id
      and o.erp_provider = normalized_provider
  ) then
    raise exception 'ERP provider does not match the workspace ERP selection';
  end if;

  select c.id, c.secret_id
  into connection_id, existing_secret_id
  from public.erp_connections c
  where c.organization_id = target_organization_id
    and c.provider = normalized_provider
  for update;

  normalized_secret := nullif(trim(coalesce(target_secret, '')), '');

  if normalized_secret is null and existing_secret_id is null then
    raise exception 'ERP client secret is required';
  end if;

  resolved_secret_id := existing_secret_id;

  if normalized_secret is not null then
    if existing_secret_id is null then
      resolved_secret_id := vault.create_secret(
        normalized_secret,
        'erp:' || target_organization_id::text || ':' || normalized_provider || ':credential',
        'Averomira workspace ERP credential'
      );
    else
      perform vault.update_secret(
        existing_secret_id,
        normalized_secret,
        'erp:' || target_organization_id::text || ':' || normalized_provider || ':credential',
        'Averomira workspace ERP credential'
      );
    end if;
  end if;

  if connection_id is null then
    insert into public.erp_connections(
      organization_id,
      provider,
      configuration,
      secret_id,
      status,
      verified_at,
      verified_company_name,
      last_error,
      created_by,
      updated_by
    )
    values (
      target_organization_id,
      normalized_provider,
      coalesce(target_configuration, '{}'::jsonb),
      resolved_secret_id,
      'configured',
      null,
      null,
      null,
      target_actor_id,
      target_actor_id
    )
    returning id into connection_id;
  else
    update public.erp_connections
    set configuration = coalesce(target_configuration, '{}'::jsonb),
        secret_id = resolved_secret_id,
        status = 'configured',
        verified_at = null,
        verified_company_name = null,
        last_error = null,
        updated_by = target_actor_id,
        updated_at = now()
    where id = connection_id;
  end if;

  perform private.write_activity_event(
    target_organization_id,
    'erp_connection',
    connection_id,
    'erp_connection_configured',
    jsonb_build_object('provider', normalized_provider),
    target_actor_id
  );

  return connection_id;
end;
$$;

revoke all on function public.upsert_erp_connection_server(uuid,text,jsonb,text,uuid) from public;
revoke all on function public.upsert_erp_connection_server(uuid,text,jsonb,text,uuid) from anon;
revoke all on function public.upsert_erp_connection_server(uuid,text,jsonb,text,uuid) from authenticated;
grant execute on function public.upsert_erp_connection_server(uuid,text,jsonb,text,uuid) to service_role;


create or replace function public.get_erp_connection_secret_server(
  target_organization_id uuid,
  target_provider text
)
returns text
language sql
security definer
set search_path = ''
stable
as $$
  select ds.decrypted_secret
  from public.erp_connections c
  join vault.decrypted_secrets ds on ds.id = c.secret_id
  where c.organization_id = target_organization_id
    and c.provider = lower(trim(target_provider))
    and c.status <> 'disconnected'
  limit 1
$$;

revoke all on function public.get_erp_connection_secret_server(uuid,text) from public;
revoke all on function public.get_erp_connection_secret_server(uuid,text) from anon;
revoke all on function public.get_erp_connection_secret_server(uuid,text) from authenticated;
grant execute on function public.get_erp_connection_secret_server(uuid,text) to service_role;


create or replace function public.mark_erp_connection_verification_server(
  target_organization_id uuid,
  target_provider text,
  target_result text,
  target_company_name text,
  target_error text,
  target_actor_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_connection_id uuid;
  normalized_provider text;
begin
  if target_actor_id is null then
    raise exception 'Actor is required';
  end if;

  if target_result not in ('verified','error') then
    raise exception 'Unsupported ERP connection verification result';
  end if;

  normalized_provider := lower(trim(coalesce(target_provider, '')));

  if not exists (
    select 1
    from public.organization_members m
    where m.organization_id = target_organization_id
      and m.user_id = target_actor_id
      and m.role in ('owner','admin')
  ) then
    raise exception 'Owner or admin access is required to manage ERP credentials';
  end if;

  select c.id into target_connection_id
  from public.erp_connections c
  where c.organization_id = target_organization_id
    and c.provider = normalized_provider
  for update;

  if target_connection_id is null then
    raise exception 'ERP connection not found';
  end if;

  update public.erp_connections
  set status = target_result,
      verified_at = case when target_result = 'verified' then now() else verified_at end,
      verified_company_name = case
        when target_result = 'verified' then nullif(left(trim(coalesce(target_company_name, '')), 240), '')
        else verified_company_name
      end,
      last_error = case
        when target_result = 'error' then nullif(left(coalesce(target_error, ''), 1000), '')
        else null
      end,
      updated_by = target_actor_id,
      updated_at = now()
  where id = target_connection_id;

  perform private.write_activity_event(
    target_organization_id,
    'erp_connection',
    target_connection_id,
    case when target_result = 'verified'
      then 'erp_connection_verified'
      else 'erp_connection_verification_failed'
    end,
    jsonb_build_object(
      'provider', normalized_provider,
      'result', target_result,
      'company_name', case when target_result = 'verified'
        then nullif(left(trim(coalesce(target_company_name, '')), 240), '')
        else null
      end
    ),
    target_actor_id
  );
end;
$$;

revoke all on function public.mark_erp_connection_verification_server(uuid,text,text,text,text,uuid) from public;
revoke all on function public.mark_erp_connection_verification_server(uuid,text,text,text,text,uuid) from anon;
revoke all on function public.mark_erp_connection_verification_server(uuid,text,text,text,text,uuid) from authenticated;
grant execute on function public.mark_erp_connection_verification_server(uuid,text,text,text,text,uuid) to service_role;


create or replace function public.disconnect_erp_connection_server(
  target_organization_id uuid,
  target_provider text,
  target_actor_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_connection_id uuid;
  target_secret_id uuid;
  normalized_provider text;
begin
  if target_actor_id is null then
    raise exception 'Actor is required';
  end if;

  normalized_provider := lower(trim(coalesce(target_provider, '')));
  if normalized_provider !~ '^[a-z][a-z0-9_]{0,63}$'
     or normalized_provider in ('none', 'custom') then
    raise exception 'Invalid native ERP provider';
  end if;

  if not exists (
    select 1
    from public.organization_members m
    where m.organization_id = target_organization_id
      and m.user_id = target_actor_id
      and m.role in ('owner','admin')
  ) then
    raise exception 'Owner or admin access is required to manage ERP credentials';
  end if;

  select c.id, c.secret_id
  into target_connection_id, target_secret_id
  from public.erp_connections c
  where c.organization_id = target_organization_id
    and c.provider = normalized_provider
  for update;

  if target_connection_id is null then
    insert into public.erp_connections(
      organization_id,
      provider,
      configuration,
      secret_id,
      status,
      created_by,
      updated_by
    )
    values (
      target_organization_id,
      normalized_provider,
      '{}'::jsonb,
      null,
      'disconnected',
      target_actor_id,
      target_actor_id
    )
    returning id into target_connection_id;
  else
    if target_secret_id is not null then
      delete from vault.secrets where id = target_secret_id;
    end if;

    update public.erp_connections
    set secret_id = null,
        status = 'disconnected',
        verified_at = null,
        verified_company_name = null,
        last_error = null,
        updated_by = target_actor_id,
        updated_at = now()
    where id = target_connection_id;
  end if;

  perform private.write_activity_event(
    target_organization_id,
    'erp_connection',
    target_connection_id,
    'erp_connection_disconnected',
    jsonb_build_object('provider', normalized_provider),
    target_actor_id
  );
end;
$$;

revoke all on function public.disconnect_erp_connection_server(uuid,text,uuid) from public;
revoke all on function public.disconnect_erp_connection_server(uuid,text,uuid) from anon;
revoke all on function public.disconnect_erp_connection_server(uuid,text,uuid) from authenticated;
grant execute on function public.disconnect_erp_connection_server(uuid,text,uuid) to service_role;
