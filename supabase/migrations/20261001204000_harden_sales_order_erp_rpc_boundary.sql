-- Harden Sprint 3 ERP RPC boundary: only server-side service role can execute
-- state-changing SECURITY DEFINER functions. Actor authorization is checked explicitly.

revoke execute on function public.create_sales_order_draft(uuid) from authenticated;
revoke execute on function public.begin_erp_delivery_attempt(uuid,text,jsonb) from authenticated;
revoke execute on function public.finish_erp_delivery_attempt(uuid,text,text,text,text,jsonb) from authenticated;

drop function if exists public.create_sales_order_draft(uuid);
drop function if exists public.begin_erp_delivery_attempt(uuid,text,jsonb);
drop function if exists public.finish_erp_delivery_attempt(uuid,text,text,text,text,jsonb);

create or replace function public.create_sales_order_draft_server(
  target_purchase_order_id uuid,
  target_actor_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_org uuid;
  target_customer uuid;
  target_quote uuid;
  target_po_number text;
  target_order_date date;
  target_currency text;
  target_reconciliation uuid;
  existing_draft uuid;
  created_draft uuid;
  omitted_count integer;
begin
  if target_actor_id is null then
    raise exception 'Actor is required';
  end if;

  select p.organization_id, p.customer_id, p.quote_id, p.po_number,
         coalesce(p.order_date, current_date), p.currency
  into target_org, target_customer, target_quote, target_po_number,
       target_order_date, target_currency
  from public.purchase_orders p
  where p.id = target_purchase_order_id
  for update;

  if target_org is null then
    raise exception 'Purchase order not found';
  end if;

  if not exists (
    select 1
    from public.organization_members m
    where m.organization_id = target_org
      and m.user_id = target_actor_id
      and m.role in ('owner','admin')
  ) then
    raise exception 'Owner or admin access is required to create a sales order draft';
  end if;

  select d.id into existing_draft
  from public.sales_order_drafts d
  where d.purchase_order_id = target_purchase_order_id;

  if existing_draft is not null then
    return existing_draft;
  end if;

  if not exists (
    select 1 from public.purchase_orders p
    where p.id = target_purchase_order_id
      and p.status = 'approved'
  ) then
    raise exception 'Purchase order reconciliation must be approved first';
  end if;

  select r.id
  into target_reconciliation
  from public.purchase_order_reconciliations r
  where r.purchase_order_id = target_purchase_order_id
  order by r.run_number desc
  limit 1;

  if target_reconciliation is null then
    raise exception 'Approved reconciliation not found';
  end if;

  if not exists (
    select 1 from public.purchase_order_reconciliations r
    where r.id = target_reconciliation
      and r.status = 'approved'
      and r.quote_id = target_quote
      and r.header_review_status <> 'open'
  ) then
    raise exception 'Latest reconciliation is not approved';
  end if;

  if exists (
    select 1
    from public.purchase_order_reconciliation_lines l
    where l.reconciliation_id = target_reconciliation
      and l.review_status = 'open'
  ) then
    raise exception 'All reconciliation exceptions must be resolved first';
  end if;

  if exists (
    select 1
    from public.purchase_order_reconciliation_lines l
    where l.reconciliation_id = target_reconciliation
      and l.line_kind = 'extra_po'
  ) then
    raise exception 'Extra PO lines must be matched to a quoted product before ERP draft creation';
  end if;

  select count(*) into omitted_count
  from public.purchase_order_reconciliation_lines l
  where l.reconciliation_id = target_reconciliation
    and l.line_kind = 'missing_quote';

  insert into public.sales_order_drafts(
    organization_id,
    purchase_order_id,
    reconciliation_id,
    quote_id,
    customer_id,
    status,
    customer_po_number,
    order_date,
    currency,
    source_policy,
    source_summary,
    created_by
  )
  values (
    target_org,
    target_purchase_order_id,
    target_reconciliation,
    target_quote,
    target_customer,
    'draft',
    target_po_number,
    target_order_date,
    upper(target_currency),
    'accepted_po_preferred_v1',
    jsonb_build_object(
      'reconciliation_id', target_reconciliation,
      'omitted_quote_lines', omitted_count,
      'commercial_values', 'purchase_order_when_present_else_quote_net',
      'product_identity', 'approved_quote_product'
    ),
    target_actor_id
  )
  returning id into created_draft;

  insert into public.sales_order_draft_lines(
    organization_id,
    sales_order_draft_id,
    line_number,
    source_reconciliation_line_id,
    source_po_line_id,
    source_quote_line_id,
    product_id,
    sku,
    description,
    quantity,
    unit,
    unit_price,
    line_total,
    source_resolution
  )
  select
    target_org,
    created_draft,
    row_number() over (order by pol.line_number, ql.line_number)::integer,
    rl.id,
    pol.id,
    ql.id,
    ql.product_id,
    coalesce(nullif(ql.sku_snapshot, ''), pr.sku),
    coalesce(nullif(ql.description_snapshot, ''), pr.name, pol.raw_description),
    pol.quantity,
    coalesce(nullif(pol.unit, ''), ql.unit),
    coalesce(pol.unit_price, ql.line_total / nullif(ql.quantity, 0)),
    coalesce(
      pol.line_total,
      pol.quantity * coalesce(pol.unit_price, ql.line_total / nullif(ql.quantity, 0))
    ),
    'po_values_quote_product'
  from public.purchase_order_reconciliation_lines rl
  join public.purchase_order_lines pol on pol.id = rl.po_line_id
  join public.quote_lines ql on ql.id = rl.quote_line_id
  join public.products pr on pr.id = ql.product_id
  where rl.reconciliation_id = target_reconciliation
    and rl.line_kind = 'paired'
  order by pol.line_number, ql.line_number;

  if not exists (
    select 1 from public.sales_order_draft_lines l
    where l.sales_order_draft_id = created_draft
  ) then
    raise exception 'Sales order draft would contain no ordered lines';
  end if;

  perform private.write_activity_event(
    target_org,
    'purchase_order',
    target_purchase_order_id,
    'sales_order_draft_created',
    jsonb_build_object(
      'sales_order_draft_id', created_draft,
      'reconciliation_id', target_reconciliation,
      'quote_id', target_quote,
      'omitted_quote_lines', omitted_count
    ),
    target_actor_id
  );

  return created_draft;
end;
$$;

revoke all on function public.create_sales_order_draft_server(uuid,uuid) from public;
revoke all on function public.create_sales_order_draft_server(uuid,uuid) from anon;
revoke all on function public.create_sales_order_draft_server(uuid,uuid) from authenticated;
grant execute on function public.create_sales_order_draft_server(uuid,uuid) to service_role;

create or replace function public.begin_erp_delivery_attempt_server(
  target_sales_order_draft_id uuid,
  target_provider text,
  target_request_payload jsonb,
  target_actor_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_org uuid;
  target_status text;
  next_attempt integer;
  created_attempt uuid;
begin
  if target_actor_id is null then
    raise exception 'Actor is required';
  end if;

  if target_provider <> 'business_central' then
    raise exception 'Unsupported ERP provider';
  end if;

  select d.organization_id, d.status
  into target_org, target_status
  from public.sales_order_drafts d
  where d.id = target_sales_order_draft_id
  for update;

  if target_org is null then
    raise exception 'Sales order draft not found';
  end if;

  if not exists (
    select 1
    from public.organization_members m
    where m.organization_id = target_org
      and m.user_id = target_actor_id
      and m.role in ('owner','admin')
  ) then
    raise exception 'Owner or admin access is required for ERP export';
  end if;

  if target_status not in ('draft','erp_failed') then
    raise exception 'Sales order draft is not eligible for ERP export';
  end if;

  if exists (
    select 1 from public.erp_delivery_attempts a
    where a.sales_order_draft_id = target_sales_order_draft_id
      and a.status in ('pending','created','partial','existing')
  ) then
    raise exception 'An ERP attempt already exists or requires review';
  end if;

  select coalesce(max(a.attempt_no), 0) + 1
  into next_attempt
  from public.erp_delivery_attempts a
  where a.sales_order_draft_id = target_sales_order_draft_id;

  insert into public.erp_delivery_attempts(
    organization_id,
    sales_order_draft_id,
    provider,
    attempt_no,
    status,
    request_payload,
    created_by
  )
  values (
    target_org,
    target_sales_order_draft_id,
    target_provider,
    next_attempt,
    'pending',
    coalesce(target_request_payload, '{}'::jsonb),
    target_actor_id
  )
  returning id into created_attempt;

  update public.sales_order_drafts
  set status = 'erp_pending',
      erp_provider = target_provider,
      erp_error = null,
      updated_at = now()
  where id = target_sales_order_draft_id;

  return created_attempt;
end;
$$;

revoke all on function public.begin_erp_delivery_attempt_server(uuid,text,jsonb,uuid) from public;
revoke all on function public.begin_erp_delivery_attempt_server(uuid,text,jsonb,uuid) from anon;
revoke all on function public.begin_erp_delivery_attempt_server(uuid,text,jsonb,uuid) from authenticated;
grant execute on function public.begin_erp_delivery_attempt_server(uuid,text,jsonb,uuid) to service_role;

create or replace function public.finish_erp_delivery_attempt_server(
  target_attempt_id uuid,
  target_status text,
  target_external_order_id text,
  target_external_order_number text,
  target_error_message text,
  target_response_summary jsonb,
  target_actor_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_org uuid;
  target_draft uuid;
  current_status text;
  draft_status text;
begin
  if target_actor_id is null then
    raise exception 'Actor is required';
  end if;

  if target_status not in ('created','partial','existing','failed') then
    raise exception 'Unsupported ERP attempt result';
  end if;

  select a.organization_id, a.sales_order_draft_id, a.status
  into target_org, target_draft, current_status
  from public.erp_delivery_attempts a
  where a.id = target_attempt_id
  for update;

  if target_org is null then
    raise exception 'ERP delivery attempt not found';
  end if;

  if not exists (
    select 1
    from public.organization_members m
    where m.organization_id = target_org
      and m.user_id = target_actor_id
      and m.role in ('owner','admin')
  ) then
    raise exception 'Owner or admin access is required for ERP export';
  end if;

  if current_status <> 'pending' then
    raise exception 'ERP delivery attempt is already completed';
  end if;

  draft_status := case
    when target_status = 'created' then 'erp_created'
    when target_status in ('partial','existing') then 'erp_partial'
    else 'erp_failed'
  end;

  update public.erp_delivery_attempts
  set status = target_status,
      external_order_id = nullif(target_external_order_id, ''),
      external_order_number = nullif(target_external_order_number, ''),
      error_message = nullif(left(coalesce(target_error_message, ''), 3000), ''),
      response_summary = coalesce(target_response_summary, '{}'::jsonb),
      completed_at = now()
  where id = target_attempt_id;

  update public.sales_order_drafts
  set status = draft_status,
      external_order_id = nullif(target_external_order_id, ''),
      external_order_number = nullif(target_external_order_number, ''),
      erp_error = nullif(left(coalesce(target_error_message, ''), 3000), ''),
      updated_at = now()
  where id = target_draft
    and organization_id = target_org;

  perform private.write_activity_event(
    target_org,
    'sales_order_draft',
    target_draft,
    case
      when target_status = 'created' then 'erp_sales_order_created'
      when target_status = 'existing' then 'erp_existing_order_detected'
      when target_status = 'partial' then 'erp_sales_order_partial'
      else 'erp_sales_order_failed'
    end,
    jsonb_build_object(
      'attempt_id', target_attempt_id,
      'provider', 'business_central',
      'result', target_status,
      'external_order_id', nullif(target_external_order_id, ''),
      'external_order_number', nullif(target_external_order_number, ''),
      'error', nullif(left(coalesce(target_error_message, ''), 500), '')
    ),
    target_actor_id
  );
end;
$$;

revoke all on function public.finish_erp_delivery_attempt_server(uuid,text,text,text,text,jsonb,uuid) from public;
revoke all on function public.finish_erp_delivery_attempt_server(uuid,text,text,text,text,jsonb,uuid) from anon;
revoke all on function public.finish_erp_delivery_attempt_server(uuid,text,text,text,text,jsonb,uuid) from authenticated;
grant execute on function public.finish_erp_delivery_attempt_server(uuid,text,text,text,text,jsonb,uuid) to service_role;
