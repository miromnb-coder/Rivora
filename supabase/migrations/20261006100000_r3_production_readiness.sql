-- R3 Production Readiness: abuse controls and database hardening.

create table if not exists public.public_rate_limits (
  scope text not null,
  key_hash text not null,
  request_count integer not null default 0,
  window_started_at timestamptz not null default now(),
  expires_at timestamptz not null,
  updated_at timestamptz not null default now(),
  primary key (scope, key_hash),
  constraint public_rate_limits_scope_check
    check (scope ~ '^[a-z][a-z0-9_]{0,63}$'),
  constraint public_rate_limits_key_hash_check
    check (key_hash ~ '^[a-f0-9]{64}$'),
  constraint public_rate_limits_count_check
    check (request_count >= 0)
);

alter table public.public_rate_limits enable row level security;

drop policy if exists public_rate_limits_deny_browser_access
  on public.public_rate_limits;

create policy public_rate_limits_deny_browser_access
on public.public_rate_limits
as restrictive
for all
to authenticated
using (false)
with check (false);

revoke all on table public.public_rate_limits from anon;
revoke all on table public.public_rate_limits from authenticated;
grant select, insert, update, delete on table public.public_rate_limits to service_role;

create index if not exists public_rate_limits_expires_idx
  on public.public_rate_limits(expires_at);

create or replace function public.consume_public_rate_limit_server(
  target_scope text,
  target_key_hash text,
  target_window_seconds integer,
  target_limit integer
)
returns table (
  allowed boolean,
  request_count integer,
  retry_after_seconds integer
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  normalized_scope text;
  current_count integer;
  current_expiry timestamptz;
  now_ts timestamptz := now();
begin
  normalized_scope := lower(trim(coalesce(target_scope, '')));

  if normalized_scope !~ '^[a-z][a-z0-9_]{0,63}$' then
    raise exception 'Invalid rate-limit scope';
  end if;

  if coalesce(target_key_hash, '') !~ '^[a-f0-9]{64}$' then
    raise exception 'Invalid rate-limit key';
  end if;

  if target_window_seconds < 1 or target_window_seconds > 86400 then
    raise exception 'Invalid rate-limit window';
  end if;

  if target_limit < 1 or target_limit > 10000 then
    raise exception 'Invalid rate-limit limit';
  end if;

  -- Bound table growth without a separate scheduler.
  delete from public.public_rate_limits
  where expires_at < now_ts - interval '1 day'
    and ctid in (
      select ctid
      from public.public_rate_limits
      where expires_at < now_ts - interval '1 day'
      order by expires_at
      limit 100
    );

  insert into public.public_rate_limits(
    scope,
    key_hash,
    request_count,
    window_started_at,
    expires_at,
    updated_at
  )
  values (
    normalized_scope,
    target_key_hash,
    0,
    now_ts,
    now_ts + make_interval(secs => target_window_seconds),
    now_ts
  )
  on conflict (scope, key_hash) do nothing;

  select r.request_count, r.expires_at
  into current_count, current_expiry
  from public.public_rate_limits r
  where r.scope = normalized_scope
    and r.key_hash = target_key_hash
  for update;

  if current_expiry <= now_ts then
    current_count := 1;
    current_expiry := now_ts + make_interval(secs => target_window_seconds);

    update public.public_rate_limits
    set request_count = current_count,
        window_started_at = now_ts,
        expires_at = current_expiry,
        updated_at = now_ts
    where scope = normalized_scope
      and key_hash = target_key_hash;
  else
    current_count := current_count + 1;

    update public.public_rate_limits
    set request_count = current_count,
        updated_at = now_ts
    where scope = normalized_scope
      and key_hash = target_key_hash;
  end if;

  return query
  select
    current_count <= target_limit,
    current_count,
    greatest(
      1,
      ceil(extract(epoch from (current_expiry - now_ts)))::integer
    );
end;
$$;

revoke all on function public.consume_public_rate_limit_server(text,text,integer,integer) from public;
revoke all on function public.consume_public_rate_limit_server(text,text,integer,integer) from anon;
revoke all on function public.consume_public_rate_limit_server(text,text,integer,integer) from authenticated;
grant execute on function public.consume_public_rate_limit_server(text,text,integer,integer) to service_role;


-- Consolidate pilot invite SELECT policies so auth.jwt() is evaluated once
-- and only one permissive SELECT policy is applied per row.
drop policy if exists "pilot invites feature admin read"
  on public.pilot_access_invites;
drop policy if exists "pilot invites self read"
  on public.pilot_access_invites;
drop policy if exists "pilot invites authorized read"
  on public.pilot_access_invites;

create policy "pilot invites authorized read"
on public.pilot_access_invites
for select
to authenticated
using (
  public.can_manage_workspace_feature('leads')
  or (
    revoked_at is null
    and lower(email) = lower(
      coalesce(((select auth.jwt()) ->> 'email'::text), '')
    )
  )
);


-- Cover foreign keys reported by Supabase's production performance advisor.
create index if not exists pilot_access_invites_accepted_by_idx
  on public.pilot_access_invites(accepted_by)
  where accepted_by is not null;

create index if not exists pilot_access_invites_approved_by_idx
  on public.pilot_access_invites(approved_by)
  where approved_by is not null;

create index if not exists pilot_access_invites_lead_id_idx
  on public.pilot_access_invites(lead_id)
  where lead_id is not null;

create index if not exists quote_email_attempts_created_by_idx
  on public.quote_email_attempts(created_by)
  where created_by is not null;

create index if not exists quote_email_events_organization_id_idx
  on public.quote_email_events(organization_id);

create index if not exists quote_lines_source_rfq_line_id_idx
  on public.quote_lines(source_rfq_line_id)
  where source_rfq_line_id is not null;

create index if not exists quotes_approved_by_idx
  on public.quotes(approved_by)
  where approved_by is not null;

create index if not exists quotes_created_by_idx
  on public.quotes(created_by)
  where created_by is not null;


-- Operational queries need to find stuck ERP sends and recent failures quickly.
create index if not exists erp_delivery_attempts_status_created_idx
  on public.erp_delivery_attempts(status, created_at desc);

create index if not exists quote_email_attempts_status_created_idx
  on public.quote_email_attempts(status, created_at desc);
