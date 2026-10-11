begin;
alter table private.operation_jobs add column if not exists provider_started_at timestamptz;
grant select on public.support_messages,public.support_tickets,public.quote_email_attempts,public.erp_delivery_attempts,public.app_error_events to averomira_operations_owner;
grant execute on function private.reconcile_quote_email_attempt_impl(uuid) to averomira_operations_owner;
do $$ declare t text; begin
 foreach t in array array['support_messages','support_tickets','quote_email_attempts','erp_delivery_attempts','app_error_events'] loop
 execute format('drop policy if exists operations_owner_read on public.%I',t);
 execute format('create policy operations_owner_read on public.%I for select to averomira_operations_owner using(true)',t);
 end loop;
end $$;
create or replace function public.operation_outbox_active() returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from private.operation_limits where scope_id='00000000-0000-0000-0000-000000000000' and 'support_notification'=any(enabled_types));
$$;
create or replace function private.operation_support_outbox() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if new.author_type not in('user','support') or not public.operation_outbox_active() then return new; end if;
 if not exists(select 1 from public.support_tickets where id=new.ticket_id and organization_id=new.organization_id) then raise exception 'OPERATION_INVALID_ENTITY'; end if;
 insert into private.operation_jobs(organization_id,type,operation_key,input_hash,metadata,max_age_seconds)
 values(new.organization_id,'support_notification',new.id,encode(sha256(convert_to(new.id::text,'UTF8')),'hex'),jsonb_build_object('messageId',new.id,'ticketId',new.ticket_id),82800) on conflict(organization_id,type,operation_key) do nothing;
 return new;
end $$;
drop trigger if exists operation_support_outbox on public.support_messages;
create trigger operation_support_outbox after insert on public.support_messages for each row execute function private.operation_support_outbox();
create or replace function private.operation_incident(p_org uuid,p_key text,p_code text,p_severity text) returns void
language plpgsql security definer set search_path='' as $$
begin
 insert into private.operation_incidents(organization_id,dedupe_key,code,severity) values(p_org,p_key,p_code,p_severity)
 on conflict(dedupe_key) do update set last_seen=now(),observations=private.operation_incidents.observations+1,clean_checks=0,state='open',severity=excluded.severity;
