-- Additive, standalone Copilot AI budget ledger. Does NOT enable model calls.
-- Deliberately independent of pending Phase 2A Operations migrations.
-- No existing table/function is replaced, dropped or populated with customer data.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '60s';

create table private.copilot_ai_limits (
  scope_id uuid primary key,
  enabled boolean not null default false,
  max_request_micro_usd bigint not null default 0 check (max_request_micro_usd >= 0),
  daily_micro_usd bigint not null default 0 check (daily_micro_usd >= 0),
  monthly_micro_usd bigint not null default 0 check (monthly_micro_usd >= 0)
);
create table private.copilot_ai_usage_ledger (
  id uuid primary key default gen_random_uuid(),
  usage_key uuid not null unique,
  organization_id uuid not null references public.organizations(id),
  actor_id uuid not null references auth.users(id),
  model text not null,
  pricing_version text not null,
  reserved_micro_usd bigint not null check (reserved_micro_usd > 0),
  actual_micro_usd bigint check (actual_micro_usd >= 0),
  input_tokens bigint,
  output_tokens bigint,
  provider_response_id text,
  state text not null default 'reserved'
    check (state in ('reserved','settled','billed_unknown')),
  created_at timestamptz not null default now(),
  settled_at timestamptz
);
create index copilot_ai_usage_org_period
  on private.copilot_ai_usage_ledger (organization_id,created_at);

-- RLS intentionally has NO client policies. Neither browser role nor
-- service_role can read private ledger rows directly.
alter table private.copilot_ai_limits enable row level security;
alter table private.copilot_ai_usage_ledger enable row level security;
revoke all on table private.copilot_ai_limits, private.copilot_ai_usage_ledger
  from public, anon, authenticated, service_role;
insert into private.copilot_ai_limits (scope_id)
values ('00000000-0000-0000-0000-000000000000');

create function public.reserve_copilot_ai_usage_server(
  p_org uuid, p_actor uuid, p_key uuid, p_model text,
  p_pricing text, p_micro bigint
) returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_global constant uuid := '00000000-0000-0000-0000-000000000000';
  v_global_limit private.copilot_ai_limits%rowtype;
  v_org_limit private.copilot_ai_limits%rowtype;
  v_existing private.copilot_ai_usage_ledger%rowtype;
  v_spent numeric;
  v_scope uuid;
  v_start timestamptz;
  v_end timestamptz;
  v_cap bigint;
  v_id uuid;
begin
  if p_org is null or p_actor is null or p_key is null or
     p_micro is null or p_micro <= 0 or
     p_model is null or char_length(p_model) not between 1 and 100 or
     p_pricing is null or char_length(p_pricing) not between 1 and 100 then
    raise exception 'COPILOT_INVALID_REQUEST';
  end if;
  if not exists (
    select 1 from public.organization_members
    where organization_id = p_org and user_id = p_actor
  ) then
    raise exception 'COPILOT_PERMISSION';
  end if;
  -- Serialize concurrent reservations under the same two budget rows.
  select * into v_global_limit from private.copilot_ai_limits
    where scope_id = v_global for update;
  if not found or not v_global_limit.enabled then
    raise exception 'COPILOT_DISABLED';
  end if;
  select * into v_org_limit from private.copilot_ai_limits
    where scope_id = p_org for update;
  if not found or not v_org_limit.enabled then
    raise exception 'COPILOT_DISABLED';
  end if;
  if p_micro > v_global_limit.max_request_micro_usd or
     p_micro > v_org_limit.max_request_micro_usd then
    raise exception 'COPILOT_REQUEST_BUDGET';
  end if;
  select * into v_existing from private.copilot_ai_usage_ledger
    where usage_key = p_key;
  if found then
    if v_existing.organization_id <> p_org or
       v_existing.actor_id <> p_actor or
       v_existing.model <> p_model or
       v_existing.pricing_version <> p_pricing or
       v_existing.reserved_micro_usd <> p_micro then
      raise exception 'COPILOT_IDEMPOTENCY_CONFLICT';
    end if;
    return v_existing.id;
  end if;
  -- Sum settled actual usage; unknown and outstanding requests remain
  -- charged at their full reserved amount. UTC day and calendar month.
  for v_scope in select unnest(array[v_global,p_org]) loop
    for v_start,v_end,v_cap in
      select date_trunc('day',now() at time zone 'UTC') at time zone 'UTC',
             date_trunc('day',now() at time zone 'UTC') at time zone 'UTC' + interval '1 day',
             case when v_scope = v_global then v_global_limit.daily_micro_usd
                  else v_org_limit.daily_micro_usd end
      union all
      select date_trunc('month',now() at time zone 'UTC') at time zone 'UTC',
             date_trunc('month',now() at time zone 'UTC') at time zone 'UTC' + interval '1 month',
             case when v_scope = v_global then v_global_limit.monthly_micro_usd
                  else v_org_limit.monthly_micro_usd end
    loop
      select coalesce(sum(case when state = 'settled'
         then actual_micro_usd else reserved_micro_usd end),0)
      into v_spent
      from private.copilot_ai_usage_ledger
      where (v_scope = v_global or organization_id = v_scope)
        and created_at >= v_start and created_at < v_end;
      if v_spent + p_micro > v_cap then
        raise exception 'COPILOT_PERIOD_BUDGET';
      end if;
    end loop;
  end loop;
  insert into private.copilot_ai_usage_ledger (
    usage_key,organization_id,actor_id,model,pricing_version,reserved_micro_usd
  ) values (p_key,p_org,p_actor,p_model,p_pricing,p_micro)
  returning id into v_id;
  return v_id;
end $$;

create function public.settle_copilot_ai_usage_server(
  p_id uuid, p_actual bigint, p_input bigint, p_output bigint,
  p_response text, p_unknown boolean
) returns void language plpgsql security definer set search_path = '' as $$
declare v_changed integer;
begin
  if p_id is null or p_unknown is null then
    raise exception 'COPILOT_INVALID_SETTLEMENT';
  end if;
  if p_unknown then
    if p_actual is not null or p_input is not null or
       p_output is not null or p_response is not null then
      raise exception 'COPILOT_INVALID_SETTLEMENT';
    end if;
  elsif p_actual is null or p_actual < 0 or
        p_input is null or p_input < 0 or
        p_output is null or p_output < 0 then
    raise exception 'COPILOT_INVALID_SETTLEMENT';
  end if;
  update private.copilot_ai_usage_ledger
  set state = case when p_unknown then 'billed_unknown' else 'settled' end,
      actual_micro_usd = case when p_unknown then null else p_actual end,
      input_tokens = p_input,
      output_tokens = p_output,
      provider_response_id = left(p_response,200),
      settled_at = now()
  where id = p_id and state = 'reserved'
    and (p_unknown or p_actual <= reserved_micro_usd);
  get diagnostics v_changed = row_count;
  if v_changed <> 1 then raise exception 'COPILOT_SETTLEMENT_MISMATCH'; end if;
end $$;

revoke all on function public.reserve_copilot_ai_usage_server(
  uuid,uuid,uuid,text,text,bigint
), public.settle_copilot_ai_usage_server(
  uuid,bigint,bigint,bigint,text,boolean
) from public, anon, authenticated;
grant execute on function public.reserve_copilot_ai_usage_server(
  uuid,uuid,uuid,text,text,bigint
), public.settle_copilot_ai_usage_server(
  uuid,bigint,bigint,bigint,text,boolean
) to service_role;
commit;