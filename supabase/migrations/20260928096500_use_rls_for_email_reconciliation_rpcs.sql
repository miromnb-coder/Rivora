-- Keep public reconciliation RPCs under normal RLS instead of SECURITY DEFINER.
-- The private webhook path retains its own privileged helper.

create or replace function public.reconcile_quote_email_attempt(target_attempt_id uuid)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  a public.quote_email_attempts%rowtype;
  q public.quotes%rowtype;
  reconcile_time timestamptz;
begin
  select * into a
  from public.quote_email_attempts
  where id=target_attempt_id
  for update;

  if a.id is null then raise exception 'Email attempt not found'; end if;
  if not private.has_org_role(a.organization_id,array['owner','admin']) then
    raise exception 'Not authorized';
  end if;
  if a.provider_email_id is null or a.status not in ('provider_accepted','sent','delivered','bounced','failed') then
    raise exception 'Email attempt has not been accepted by provider';
  end if;

  select * into q
  from public.quotes
  where id=a.quote_id
  for update;

  if q.id is null then raise exception 'Quote not found'; end if;

  reconcile_time := coalesce(a.accepted_at,a.provider_status_at,a.updated_at,now());

  update public.quotes
  set status = case when status='approved' then 'sent' else status end,
      sent_at = coalesce(sent_at,reconcile_time),
      last_sent_at = greatest(coalesce(last_sent_at,reconcile_time),reconcile_time),
      sent_to_email = a.recipient_email,
      email_provider_id = a.provider_email_id,
      delivery_status = case
        when delivery_status_at is not null
          and coalesce(a.provider_status_at,reconcile_time) < delivery_status_at
          then delivery_status
        when a.status in ('delivered','bounced','failed') then a.status
        else 'sent'
      end,
      delivery_status_at = case
        when delivery_status_at is not null
          and coalesce(a.provider_status_at,reconcile_time) < delivery_status_at
          then delivery_status_at
        else coalesce(a.provider_status_at,reconcile_time)
      end,
      delivered_at = case
        when a.status='delivered'
          and (delivery_status_at is null or coalesce(a.provider_status_at,reconcile_time)>=delivery_status_at)
          then coalesce(a.provider_status_at,reconcile_time)
        else delivered_at
      end,
      bounced_at = case
        when a.status='bounced'
          and (delivery_status_at is null or coalesce(a.provider_status_at,reconcile_time)>=delivery_status_at)
          then coalesce(a.provider_status_at,reconcile_time)
        else bounced_at
      end,
      failed_at = case
        when a.status='failed'
          and (delivery_status_at is null or coalesce(a.provider_status_at,reconcile_time)>=delivery_status_at)
          then coalesce(a.provider_status_at,reconcile_time)
        else failed_at
      end,
      delivery_attempt_count = greatest(delivery_attempt_count,a.attempt_no),
      updated_at = greatest(updated_at,reconcile_time)
  where id=a.quote_id;

  update public.quote_email_attempts
  set status=case when status='provider_accepted' then 'sent' else status end,
      reconciled_at=coalesce(reconciled_at,now()),
      updated_at=now()
  where id=a.id;

  return jsonb_build_object('quote_id',a.quote_id,'attempt_id',a.id,'attempt_no',a.attempt_no);
end;
$$;

revoke all on function public.reconcile_quote_email_attempt(uuid) from public;
grant execute on function public.reconcile_quote_email_attempt(uuid) to authenticated;

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
  select organization_id into org_id
  from public.quotes
  where id=target_quote_id;

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

  perform public.reconcile_quote_email_attempt(attempt_id);
  return jsonb_build_object('status','reconciled','attempt_id',attempt_id);
end;
$$;

revoke all on function public.reconcile_quote_email_delivery(uuid) from public;
grant execute on function public.reconcile_quote_email_delivery(uuid) to authenticated;