end $$;
create or replace function private.operation_monitor(p_shadow boolean default true) returns jsonb
language plpgsql security definer set search_path='' as $$
declare j private.operation_jobs; r record; keys text[]:='{}'; key text; scanned integer:=0;
begin
 perform 1 from private.operation_limits where scope_id='00000000-0000-0000-0000-000000000000' for update;
 if not p_shadow then
 for j in select * from private.operation_jobs where state='running' and lease_until<=now() order by lease_until for update skip locked limit 50 loop
 scanned:=scanned+1;
 update private.ai_usage_ledger set state='billed_unknown',settled_at=now() where job_id=j.id and generation=j.generation and state='reserved';
 update private.operation_job_attempts set finished_at=now(),outcome='lease_expired',error_code='timeout' where job_id=j.id and attempt_no=j.attempt_count;
 update private.operation_jobs set generation=generation+1,lease_token=null,lease_until=null,unknown_calls=unknown_calls+case when stage='extraction_requested' then 1 else 0 end,
 state=case when cancel_requested then 'cancelled'
 when type in('rfq_pdf_process','po_pdf_process') and not private.operation_actor_allowed(organization_id,actor_id) then 'blocked'
 when type in('support_notification','incident_notification') and provider_started_at<now()-interval '23 hours' then 'needs_review'
 when stage='extraction_requested' and unknown_calls>=1 then 'needs_review'
 when attempt_count>=max_attempts or created_at+make_interval(secs=>max_age_seconds)<=now() then 'dead'
 else 'retry_wait' end,available_at=now()+interval '30 seconds',error_code=case when stage='extraction_requested' then 'ambiguous_effect' else 'timeout' end,updated_at=now() where id=j.id;
 end loop;
 for r in select id,organization_id from public.quote_email_attempts where status='provider_accepted' and created_at<now()-interval '5 minutes' order by created_at limit 50 loop
 insert into private.operation_jobs(organization_id,type,operation_key,input_hash,metadata) values(r.organization_id,'email_reconcile',r.id,encode(sha256(convert_to(r.id::text,'UTF8')),'hex'),jsonb_build_object('attemptId',r.id)) on conflict(organization_id,type,operation_key) do nothing;
 end loop;
 end if;
 -- Group signals by actionable cause. No document content or free provider errors.
 for r in
 select organization_id,'dead:'||organization_id::text||':'||coalesce(error_code,'internal') as k,'dead_job' as code,'warning' as severity from private.operation_jobs where state='dead' and error_code not in('invalid_file','invalid_extraction') group by organization_id,error_code
 union all select organization_id,'queue:'||organization_id::text,'queue_delay','warning' from private.operation_jobs where state in('queued','retry_wait') and created_at<now()-interval '5 minutes' group by organization_id
 union all select organization_id,'erp:'||organization_id::text,'erp_review','warning' from public.erp_delivery_attempts where status in('partial','existing') or (status='pending' and created_at<now()-interval '10 minutes') group by organization_id
 union all select organization_id,'email:'||organization_id::text,'email_review','warning' from public.quote_email_attempts where status in('bounced','complained') or (status='pending' and created_at<now()-interval '10 minutes') group by organization_id
 union all select organization_id,'app:'||coalesce(organization_id::text,'system')||':'||md5(coalesce(error_digest,route,'unknown')),'repeated_app_error','warning' from public.app_error_events where created_at>now()-interval '10 minutes' group by organization_id,error_digest,route having count(*)>=5
 union all select null::uuid,'provider:openai','provider_outage','critical' from private.operation_jobs where error_code in('provider_rate','provider_unavailable') and updated_at>now()-interval '10 minutes' having count(*)>=5
 loop
 keys:=array_append(keys,r.k);perform private.operation_incident(r.organization_id,r.k,r.code,r.severity);
 end loop;
 for r in select l.scope_id,l.daily_micro_usd,l.monthly_micro_usd,coalesce(sum(case when u.state='settled' then u.actual_micro_usd when u.state='released' then 0 else u.reserved_micro_usd end),0) spent from private.operation_limits l left join private.ai_usage_ledger u on (l.scope_id='00000000-0000-0000-0000-000000000000' or u.organization_id=l.scope_id) and u.created_at>=date_trunc('month',now() at time zone 'UTC') at time zone 'UTC' group by l.scope_id loop
 if r.monthly_micro_usd>0 and r.spent>=r.monthly_micro_usd*0.8 then
 key:='budget:'||r.scope_id::text||':'||to_char(now() at time zone 'UTC','YYYY-MM')||case when r.spent>=r.monthly_micro_usd then ':block' else ':warning' end;
 keys:=array_append(keys,key);perform private.operation_incident(nullif(r.scope_id,'00000000-0000-0000-0000-000000000000'),key,'budget',case when r.spent>=r.monthly_micro_usd then 'critical' else 'warning' end);
 end if;
 end loop;
 update private.operation_incidents set clean_checks=clean_checks+1,state=case when clean_checks>=1 then 'resolved' else state end where state='open' and not dedupe_key=any(keys) and code<>'erp_review';
 if not p_shadow and exists(select 1 from private.operation_limits where scope_id='00000000-0000-0000-0000-000000000000' and 'incident_notification'=any(enabled_types)) then
 for r in select * from private.operation_incidents where state='open' and observations>=2 and next_notify_at<=now() and (code not in('queue_delay','dead_job') or not exists(select 1 from private.operation_incidents where dedupe_key='provider:openai' and state='open')) order by first_seen limit 20 loop
 key:=r.id::text||':'||to_char(now() at time zone 'UTC','YYYY-MM-DD');
 select organization_id into j.organization_id from private.operation_jobs where organization_id=coalesce(r.organization_id,organization_id) order by created_at limit 1;
 if j.organization_id is null then continue; end if;
 insert into private.operation_jobs(organization_id,type,operation_key,input_hash,metadata,max_age_seconds) values(j.organization_id,'incident_notification',md5(key)::uuid,encode(sha256(convert_to(key,'UTF8')),'hex'),jsonb_build_object('incidentId',r.id,'code',r.code),82800) on conflict do nothing;
 update private.operation_incidents set next_notify_at=now()+interval '24 hours',notification_state='queued' where id=r.id;
 end loop;
 end if;
 return jsonb_build_object('recovered',scanned,'openIncidents',(select count(*) from private.operation_incidents where state='open'),'shadow',p_shadow);
end $$;
create or replace function private.operation_worker_status() returns jsonb
language sql security definer set search_path='' as $$
 select jsonb_build_object('lastSuccess',(select max(finished_at) from private.operation_worker_runs where outcome='succeeded'),'schemaVersion',1,'enabled',exists(select 1 from private.operation_limits where cardinality(enabled_types)>0));
$$;
create or replace function private.operation_worker_finish(p_run uuid,p_outcome text) returns void
language plpgsql security definer set search_path='' as $$
begin
 if p_outcome not in('succeeded','failed') then raise exception 'OPERATION_INVALID_STATE'; end if;
 insert into private.operation_worker_runs(id,version,finished_at,outcome) values(p_run,'phase2a-v1',now(),p_outcome) on conflict(id) do update set finished_at=now(),outcome=p_outcome,heartbeat_at=now();
