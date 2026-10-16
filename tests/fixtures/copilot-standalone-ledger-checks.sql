-- Synthetic-only assertions; run in an isolated PostgreSQL fixture.
begin;
do $$
declare
  v_org uuid;
  v_actor uuid;
  v_key uuid := gen_random_uuid();
  v_id uuid;
  v_again uuid;
  v_second uuid;
  v_count integer;
begin
  select organization_id,user_id into v_org,v_actor
  from public.organization_members limit 1;
  if v_org is null or v_actor is null then
    raise exception 'SYNTHETIC_MEMBERSHIP_MISSING';
  end if;
  if has_function_privilege('authenticated',
     'public.reserve_copilot_ai_usage_server(uuid,uuid,uuid,text,text,bigint)',
     'EXECUTE') or
     has_function_privilege('anon',
     'public.settle_copilot_ai_usage_server(uuid,bigint,bigint,bigint,text,boolean)',
     'EXECUTE') then
    raise exception 'SYNTHETIC_RPC_EXPOSED';
  end if;
  if has_table_privilege('service_role','private.copilot_ai_usage_ledger','SELECT')
     or has_table_privilege('authenticated','private.copilot_ai_usage_ledger','SELECT') then
    raise exception 'SYNTHETIC_LEDGER_EXPOSED';
  end if;
  if not (select relrowsecurity from pg_class
     where oid='private.copilot_ai_usage_ledger'::regclass) then
    raise exception 'SYNTHETIC_RLS_DISABLED';
  end if;
  begin
    perform public.reserve_copilot_ai_usage_server(
       v_org,v_actor,v_key,'test-model','reviewed-test-price',300);
    raise exception 'SYNTHETIC_DISABLED_BYPASS';
  exception when others then
    if sqlerrm <> 'COPILOT_DISABLED' then raise; end if;
  end;
  update private.copilot_ai_limits set
    enabled=true,max_request_micro_usd=500,
    daily_micro_usd=1000,monthly_micro_usd=1000
  where scope_id='00000000-0000-0000-0000-000000000000';
  insert into private.copilot_ai_limits(
    scope_id,enabled,max_request_micro_usd,daily_micro_usd,monthly_micro_usd
  ) values(v_org,true,500,1000,1000);
  begin
    perform public.reserve_copilot_ai_usage_server(
       v_org,gen_random_uuid(),gen_random_uuid(),'test-model','reviewed-test-price',300);
    raise exception 'SYNTHETIC_FORGED_USER_ALLOWED';
  exception when others then
    if sqlerrm <> 'COPILOT_PERMISSION' then raise; end if;
  end;
  v_id := public.reserve_copilot_ai_usage_server(
     v_org,v_actor,v_key,'test-model','reviewed-test-price',300);
  v_again := public.reserve_copilot_ai_usage_server(
     v_org,v_actor,v_key,'test-model','reviewed-test-price',300);
  if v_id is distinct from v_again then
    raise exception 'SYNTHETIC_IDEMPOTENCY_FAILED';
  end if;
  begin
    perform public.reserve_copilot_ai_usage_server(
       v_org,v_actor,v_key,'test-model','reviewed-test-price',301);
    raise exception 'SYNTHETIC_CHANGED_PAYLOAD_ACCEPTED';
  exception when others then
    if sqlerrm <> 'COPILOT_IDEMPOTENCY_CONFLICT' then raise; end if;
  end;
  begin
    perform public.reserve_copilot_ai_usage_server(
       v_org,v_actor,gen_random_uuid(),'test-model','reviewed-test-price',501);
    raise exception 'SYNTHETIC_REQUEST_CAP_BYPASS';
  exception when others then
    if sqlerrm <> 'COPILOT_REQUEST_BUDGET' then raise; end if;
  end;
  v_second := public.reserve_copilot_ai_usage_server(
     v_org,v_actor,gen_random_uuid(),'test-model','reviewed-test-price',400);
  begin
    perform public.reserve_copilot_ai_usage_server(
       v_org,v_actor,gen_random_uuid(),'test-model','reviewed-test-price',400);
    raise exception 'SYNTHETIC_PERIOD_BUDGET_BYPASS';
  exception when others then
    if sqlerrm <> 'COPILOT_PERIOD_BUDGET' then raise; end if;
  end;
  perform public.settle_copilot_ai_usage_server(v_id,180,50,65,'synthetic-response',false);
  perform public.settle_copilot_ai_usage_server(v_second,null,null,null,null,true);
  begin
    perform public.settle_copilot_ai_usage_server(v_id,180,50,65,'synthetic-response',false);
    raise exception 'SYNTHETIC_DOUBLE_SETTLEMENT_ALLOWED';
  exception when others then
    if sqlerrm <> 'COPILOT_SETTLEMENT_MISMATCH' then raise; end if;
  end;
  select count(*) into v_count
    from private.copilot_ai_usage_ledger
    where state='billed_unknown' and reserved_micro_usd=400;
  if v_count<>1 then raise exception 'SYNTHETIC_UNKNOWN_NOT_BILLED'; end if;
end $$;
rollback;
-- Test changes above are rolled back; synthetic deployment remains disabled.
do $$
begin
 if not exists(
   select 1 from private.copilot_ai_limits
   where scope_id='00000000-0000-0000-0000-000000000000'
   and enabled=false and daily_micro_usd=0 and monthly_micro_usd=0
 ) then raise exception 'SYNTHETIC_DEFAULTS_CHANGED'; end if;
end $$;
select 'Copilot standalone synthetic ledger: PASS' as result;