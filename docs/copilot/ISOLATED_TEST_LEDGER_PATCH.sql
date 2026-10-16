-- PREPARATION ONLY — ISOLATED TEST DATABASE, MANUAL DBA REVIEW REQUIRED.
-- NOT IN supabase/migrations; MUST NOT BE EXECUTED ON PRODUCTION.
-- Based on 20261011113020_operations_shared_ai_ledger.sql. Allows a new
-- 'copilot_ai' type, but does not enable it in operation_limits, which
-- defaults to disabled. Separate explicit scoped limit changes are required.
-- Rollback: restore the original reserve_ai_usage_server definition after
-- confirming there are no active copilot_ai reservations.

begin;
-- Public AI has its own system scope, in addition to the global cap.
insert into private.operation_limits(scope_id) values('00000000-0000-0000-0000-000000000001') on conflict do nothing;
create or replace function public.reserve_ai_usage_server(p_org uuid,p_actor uuid,p_type text,p_key uuid,p_model text,p_pricing text,p_micro bigint) returns uuid
language plpgsql security definer set search_path='' as $$
declare scope uuid; l private.operation_limits; spent bigint; reservation private.ai_usage_ledger; reservation_id uuid;
begin
 if p_type not in('catalogue_mapping','support_ai','public_ai','copilot_ai') or p_key is null or p_micro is null or p_micro<=0 or char_length(p_model) not between 1 and 100 or char_length(p_pricing) not between 1 and 100 then raise exception 'OPERATION_INVALID_USAGE'; end if;
 if p_type='public_ai' then
 if p_org is not null or p_actor is not null then raise exception 'OPERATION_FORBIDDEN'; end if;
 scope:='00000000-0000-0000-0000-000000000001';
 else
 if not exists(select 1 from public.organization_members where organization_id=p_org and user_id=p_actor) then raise exception 'OPERATION_PERMISSION'; end if;
 if p_type='catalogue_mapping' and not private.operation_actor_allowed(p_org,p_actor) then raise exception 'OPERATION_PERMISSION'; end if;
 scope:=p_org;
 end if;
 perform 1 from private.operation_limits where scope_id='00000000-0000-0000-0000-000000000000' for update;
 select * into l from private.operation_limits where scope_id=scope for update;
 if not found or not p_type=any(l.enabled_types) then raise exception 'OPERATION_DISABLED'; end if;
 if not exists(select 1 from private.operation_limits where scope_id='00000000-0000-0000-0000-000000000000' and p_type=any(enabled_types)) then raise exception 'OPERATION_DISABLED'; end if;
 select * into reservation from private.ai_usage_ledger where usage_key=p_type||':'||p_key::text;
 if found then
 if reservation.organization_id is distinct from p_org or reservation.model<>p_model or reservation.pricing_version<>p_pricing or reservation.reserved_micro_usd<>p_micro then raise exception 'OPERATION_IDEMPOTENCY_CONFLICT'; end if;
 return reservation.id;
 end if;
 for l in select * from private.operation_limits where scope_id in('00000000-0000-0000-0000-000000000000',scope) order by scope_id loop
 select coalesce(sum(case when state='settled' then actual_micro_usd when state='released' then 0 else reserved_micro_usd end),0) into spent from private.ai_usage_ledger where (l.scope_id='00000000-0000-0000-0000-000000000000' or (l.scope_id='00000000-0000-0000-0000-000000000001' and organization_id is null) or organization_id=l.scope_id) and created_at>=date_trunc('day',now() at time zone 'UTC') at time zone 'UTC';
 if spent+p_micro>l.daily_micro_usd then raise exception 'OPERATION_BUDGET'; end if;
 select coalesce(sum(case when state='settled' then actual_micro_usd when state='released' then 0 else reserved_micro_usd end),0) into spent from private.ai_usage_ledger where (l.scope_id='00000000-0000-0000-0000-000000000000' or (l.scope_id='00000000-0000-0000-0000-000000000001' and organization_id is null) or organization_id=l.scope_id) and created_at>=date_trunc('month',now() at time zone 'UTC') at time zone 'UTC';
 if spent+p_micro>l.monthly_micro_usd then raise exception 'OPERATION_BUDGET'; end if;
 end loop;
 insert into private.ai_usage_ledger(organization_id,usage_key,model,pricing_version,reserved_micro_usd) values(p_org,p_type||':'||p_key::text,p_model,p_pricing,p_micro) returning id into reservation_id;
 return reservation_id;
end $$;
create or replace function public.settle_ai_usage_server(p_id uuid,p_actual bigint,p_input bigint,p_output bigint,p_response text,p_unknown boolean) returns void
language plpgsql security definer set search_path='' as $$
begin
 if p_unknown is null or (not p_unknown and (p_actual is null or p_actual<0 or p_input is null or p_output is null or p_input<0 or p_output<0)) then raise exception 'OPERATION_INVALID_USAGE'; end if;
 update private.ai_usage_ledger set state=case when p_unknown then 'billed_unknown' else 'settled' end,actual_micro_usd=case when p_unknown then null else p_actual end,input_tokens=p_input,output_tokens=p_output,provider_response_id=left(p_response,200),settled_at=now() where id=p_id and job_id is null and state='reserved';
end $$;
alter function public.reserve_ai_usage_server(uuid,uuid,text,uuid,text,text,bigint) owner to averomira_operations_owner;
alter function public.settle_ai_usage_server(uuid,bigint,bigint,bigint,text,boolean) owner to averomira_operations_owner;
revoke all on function public.reserve_ai_usage_server(uuid,uuid,text,uuid,text,text,bigint),public.settle_ai_usage_server(uuid,bigint,bigint,bigint,text,boolean) from public,anon,authenticated,averomira_worker;
grant execute on function public.reserve_ai_usage_server(uuid,uuid,text,uuid,text,text,bigint),public.settle_ai_usage_server(uuid,bigint,bigint,bigint,text,boolean) to service_role;
commit;
