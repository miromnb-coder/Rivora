-- Reconcile pending attempts from signed Resend webhook tags when provider acceptance
-- reached Resend but the synchronous provider-id persistence step failed.

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
  v_tag_attempt_id text;
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
  v_tag_attempt_id:=nullif(v_event #>> '{data,tags,nodra_attempt_id}','');
  v_tag_quote_id:=nullif(v_event #>> '{data,tags,nodra_quote_id}','');

  select a.id,a.quote_id,a.organization_id
    into v_attempt_id,v_quote_id,v_org_id
  from public.quote_email_attempts a
  where a.provider_email_id=v_provider_email_id
  order by a.attempt_no desc
  limit 1;

  if v_attempt_id is null
     and v_tag_attempt_id is not null
     and v_tag_attempt_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  then
    select a.id,a.quote_id,a.organization_id
      into v_attempt_id,v_quote_id,v_org_id
    from public.quote_email_attempts a
    where a.id=v_tag_attempt_id::uuid
    limit 1;

    if v_attempt_id is not null then
      update public.quote_email_attempts
      set provider_email_id=coalesce(provider_email_id,v_provider_email_id),
          accepted_at=coalesce(accepted_at,v_occurred_at),
          updated_at=greatest(updated_at,v_occurred_at)
      where id=v_attempt_id;
    end if;
  end if;

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

  if v_quote_id is null
     and v_tag_quote_id is not null
     and v_tag_quote_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  then
    select q.id,q.organization_id into v_quote_id,v_org_id
    from public.quotes q where q.id=v_tag_quote_id::uuid limit 1;
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
    set provider_email_id=coalesce(provider_email_id,v_provider_email_id),
        status=v_event_type,
        accepted_at=coalesce(accepted_at,v_occurred_at),
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
