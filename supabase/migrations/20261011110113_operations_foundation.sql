begin;
-- Additive, disabled by default. No passwords or production activation here.
do $$ begin
 if not exists(select from pg_roles where rolname='averomira_operations_owner') then create role averomira_operations_owner nologin nosuperuser nocreatedb nocreaterole noinherit nobypassrls; end if;
 if not exists(select from pg_roles where rolname='averomira_worker') then create role averomira_worker nologin nosuperuser nocreatedb nocreaterole noinherit nobypassrls; end if;
end $$;
grant usage on schema private, public, auth to averomira_operations_owner;
grant usage on schema private to averomira_worker;
alter default privileges for role averomira_operations_owner in schema private revoke execute on functions from public;

create table if not exists private.operation_limits(
 scope_id uuid primary key,
 enabled_types text[] not null default '{}',
 max_running integer not null default 1 check(max_running between 1 and 10),
 max_queued integer not null default 20 check(max_queued between 1 and 1000),
 daily_micro_usd bigint not null default 0 check(daily_micro_usd>=0),
 monthly_micro_usd bigint not null default 0 check(monthly_micro_usd>=0),
 max_file_bytes bigint not null default 10485760 check(max_file_bytes between 1 and 10485760),
 max_pages integer not null default 50 check(max_pages between 1 and 50),
 last_claim_at timestamptz not null default '-infinity'
);
insert into private.operation_limits(scope_id,max_running) values('00000000-0000-0000-0000-000000000000',2) on conflict do nothing;
create table if not exists private.operation_uploads(
 id uuid primary key, organization_id uuid not null references public.organizations(id),
 actor_id uuid not null references auth.users(id), type text not null check(type in('rfq_pdf_process','po_pdf_process')),
 input_ref text not null unique, metadata jsonb not null default '{}',
 expires_at timestamptz not null default(now()+interval '1 hour'), created_at timestamptz not null default now()
);
create table if not exists private.operation_jobs(
 id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id),
 actor_id uuid references auth.users(id), type text not null check(type in('rfq_pdf_process','po_pdf_process','support_notification','incident_notification','email_reconcile','storage_cleanup')),
 operation_key uuid not null, input_hash text not null check(input_hash ~ '^[a-f0-9]{64}$'),
 input_ref text, metadata jsonb not null default '{}', schema_version integer not null default 1,
 state text not null default 'queued' check(state in('queued','running','retry_wait','blocked','needs_review','succeeded','dead','cancelled')),
 stage text not null default 'input_validated', checkpoint jsonb, entity_id uuid,
 available_at timestamptz not null default now(), attempt_count integer not null default 0,
 max_attempts integer not null default 3, max_age_seconds integer not null default 3600,
 generation bigint not null default 0, lease_owner uuid, lease_token uuid, lease_until timestamptz,
 cancel_requested boolean not null default false, error_code text, unknown_calls integer not null default 0,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), completed_at timestamptz,
 unique(organization_id,type,operation_key), unique(type,entity_id)
);
create index if not exists operation_jobs_due on private.operation_jobs(state,available_at) where state in('queued','retry_wait');
create index if not exists operation_jobs_org on private.operation_jobs(organization_id,state,created_at);
create index if not exists operation_jobs_expired on private.operation_jobs(lease_until) where state='running';
create table if not exists private.operation_worker_runs(
 id uuid primary key, started_at timestamptz not null default now(), heartbeat_at timestamptz not null default now(),
 finished_at timestamptz, version text not null, outcome text, claimed integer not null default 0
);
create table if not exists private.operation_job_attempts(
 job_id uuid not null references private.operation_jobs(id), attempt_no integer not null,
 generation bigint not null, worker_run_id uuid not null references private.operation_worker_runs(id),
 started_at timestamptz not null default now(), finished_at timestamptz, outcome text,
 error_code text, primary key(job_id,attempt_no)
);
create table if not exists private.ai_usage_ledger(
 id uuid primary key default gen_random_uuid(), organization_id uuid, job_id uuid references private.operation_jobs(id),
 generation bigint, usage_key text not null unique, model text not null, pricing_version text not null,
 reserved_micro_usd bigint not null check(reserved_micro_usd>0), actual_micro_usd bigint check(actual_micro_usd>=0),
 input_tokens bigint, output_tokens bigint, provider_response_id text,
 state text not null default 'reserved' check(state in('reserved','settled','billed_unknown','released')),
 created_at timestamptz not null default now(), settled_at timestamptz
);
create index if not exists ai_usage_org_period on private.ai_usage_ledger(organization_id,created_at);
create table if not exists private.operation_incidents(
 id uuid primary key default gen_random_uuid(), organization_id uuid, dedupe_key text not null unique,
 code text not null, severity text not null check(severity in('warning','critical')),
 state text not null default 'open' check(state in('open','resolved')),
 first_seen timestamptz not null default now(), last_seen timestamptz not null default now(),
 observations integer not null default 1, clean_checks integer not null default 0,
 next_notify_at timestamptz not null default now(), notification_state text not null default 'pending'
);
create index if not exists operation_incidents_notify on private.operation_incidents(state,next_notify_at);
do $$ declare t text; begin
 foreach t in array array['operation_limits','operation_uploads','operation_jobs','operation_worker_runs','operation_job_attempts','ai_usage_ledger','operation_incidents'] loop
 execute format('alter table private.%I owner to averomira_operations_owner',t);
 execute format('alter table private.%I enable row level security',t);
 execute format('revoke all on private.%I from public,anon,authenticated,service_role,averomira_worker',t);
 end loop;
