-- Fix the authenticated reconciliation RPC boundary without exposing the private helper.
-- Both public RPCs perform an explicit workspace role check before invoking privileged logic.

create or replace function public.reconcile_quote_email_attempt(target_attempt_id uuid)
returns jsonb
language plpgsql
security definer
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

  return private.reconcile_quote_email_attempt_impl(target_attempt_id);
end;
$$;

revoke all on function public.reconcile_quote_email_attempt(uuid) from public;
grant execute on function public.reconcile_quote_email_attempt(uuid) to authenticated, service_role;

create or replace function public.reconcile_quote_email_delivery(target_quote_id uuid)
returns jsonb
language plpgsql
security definer
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

  perform private.reconcile_quote_email_attempt_impl(attempt_id);
  return jsonb_build_object('status','reconciled','attempt_id',attempt_id);
end;
$$;

revoke all on function public.reconcile_quote_email_delivery(uuid) from public;
grant execute on function public.reconcile_quote_email_delivery(uuid) to authenticated, service_role;
