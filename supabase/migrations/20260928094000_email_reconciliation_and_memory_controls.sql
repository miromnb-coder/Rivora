-- Pilot reliability: durable email send reconciliation and auditable Customer Memory deletion.

create table if not exists public.quote_email_attempts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  quote_id uuid not null references public.quotes(id) on delete cascade,
  attempt_no integer not null check (attempt_no > 0),
  idempotency_key text not null unique,
  recipient_email text not null,
  status text not null default 'pending'
    check (status in ('pending','provider_accepted','sent','delivered','bounced','failed')),
  provider_email_id text unique,
  provider_response jsonb not null default '{}'::jsonb,
  error_message text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  accepted_at timestamptz,
  reconciled_at timestamptz,
  updated_at timestamptz not null default now(),
  unique (quote_id, attempt_no)
);

create index if not exists quote_email_attempts_quote_created_idx
  on public.quote_email_attempts(quote_id, created_at desc);
create index if not exists quote_email_attempts_org_created_idx
  on public.quote_email_attempts(organization_id, created_at desc);

alter table public.quote_email_attempts enable row level security;

drop policy if exists quote_email_attempts_select on public.quote_email_attempts;
create policy quote_email_attempts_select on public.quote_email_attempts
for select to authenticated
using (private.is_org_member(organization_id));

drop policy if exists quote_email_attempts_insert on public.quote_email_attempts;
create policy quote_email_attempts_insert on public.quote_email_attempts
for insert to authenticated
with check (
  private.has_org_role(organization_id, array['owner','admin'])
  and (created_by is null or created_by = (select auth.uid()))
);

drop policy if exists quote_email_attempts_update on public.quote_email_attempts;
create policy quote_email_attempts_update on public.quote_email_attempts
for update to authenticated
using (private.has_org_role(organization_id, array['owner','admin']))
with check (private.has_org_role(organization_id, array['owner','admin']));

grant select, insert, update on public.quote_email_attempts to authenticated;