end $$;
grant select on public.organization_members to averomira_operations_owner;
drop policy if exists operations_member_read on public.organization_members;
create policy operations_member_read on public.organization_members for select to averomira_operations_owner using(true);
grant execute on function auth.uid() to averomira_operations_owner;

create or replace function private.operation_actor_allowed(p_org uuid,p_actor uuid) returns boolean
language sql security definer set search_path='' as $$
 select exists(select 1 from public.organization_members where organization_id=p_org and user_id=p_actor and role in('owner','admin','member'));
$$;
create or replace function public.begin_document_operation(p_org uuid,p_id uuid,p_type text,p_metadata jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare a uuid:=auth.uid(); u private.operation_uploads; l private.operation_limits;
begin
 if not private.operation_actor_allowed(p_org,a) then raise exception 'OPERATION_FORBIDDEN'; end if;
 if p_type not in('rfq_pdf_process','po_pdf_process') or p_id is null or jsonb_typeof(p_metadata)<>'object' or octet_length(p_metadata::text)>4096 then raise exception 'OPERATION_INVALID_INPUT'; end if;
 select * into l from private.operation_limits where scope_id='00000000-0000-0000-0000-000000000000' for update;
 if not p_type=any(l.enabled_types) then raise exception 'OPERATION_DISABLED'; end if;
 select * into l from private.operation_limits where scope_id=p_org for update;
 if not found or not p_type=any(l.enabled_types) then raise exception 'OPERATION_DISABLED'; end if;
 if (select count(*) from private.operation_uploads where organization_id=p_org and id<>p_id and expires_at>now() and not exists(select 1 from private.operation_jobs j where j.id=operation_uploads.id))>=l.max_queued then raise exception 'OPERATION_QUEUE_LIMIT'; end if;
 insert into private.operation_uploads(id,organization_id,actor_id,type,input_ref,metadata)
 values(p_id,p_org,a,p_type,p_org::text||'/'||p_id::text||'.pdf',p_metadata) on conflict(id) do nothing;
 select * into u from private.operation_uploads where id=p_id;
 if u.organization_id<>p_org or u.actor_id<>a or u.type<>p_type or u.metadata<>p_metadata then raise exception 'OPERATION_IDEMPOTENCY_CONFLICT'; end if;
 if u.expires_at<=now() then raise exception 'OPERATION_UPLOAD_EXPIRED'; end if;
 return jsonb_build_object('id',u.id,'path',u.input_ref);
end $$;
create or replace function public.enqueue_document_operation(p_org uuid,p_id uuid,p_hash text,p_size bigint,p_pages integer)
returns uuid language plpgsql security definer set search_path='' as $$
declare u private.operation_uploads; j private.operation_jobs; l private.operation_limits;
begin
 if not private.operation_actor_allowed(p_org,auth.uid()) then raise exception 'OPERATION_FORBIDDEN'; end if;
 select * into l from private.operation_limits where scope_id='00000000-0000-0000-0000-000000000000' for update;
 select * into l from private.operation_limits where scope_id=p_org for update;
 select * into u from private.operation_uploads where id=p_id;
 if not found or u.organization_id<>p_org or u.actor_id<>auth.uid() then raise exception 'OPERATION_FORBIDDEN'; end if;
 select * into j from private.operation_jobs where organization_id=p_org and type=u.type and operation_key=p_id;
 if found then
 if j.input_hash<>p_hash then raise exception 'OPERATION_IDEMPOTENCY_CONFLICT'; end if;
 return j.id;
 end if;
 if u.expires_at<=now() then raise exception 'OPERATION_UPLOAD_EXPIRED'; end if;
 if not u.type=any(l.enabled_types) or not exists(select 1 from private.operation_limits where scope_id='00000000-0000-0000-0000-000000000000' and u.type=any(enabled_types)) then raise exception 'OPERATION_DISABLED'; end if;
 if p_hash!~'^[a-f0-9]{64}$' or p_size not between 1 and l.max_file_bytes or p_pages not between 1 and l.max_pages then raise exception 'OPERATION_INVALID_FILE'; end if;
 if (select count(*) from private.operation_jobs where organization_id=p_org and state in('queued','running','retry_wait','blocked'))>=l.max_queued then raise exception 'OPERATION_QUEUE_LIMIT'; end if;
 insert into private.operation_jobs(id,organization_id,actor_id,type,operation_key,input_hash,input_ref,metadata)
 values(p_id,p_org,u.actor_id,u.type,p_id,p_hash,u.input_ref,u.metadata||jsonb_build_object('size',p_size,'pages',p_pages));
 return p_id;
end $$;

create or replace function private.operation_claim(p_run uuid,p_version text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare g private.operation_limits; l private.operation_limits; j private.operation_jobs;
begin
 select * into g from private.operation_limits where scope_id='00000000-0000-0000-0000-000000000000' for update;
 if (select count(*) from private.operation_jobs where state='running' and lease_until>now())>=g.max_running then return null; end if;
 insert into private.operation_worker_runs(id,version) values(p_run,left(p_version,80)) on conflict(id) do update set heartbeat_at=now();
 for l in select x.* from private.operation_limits x where x.scope_id<>'00000000-0000-0000-0000-000000000000'
 and exists(select 1 from private.operation_jobs y where y.organization_id=x.scope_id and y.state in('queued','retry_wait') and y.available_at<=now() and y.type=any(g.enabled_types) and y.type=any(x.enabled_types)) order by last_claim_at,scope_id for update loop
 if exists(select 1 from private.operation_jobs where organization_id=l.scope_id and lease_owner=p_run) then continue; end if;
 if (select count(*) from private.operation_jobs where organization_id=l.scope_id and state='running' and lease_until>now())>=l.max_running then continue; end if;
 select * into j from private.operation_jobs where organization_id=l.scope_id and state in('queued','retry_wait') and available_at<=now() and type=any(g.enabled_types) and type=any(l.enabled_types) order by available_at,created_at for update skip locked limit 1;
 if not found then continue; end if;
 if j.cancel_requested then update private.operation_jobs set state='cancelled',completed_at=now() where id=j.id; continue; end if;
 if j.type in('rfq_pdf_process','po_pdf_process') and not private.operation_actor_allowed(j.organization_id,j.actor_id) then update private.operation_jobs set state='blocked',error_code='permission',updated_at=now() where id=j.id; continue; end if;
 if j.attempt_count>=j.max_attempts or j.created_at+make_interval(secs=>j.max_age_seconds)<now() then update private.operation_jobs set state='dead',error_code='retry_exhausted',updated_at=now() where id=j.id; continue; end if;
 update private.operation_jobs set state='running',generation=generation+1,lease_owner=p_run,lease_token=gen_random_uuid(),lease_until=now()+interval '180 seconds',attempt_count=attempt_count+1,error_code=null,updated_at=now() where id=j.id returning * into j;
 update private.operation_limits set last_claim_at=now() where scope_id=l.scope_id;
 insert into private.operation_job_attempts(job_id,attempt_no,generation,worker_run_id) values(j.id,j.attempt_count,j.generation,p_run);
 update private.operation_worker_runs set claimed=claimed+1 where id=p_run;
 return to_jsonb(j);
 end loop;
 return null;
end $$;
create or replace function private.operation_fence(p_id uuid,p_generation bigint,p_token uuid) returns private.operation_jobs
language plpgsql security definer set search_path='' as $$
declare j private.operation_jobs;
begin
 select * into j from private.operation_jobs where id=p_id for update;
 if not found or j.state<>'running' or j.generation<>p_generation or j.lease_token<>p_token or j.lease_until<=now() then raise exception 'OPERATION_STALE_LEASE'; end if;
 if j.cancel_requested then raise exception 'OPERATION_CANCELLED'; end if;
 if j.type in('rfq_pdf_process','po_pdf_process') and not private.operation_actor_allowed(j.organization_id,j.actor_id) then raise exception 'OPERATION_PERMISSION'; end if;
 return j;
end $$;
create or replace function private.operation_heartbeat(p_id uuid,p_generation bigint,p_token uuid) returns void
language plpgsql security definer set search_path='' as $$
declare j private.operation_jobs;
begin
 j:=private.operation_fence(p_id,p_generation,p_token);
 update private.operation_jobs set lease_until=now()+interval '180 seconds',updated_at=now() where id=j.id;
 update private.operation_worker_runs set heartbeat_at=now() where id=j.lease_owner;
end $$;
create or replace function private.operation_checkpoint(p_id uuid,p_generation bigint,p_token uuid,p_result jsonb) returns void
language plpgsql security definer set search_path='' as $$
declare j private.operation_jobs;
begin
 j:=private.operation_fence(p_id,p_generation,p_token);
 if j.type not in('rfq_pdf_process','po_pdf_process') or j.entity_id is not null or octet_length(p_result::text)>4194304 or jsonb_typeof(p_result->'extraction')<>'object' then raise exception 'OPERATION_INVALID_CHECKPOINT'; end if;
 if p_result->'billing' is null or (p_result#>>'{billing,microUsd}') is null then raise exception 'OPERATION_INVALID_USAGE'; end if;
 if p_result->'billing' is not null then
 if (p_result#>>'{billing,microUsd}')::bigint<0 then raise exception 'OPERATION_INVALID_USAGE'; end if;
 update private.ai_usage_ledger set state='settled',actual_micro_usd=(p_result#>>'{billing,microUsd}')::bigint,input_tokens=(p_result#>>'{usage,input_tokens}')::bigint,output_tokens=(p_result#>>'{usage,output_tokens}')::bigint,provider_response_id=left(p_result->>'responseId',200),settled_at=now() where job_id=j.id and generation=j.generation and state='reserved';
 if not found then raise exception 'OPERATION_NO_RESERVATION'; end if;
 end if;
 update private.operation_jobs set checkpoint=p_result,stage='extraction_persisted',updated_at=now() where id=j.id;
end $$;
create or replace function private.operation_finish(p_id uuid,p_generation bigint,p_token uuid,p_state text,p_code text default null,p_delay integer default 30) returns void
language plpgsql security definer set search_path='' as $$
declare j private.operation_jobs;
begin
 -- Cancellation and revocation must still be persisted by the current owner.
 select * into j from private.operation_jobs where id=p_id for update;
 if not found or j.state<>'running' or j.generation<>p_generation or j.lease_token<>p_token or j.lease_until<=now() then raise exception 'OPERATION_STALE_LEASE'; end if;
 if p_state not in('retry_wait','blocked','needs_review','succeeded','dead','cancelled') or (p_code is not null and p_code !~ '^[a-z_]{1,64}$') then raise exception 'OPERATION_INVALID_STATE'; end if;
 if p_state='succeeded' and j.type in('rfq_pdf_process','po_pdf_process') and (j.entity_id is null or j.stage not in('matching_completed','reconciliation_completed')) then raise exception 'OPERATION_NOT_PUBLISHED'; end if;
 if j.cancel_requested then p_state:='cancelled'; end if;
 if j.type in('rfq_pdf_process','po_pdf_process') and not private.operation_actor_allowed(j.organization_id,j.actor_id) then p_state:='blocked';p_code:='permission'; end if;
 if p_state='retry_wait' and (j.attempt_count>=j.max_attempts or now()+make_interval(secs=>greatest(1,p_delay))>j.created_at+make_interval(secs=>j.max_age_seconds)) then p_state:='dead';p_code:='retry_exhausted'; end if;
 update private.ai_usage_ledger set state='billed_unknown',settled_at=now() where job_id=j.id and generation=j.generation and state='reserved';
 update private.operation_jobs set state=p_state,error_code=p_code,available_at=now()+make_interval(secs=>least(600,greatest(1,p_delay))),lease_until=null,lease_token=null,updated_at=now(),completed_at=case when p_state in('succeeded','dead','cancelled') then now() else null end where id=j.id;
 update private.operation_job_attempts set finished_at=now(),outcome=p_state,error_code=p_code where job_id=j.id and attempt_no=j.attempt_count;
end $$;

create or replace function private.operation_reserve_ai(p_id uuid,p_generation bigint,p_token uuid,p_model text,p_pricing text,p_micro bigint) returns uuid
language plpgsql security definer set search_path='' as $$
declare j private.operation_jobs; l private.operation_limits; s bigint; r uuid; scope uuid;
begin
 -- One total ordering serializes global and tenant period reservations.
 perform 1 from private.operation_limits where scope_id='00000000-0000-0000-0000-000000000000' for update;
 select organization_id into scope from private.operation_jobs where id=p_id;
 perform 1 from private.operation_limits where scope_id=scope for update;
 j:=private.operation_fence(p_id,p_generation,p_token);
 select id into r from private.ai_usage_ledger where usage_key=j.id::text||':'||j.generation::text;
 if r is not null then return r; end if;
 if j.type not in('rfq_pdf_process','po_pdf_process') or j.checkpoint is not null or p_micro<=0 or char_length(p_model) not between 1 and 100 or char_length(p_pricing) not between 1 and 100 then raise exception 'OPERATION_INVALID_BUDGET'; end if;
 for l in select * from private.operation_limits where scope_id in('00000000-0000-0000-0000-000000000000',j.organization_id) order by scope_id loop
 select coalesce(sum(case when state='settled' then actual_micro_usd when state='released' then 0 else reserved_micro_usd end),0) into s from private.ai_usage_ledger where (l.scope_id='00000000-0000-0000-0000-000000000000' or organization_id=l.scope_id) and created_at>=date_trunc('day',now() at time zone 'UTC') at time zone 'UTC';
 if s+p_micro>l.daily_micro_usd then raise exception 'OPERATION_BUDGET'; end if;
 select coalesce(sum(case when state='settled' then actual_micro_usd when state='released' then 0 else reserved_micro_usd end),0) into s from private.ai_usage_ledger where (l.scope_id='00000000-0000-0000-0000-000000000000' or organization_id=l.scope_id) and created_at>=date_trunc('month',now() at time zone 'UTC') at time zone 'UTC';
 if s+p_micro>l.monthly_micro_usd then raise exception 'OPERATION_BUDGET'; end if;
 end loop;
 insert into private.ai_usage_ledger(organization_id,job_id,generation,usage_key,model,pricing_version,reserved_micro_usd) values(j.organization_id,j.id,j.generation,j.id::text||':'||j.generation::text,p_model,p_pricing,p_micro) returning id into r;
 update private.operation_jobs set stage='extraction_requested',updated_at=now() where id=j.id;
 return r;
end $$;
create or replace function private.operation_settle_ai(p_id uuid,p_generation bigint,p_token uuid,p_actual bigint,p_input bigint,p_output bigint,p_response text,p_unknown boolean default false) returns void
language plpgsql security definer set search_path='' as $$
declare j private.operation_jobs; r private.ai_usage_ledger;
begin
 j:=private.operation_fence(p_id,p_generation,p_token);
 select * into r from private.ai_usage_ledger where job_id=j.id and generation=j.generation for update;
 if not found then raise exception 'OPERATION_NO_RESERVATION'; end if;
 if r.state<>'reserved' then return; end if;
 if not p_unknown and (p_actual is null or p_actual<0 or p_input<0 or p_output<0) then raise exception 'OPERATION_INVALID_USAGE'; end if;
 update private.ai_usage_ledger set state=case when p_unknown then 'billed_unknown' else 'settled' end,actual_micro_usd=case when p_unknown then null else p_actual end,input_tokens=p_input,output_tokens=p_output,provider_response_id=left(p_response,200),settled_at=now() where id=r.id;
 -- Over-reservation usage remains recorded and blocks subsequent budget calls.
 if p_unknown then update private.operation_jobs set unknown_calls=unknown_calls+1 where id=j.id; end if;
end $$;

create or replace function public.operation_status(p_org uuid,p_id uuid default null) returns jsonb
language plpgsql security definer set search_path='' as $$
begin
 if not exists(select 1 from public.organization_members where organization_id=p_org and user_id=auth.uid()) then raise exception 'OPERATION_FORBIDDEN'; end if;
 return coalesce((select jsonb_agg(x) from(select id,type,state,stage,entity_id,error_code,cancel_requested,created_at,updated_at,(actor_id=auth.uid() and type in('rfq_pdf_process','po_pdf_process') and private.operation_actor_allowed(organization_id,auth.uid())) as can_control from private.operation_jobs where organization_id=p_org and (p_id is null or id=p_id) order by created_at desc limit 50)x),'[]');
end $$;
create or replace function public.operation_control(p_org uuid,p_id uuid,p_action text) returns void
language plpgsql security definer set search_path='' as $$
declare j private.operation_jobs;
begin
 if not private.operation_actor_allowed(p_org,auth.uid()) then raise exception 'OPERATION_FORBIDDEN'; end if;
 select * into j from private.operation_jobs where id=p_id and organization_id=p_org for update;
 if not found or j.actor_id is distinct from auth.uid() then raise exception 'OPERATION_FORBIDDEN'; end if;
 if j.type not in('rfq_pdf_process','po_pdf_process') then raise exception 'OPERATION_UNSAFE_RETRY'; end if;
 if p_action='cancel' and j.state in('queued','retry_wait','blocked','running') then
 update private.operation_jobs set cancel_requested=true,state=case when state='running' then state else 'cancelled' end,updated_at=now() where id=j.id;
 elsif p_action='retry' and j.state in('blocked','dead') and j.error_code in('config','budget','network','provider_rate','provider_unavailable','database') and j.created_at+make_interval(secs=>j.max_age_seconds)>now() then
 update private.operation_jobs set state='queued',error_code=null,updated_at=now(),available_at=now() where id=j.id;
 else raise exception 'OPERATION_UNSAFE_RETRY'; end if;
end $$;

-- Explicit signatures and owners: no private-table API or general worker writes.
do $$ declare f record; begin
 for f in select p.oid::regprocedure::text signature,p.pronamespace::regnamespace::text ns,p.proname from pg_proc p where (p.pronamespace='private'::regnamespace and p.proname in('operation_actor_allowed','operation_fence','operation_claim','operation_heartbeat','operation_checkpoint','operation_finish','operation_reserve_ai','operation_settle_ai')) or (p.pronamespace='public'::regnamespace and p.proname in('begin_document_operation','enqueue_document_operation','operation_status','operation_control')) loop
 execute 'alter function '||f.signature||' owner to averomira_operations_owner';
 execute 'revoke all on function '||f.signature||' from public,anon,authenticated,service_role,averomira_worker';
 if f.ns='public' then execute 'grant execute on function '||f.signature||' to authenticated';
 elsif f.proname not in('operation_actor_allowed','operation_fence') then execute 'grant execute on function '||f.signature||' to averomira_worker'; end if;
 end loop;
end $$;
commit;
