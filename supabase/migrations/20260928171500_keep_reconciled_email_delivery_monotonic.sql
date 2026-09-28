-- Keep provider delivery state monotonic during reconciliation.
-- Provider webhook events are the source of truth for provider status and time.

create or replace function private.reconcile_quote_email_attempt_impl(target_attempt_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  a public.quote_email_attempts%rowtype;
  q public.quotes%rowtype;
  provider_event public.quote_email_events%rowtype;
  effective_status text;
  effective_time timestamptz;
  keep_quote_terminal boolean := false;
  keep_attempt_terminal boolean := false;
begin
  select * into a
  from public.quote_email_attempts
  where id=target_attempt_id
  for update;

  if a.id is null then raise exception 'Email attempt not found'; end if;
  if a.provider_email_id is null
     or a.status not in ('provider_accepted','sent','delivered','bounced','failed')
  then
    raise exception 'Email attempt has not been accepted by provider';
  end if;

  select * into q
  from public.quotes
  where id=a.quote_id
  for update;

  if q.id is null then raise exception 'Quote not found'; end if;

  select e.* into provider_event
  from public.quote_email_events e
  where e.quote_id=a.quote_id
    and e.provider_email_id=a.provider_email_id
    and e.event_type in ('sent','delivered','bounced','failed')
  order by
    e.occurred_at desc,
    case e.event_type
      when 'delivered' then 4
      when 'bounced' then 3
      when 'failed' then 2
      when 'sent' then 1
      else 0
    end desc
  limit 1;

  if provider_event.id is not null then
    effective_status := provider_event.event_type;
    effective_time := provider_event.occurred_at;
  else
    effective_status := case
      when a.status='provider_accepted' then 'sent'
      else a.status
    end;
    effective_time := coalesce(a.provider_status_at,a.accepted_at,a.updated_at,now());
  end if;

  keep_quote_terminal :=
    q.delivery_status in ('delivered','bounced','failed')
    and effective_status='sent';

  keep_attempt_terminal :=
    a.status in ('delivered','bounced','failed')
    and effective_status='sent';

  update public.quote_email_attempts
  set status = case
        when keep_attempt_terminal then status
        else effective_status
      end,
      provider_status_at = case
        when keep_attempt_terminal then provider_status_at
        else greatest(coalesce(provider_status_at,effective_time),effective_time)
      end,
      reconciled_at = now(),
      updated_at = greatest(updated_at,now())
  where id=a.id;

  update public.quotes
  set status = case when status='approved' then 'sent' else status end,
      sent_at = coalesce(sent_at,coalesce(a.accepted_at,effective_time)),
      last_sent_at = greatest(
        coalesce(last_sent_at,coalesce(a.accepted_at,effective_time)),
        coalesce(a.accepted_at,effective_time)
      ),
      sent_to_email = a.recipient_email,
      email_provider_id = a.provider_email_id,
      delivery_status = case
        when keep_quote_terminal then delivery_status
        when delivery_status_at is not null
          and effective_time < delivery_status_at
          then delivery_status
        else effective_status
      end,
      delivery_status_at = case
        when keep_quote_terminal then delivery_status_at
        when delivery_status_at is not null
          and effective_time < delivery_status_at
          then delivery_status_at
        else effective_time
      end,
      delivered_at = case
        when not keep_quote_terminal
          and effective_status='delivered'
          and (delivery_status_at is null or effective_time>=delivery_status_at)
          then effective_time
        else delivered_at
      end,
      bounced_at = case
        when not keep_quote_terminal
          and effective_status='bounced'
          and (delivery_status_at is null or effective_time>=delivery_status_at)
          then effective_time
        else bounced_at
      end,
      failed_at = case
        when not keep_quote_terminal
          and effective_status='failed'
          and (delivery_status_at is null or effective_time>=delivery_status_at)
          then effective_time
        else failed_at
      end,
      delivery_attempt_count = greatest(delivery_attempt_count,a.attempt_no),
      updated_at = greatest(updated_at,now())
  where id=a.quote_id;

  return jsonb_build_object(
    'quote_id',a.quote_id,
    'attempt_id',a.id,
    'attempt_no',a.attempt_no,
    'delivery_status',(select delivery_status from public.quotes where id=a.quote_id)
  );
end;
$$;

revoke all on function private.reconcile_quote_email_attempt_impl(uuid) from public;