create or replace function public.begin_quote_email_attempt(
  target_quote_id uuid,
  target_recipient_email text
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  org_id uuid;
  q_status text;
  q_delivery_status text;
  attempt_number integer;
  attempt_id uuid;
  idem text;
begin
  select organization_id, status, delivery_status
    into org_id, q_status, q_delivery_status
  from public.quotes
  where id = target_quote_id;

  if org_id is null then raise exception 'Quote not found'; end if;
  if not private.has_org_role(org_id, array['owner','admin']) then raise exception 'Not authorized'; end if;

  if exists (
    select 1 from public.quote_email_attempts
    where quote_id = target_quote_id
      and status in ('pending','provider_accepted')
  ) then
    raise exception 'A quote email send is already pending reconciliation';
  end if;

  if not (
    q_status = 'approved'
    or (q_status = 'sent' and q_delivery_status in ('bounced','failed'))
  ) then
    raise exception 'Quote is not eligible for sending';
  end if;

  if target_recipient_email is null
     or target_recipient_email !~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
  then
    raise exception 'Valid recipient email is required';
  end if;

  select greatest(
    coalesce((select max(attempt_no) from public.quote_email_attempts where quote_id=target_quote_id),0),
    coalesce((select delivery_attempt_count from public.quotes where id=target_quote_id),0)
  ) + 1 into attempt_number;

  attempt_id := gen_random_uuid();
  idem := 'nodra-quote-' || target_quote_id::text || '-attempt-' || attempt_number::text;

  insert into public.quote_email_attempts(
    id,organization_id,quote_id,attempt_no,idempotency_key,recipient_email,status,created_by
  ) values (
    attempt_id,org_id,target_quote_id,attempt_number,idem,lower(target_recipient_email),'pending',uid
  );

  perform private.write_activity_event(
    org_id,'quote',target_quote_id,'quote_send_attempted',
    jsonb_build_object('attempt_id',attempt_id,'attempt_no',attempt_number,'recipient_email',lower(target_recipient_email)),
    uid
  );

  return jsonb_build_object(
    'attempt_id',attempt_id,
    'attempt_no',attempt_number,
    'idempotency_key',idem
  );
end;
$$;

create or replace function public.fail_quote_email_attempt(
  target_attempt_id uuid,
  target_error_message text
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  org_id uuid;
  q_id uuid;
begin
  select organization_id, quote_id into org_id, q_id
  from public.quote_email_attempts
  where id=target_attempt_id;

  if org_id is null then raise exception 'Email attempt not found'; end if;
  if not private.has_org_role(org_id,array['owner','admin']) then raise exception 'Not authorized'; end if;

  update public.quote_email_attempts
  set status='failed',
      error_message=left(coalesce(target_error_message,'Provider rejected send'),1000),
      updated_at=now()
  where id=target_attempt_id and status='pending';

  perform private.write_activity_event(
    org_id,'quote',q_id,'quote_send_failed',
    jsonb_build_object('attempt_id',target_attempt_id,'error',left(coalesce(target_error_message,''),500)),
    (select auth.uid())
  );
end;
$$;

create or replace function public.record_quote_email_provider_accept(
  target_attempt_id uuid,
  target_provider_email_id text,
  target_provider_response jsonb default '{}'::jsonb
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  org_id uuid;
begin
  select organization_id into org_id
  from public.quote_email_attempts
  where id=target_attempt_id;

  if org_id is null then raise exception 'Email attempt not found'; end if;
  if not private.has_org_role(org_id,array['owner','admin']) then raise exception 'Not authorized'; end if;
  if nullif(trim(target_provider_email_id),'') is null then raise exception 'Provider email id is required'; end if;

  update public.quote_email_attempts
  set status='provider_accepted',
      provider_email_id=target_provider_email_id,
      provider_response=coalesce(target_provider_response,'{}'::jsonb),
      accepted_at=coalesce(accepted_at,now()),
      error_message=null,
      updated_at=now()
  where id=target_attempt_id
    and status in ('pending','provider_accepted');
end;
$$;

create or replace function private.reconcile_quote_email_attempt_impl(target_attempt_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  a public.quote_email_attempts%rowtype;
  q public.quotes%rowtype;
  reconcile_time timestamptz;
begin
  select * into a from public.quote_email_attempts where id=target_attempt_id for update;
  if a.id is null then raise exception 'Email attempt not found'; end if;
  if a.provider_email_id is null or a.status not in ('provider_accepted','sent','delivered','bounced','failed') then
    raise exception 'Email attempt has not been accepted by provider';
  end if;

  select * into q from public.quotes where id=a.quote_id for update;
  if q.id is null then raise exception 'Quote not found'; end if;

  reconcile_time := coalesce(a.accepted_at,a.updated_at,now());

  update public.quotes
  set status = case when status='approved' then 'sent' else status end,
      sent_at = coalesce(sent_at,reconcile_time),
      last_sent_at = greatest(coalesce(last_sent_at,reconcile_time),reconcile_time),
      sent_to_email = a.recipient_email,
      email_provider_id = a.provider_email_id,
      delivery_status = case
        when a.status in ('delivered','bounced','failed') then a.status
        else 'sent'
      end,
      delivery_status_at = greatest(coalesce(delivery_status_at,reconcile_time),reconcile_time),
      delivered_at = case when a.status='delivered' then coalesce(delivered_at,a.updated_at) else delivered_at end,
      bounced_at = case when a.status='bounced' then coalesce(bounced_at,a.updated_at) else bounced_at end,
      failed_at = case when a.status='failed' then coalesce(failed_at,a.updated_at) else failed_at end,
      delivery_attempt_count = greatest(delivery_attempt_count,a.attempt_no),
      updated_at = greatest(updated_at,reconcile_time)
  where id=a.quote_id;

  update public.quote_email_attempts
  set status = case when status='provider_accepted' then 'sent' else status end,
      reconciled_at=now(),
      updated_at=now()
  where id=a.id;

  return jsonb_build_object('quote_id',a.quote_id,'attempt_id',a.id,'attempt_no',a.attempt_no);
end;
$$;

revoke all on function private.reconcile_quote_email_attempt_impl(uuid) from public;

create or replace function public.reconcile_quote_email_attempt(target_attempt_id uuid)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  org_id uuid;
begin
  select organization_id into org_id from public.quote_email_attempts where id=target_attempt_id;
  if org_id is null then raise exception 'Email attempt not found'; end if;
  if not private.has_org_role(org_id,array['owner','admin']) then raise exception 'Not authorized'; end if;
  return private.reconcile_quote_email_attempt_impl(target_attempt_id);
end;
$$;

create or replace function public.reconcile_quote_email_delivery(target_quote_id uuid)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  org_id uuid;
  attempt_id uuid;
begin
  select organization_id into org_id from public.quotes where id=target_quote_id;
  if org_id is null then raise exception 'Quote not found'; end if;
  if not private.has_org_role(org_id,array['owner','admin']) then raise exception 'Not authorized'; end if;

  select id into attempt_id
  from public.quote_email_attempts
  where quote_id=target_quote_id and status='provider_accepted'
  order by attempt_no desc
  limit 1;

  if attempt_id is null then
    return jsonb_build_object('status','nothing_to_reconcile');
  end if;

  perform private.reconcile_quote_email_attempt_impl(attempt_id);
  return jsonb_build_object('status','reconciled','attempt_id',attempt_id);
end;
$$;

-- Extend webhook reconciliation so a provider-accepted attempt can repair quote state
-- even if the original post-send quote update failed.
create or replace function private.process_resend_webhook_impl(
  p_payload text,
  p_svix_id text,
  p_svix_timestamp text,
  p_svix_signature text
)
returns jsonb
language plpgsql
security definer
set search_path = 'pg_catalog','public','private','extensions'
as $$
declare
  v_secret text;
  v_secret_bytes bytea;
  v_signed_content text;
  v_expected text;
  v_sig text;
  v_valid boolean := false;
  v_now_epoch bigint := floor(extract(epoch from now()));
  v_event jsonb;
  v_event_name text;
  v_event_type text;
  v_provider_email_id text;
  v_provider_event_id text;
  v_recipient text;
  v_occurred_at timestamptz;
  v_message_id text;
  v_tag_quote_id text;
  v_quote_id uuid;
  v_org_id uuid;
  v_attempt_id uuid;
begin
  if p_payload is null or p_svix_id is null or p_svix_timestamp is null or p_svix_signature is null then
    raise exception 'Missing webhook signature headers';
  end if;
  if p_svix_timestamp !~ '^[0-9]+$' then raise exception 'Invalid webhook timestamp'; end if;
  if abs(v_now_epoch - p_svix_timestamp::bigint) > 300 then raise exception 'Webhook timestamp outside allowed window'; end if;

  select secret_value into v_secret
  from private.integration_secrets where name='resend_webhook_signing_secret';
  if v_secret is null or v_secret !~ '^whsec_' then raise exception 'Webhook verification is not configured'; end if;

  v_secret_bytes := decode(substring(v_secret from 7),'base64');
  v_signed_content := p_svix_id || '.' || p_svix_timestamp || '.' || p_payload;
  v_expected := encode(extensions.hmac(convert_to(v_signed_content,'UTF8'),v_secret_bytes,'sha256'),'base64');

  foreach v_sig in array regexp_split_to_array(p_svix_signature,E'\\s+')
  loop
    if split_part(v_sig,',',1)='v1'
       and extensions.digest(convert_to(split_part(v_sig,',',2),'UTF8'),'sha256')
         = extensions.digest(convert_to(v_expected,'UTF8'),'sha256')
    then v_valid:=true; exit; end if;
  end loop;
  if not v_valid then raise exception 'Invalid webhook signature'; end if;

  v_event:=p_payload::jsonb;
  v_event_name:=v_event->>'type';
  v_event_type:=case v_event_name
    when 'email.sent' then 'sent'
    when 'email.delivered' then 'delivered'
    when 'email.bounced' then 'bounced'
    when 'email.failed' then 'failed'
    else null end;
  if v_event_type is null then return jsonb_build_object('status','ignored','reason','event_type'); end if;

  v_provider_email_id:=coalesce(v_event #>> '{data,email_id}',v_event #>> '{data,id}');
  if nullif(v_provider_email_id,'') is null then raise exception 'Webhook email id missing'; end if;

  v_provider_event_id:=coalesce(v_event->>'id',p_svix_id);
  if jsonb_typeof(v_event #> '{data,to}')='array' then
    v_recipient:=v_event #>> '{data,to,0}';
  else
    v_recipient:=v_event #>> '{data,to}';
  end if;
  v_occurred_at:=coalesce(
    nullif(v_event->>'created_at','')::timestamptz,
    nullif(v_event #>> '{data,created_at}','')::timestamptz,
    now()
  );
  v_message_id:=nullif(v_event #>> '{data,message_id}','');

  select a.id,a.quote_id,a.organization_id
    into v_attempt_id,v_quote_id,v_org_id
  from public.quote_email_attempts a
  where a.provider_email_id=v_provider_email_id
  order by a.attempt_no desc
  limit 1;

  if v_quote_id is null then
    select q.id,q.organization_id into v_quote_id,v_org_id
    from public.quotes q where q.email_provider_id=v_provider_email_id limit 1;
  end if;

  if v_quote_id is null then
    select e.quote_id,e.organization_id into v_quote_id,v_org_id
    from public.quote_email_events e
    where e.provider_email_id=v_provider_email_id
    order by e.occurred_at desc limit 1;
  end if;

  if v_quote_id is null then
    v_tag_quote_id:=nullif(v_event #>> '{data,tags,nodra_quote_id}','');
    if v_tag_quote_id is not null
       and v_tag_quote_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    then
      select q.id,q.organization_id into v_quote_id,v_org_id
      from public.quotes q where q.id=v_tag_quote_id::uuid limit 1;
    end if;
  end if;

  if v_quote_id is null then return jsonb_build_object('status','ignored','reason','quote_not_found'); end if;

  if v_recipient is null or char_length(v_recipient)=0 then
    select coalesce(q.sent_to_email,q.recipient_email,'unknown') into v_recipient
    from public.quotes q where q.id=v_quote_id;
  end if;

  insert into public.quote_email_events(
    organization_id,quote_id,provider_email_id,provider_event_id,event_type,
    recipient_email,occurred_at,message_id,raw_payload
  ) values (
    v_org_id,v_quote_id,v_provider_email_id,v_provider_event_id,v_event_type,
    v_recipient,v_occurred_at,v_message_id,v_event
  )
  on conflict (provider_email_id,event_type)
  do update set
    provider_event_id=excluded.provider_event_id,
    recipient_email=excluded.recipient_email,
    occurred_at=excluded.occurred_at,
    message_id=coalesce(excluded.message_id,quote_email_events.message_id),
    raw_payload=excluded.raw_payload;

  if v_attempt_id is not null then
    update public.quote_email_attempts
    set status=v_event_type,
        updated_at=greatest(updated_at,v_occurred_at),
        reconciled_at=coalesce(reconciled_at,now())
    where id=v_attempt_id;

    perform private.reconcile_quote_email_attempt_impl(v_attempt_id);
  else
    update public.quotes q
    set status=case when q.status='approved' then 'sent' else q.status end,
        email_provider_id=case when q.delivery_status_at is null or v_occurred_at>=q.delivery_status_at then v_provider_email_id else q.email_provider_id end,
        sent_to_email=case when q.delivery_status_at is null or v_occurred_at>=q.delivery_status_at then coalesce(v_recipient,q.sent_to_email,q.recipient_email) else q.sent_to_email end,
        delivery_status=case when q.delivery_status_at is null or v_occurred_at>=q.delivery_status_at then v_event_type else q.delivery_status end,
        delivery_status_at=case when q.delivery_status_at is null or v_occurred_at>=q.delivery_status_at then v_occurred_at else q.delivery_status_at end,
        sent_at=coalesce(q.sent_at,v_occurred_at),
        last_sent_at=case when v_event_type='sent' then greatest(coalesce(q.last_sent_at,v_occurred_at),v_occurred_at) else q.last_sent_at end,
        delivered_at=case when v_event_type='delivered' then v_occurred_at else q.delivered_at end,
        bounced_at=case when v_event_type='bounced' then v_occurred_at else q.bounced_at end,
        failed_at=case when v_event_type='failed' then v_occurred_at else q.failed_at end,
        updated_at=greatest(q.updated_at,v_occurred_at)
    where q.id=v_quote_id
      and (q.delivery_status_at is null or v_occurred_at>=q.delivery_status_at);
  end if;

  return jsonb_build_object('status','processed','quote_id',v_quote_id,'event_type',v_event_type,'attempt_id',v_attempt_id);
end;
$$;

-- Record Customer Memory deletion before the row disappears.
create or replace function private.audit_customer_memory()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op='INSERT' then
    perform private.write_activity_event(
      new.organization_id,'customer_memory',new.id,'customer_memory_created',
      jsonb_build_object('customer_id',new.customer_id,'customer_sku',new.customer_sku,'product_id',new.product_id),
      new.confirmed_by_user_id
    );
    return new;
  elsif tg_op='UPDATE' then
    if old.product_id is distinct from new.product_id then
      perform private.write_activity_event(
        new.organization_id,'customer_memory',new.id,'customer_memory_changed',
        jsonb_build_object('customer_id',new.customer_id,'customer_sku',new.customer_sku,'old_product_id',old.product_id,'new_product_id',new.product_id),
        coalesce(new.confirmed_by_user_id,(select auth.uid()))
      );
    end if;
    return new;
  else
    perform private.write_activity_event(
      old.organization_id,'customer_memory',old.id,'customer_memory_deleted',
      jsonb_build_object('customer_id',old.customer_id,'customer_sku',old.customer_sku,'product_id',old.product_id),
      (select auth.uid())
    );
    return old;
  end if;
end;
$$;

drop trigger if exists customer_memory_audit on public.customer_product_mappings;
create trigger customer_memory_audit
after insert or update or delete on public.customer_product_mappings
for each row execute function private.audit_customer_memory();