end $$;
create or replace function private.operation_notification_payload(p_id uuid,p_generation bigint,p_token uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare j private.operation_jobs; result jsonb;
begin
 j:=private.operation_fence(p_id,p_generation,p_token);
 if j.type not in('support_notification','incident_notification') then raise exception 'OPERATION_INVALID_ENTITY'; end if;
 if j.checkpoint is not null then return j.checkpoint; end if;
 if j.type='incident_notification' then return jsonb_build_object('incidentId',j.metadata->>'incidentId','code',j.metadata->>'code'); end if;
 select jsonb_build_object('ticketNumber',t.ticket_number,'requesterEmail',t.requester_email,'subject',t.subject,'message',m.body,'authorType',m.author_type) into result from public.support_messages m join public.support_tickets t on t.id=m.ticket_id and t.organization_id=m.organization_id where m.id=(j.metadata->>'messageId')::uuid and m.organization_id=j.organization_id and t.id=(j.metadata->>'ticketId')::uuid;
 if result is null then raise exception 'OPERATION_INVALID_ENTITY'; end if;
 return result;
end $$;
create or replace function private.operation_notification_started(p_id uuid,p_generation bigint,p_token uuid,p_payload jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare j private.operation_jobs;
begin
 j:=private.operation_fence(p_id,p_generation,p_token);
 if j.type not in('support_notification','incident_notification') or octet_length(p_payload::text)>20000 then raise exception 'OPERATION_INVALID_ENTITY'; end if;
 if j.provider_started_at<now()-interval '23 hours' then raise exception 'OPERATION_AMBIGUOUS_EFFECT'; end if;
 if j.checkpoint is null then update private.operation_jobs set checkpoint=p_payload,stage='notification_requested',provider_started_at=now() where id=j.id; return p_payload; end if;
 return j.checkpoint;
end $$;
create or replace function private.operation_notification_accepted(p_id uuid,p_generation bigint,p_token uuid,p_provider_id text) returns void
language plpgsql security definer set search_path='' as $$
declare j private.operation_jobs;
begin
 j:=private.operation_fence(p_id,p_generation,p_token);
 if j.type not in('support_notification','incident_notification') or nullif(p_provider_id,'') is null then raise exception 'OPERATION_INVALID_ENTITY'; end if;
 update private.operation_jobs set stage='notification_accepted',checkpoint=jsonb_build_object('providerId',left(p_provider_id,200)),updated_at=now() where id=j.id;
 if j.type='incident_notification' then update private.operation_incidents set notification_state='accepted' where id=(j.metadata->>'incidentId')::uuid; end if;
end $$;
create or replace function private.operation_email_reconcile(p_id uuid,p_generation bigint,p_token uuid) returns void
language plpgsql security definer set search_path='' as $$
declare j private.operation_jobs; a uuid;
begin
 j:=private.operation_fence(p_id,p_generation,p_token);
 if j.type<>'email_reconcile' then raise exception 'OPERATION_INVALID_ENTITY'; end if;
 select id into a from public.quote_email_attempts where id=(j.metadata->>'attemptId')::uuid and organization_id=j.organization_id and status='provider_accepted';
 if a is not null then perform private.reconcile_quote_email_attempt_impl(a); end if;
 -- Existing signed webhook evidence remains authoritative. Never send or unlock.
 update private.operation_jobs set stage='email_reconciled',updated_at=now() where id=j.id;
end $$;
create or replace function public.operation_metrics(p_org uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
begin
 if not exists(select 1 from public.organization_members where organization_id=p_org and user_id=auth.uid() and role in('owner','admin')) then raise exception 'OPERATION_FORBIDDEN'; end if;
 return jsonb_build_object('microUsd',(select coalesce(sum(case when state='settled' then actual_micro_usd when state='released' then 0 else reserved_micro_usd end),0) from private.ai_usage_ledger where organization_id=p_org and created_at>=date_trunc('month',now() at time zone 'UTC') at time zone 'UTC'),
 'budgetMicroUsd',(select monthly_micro_usd from private.operation_limits where scope_id=p_org),
 'incidents',(select coalesce(jsonb_agg(x),'[]') from(select id,code,severity,state,first_seen,last_seen from private.operation_incidents where organization_id=p_org and state='open' order by first_seen desc limit 20)x));
end $$;

do $$ declare f record; begin
 for f in select p.oid::regprocedure::text sig,p.pronamespace::regnamespace::text ns,p.proname from pg_proc p where (p.pronamespace='private'::regnamespace and p.proname in('operation_support_outbox','operation_incident','operation_monitor','operation_worker_status','operation_worker_finish','operation_notification_payload','operation_notification_started','operation_notification_accepted','operation_email_reconcile')) or (p.pronamespace='public'::regnamespace and p.proname in('operation_outbox_active','operation_metrics')) loop
 execute 'alter function '||f.sig||' owner to averomira_operations_owner';
 execute 'revoke all on function '||f.sig||' from public,anon,authenticated,service_role,averomira_worker';
 if f.ns='public' then execute 'grant execute on function '||f.sig||' to authenticated'; if f.proname='operation_outbox_active' then execute 'grant execute on function '||f.sig||' to service_role'; end if;
 elsif f.proname not in('operation_support_outbox','operation_incident') then execute 'grant execute on function '||f.sig||' to averomira_worker'; end if;
 end loop;
end $$;
commit;
