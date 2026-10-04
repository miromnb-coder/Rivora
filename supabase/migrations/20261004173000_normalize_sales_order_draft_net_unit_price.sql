-- Keep Sales Order Draft commercial fields internally consistent.
-- When a PO provides a line total, use its effective net unit price (line total / quantity)
-- so discounts represented in the PO do not produce a gross unit price with a net line total.

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
    coalesce(
      pol.line_total / nullif(pol.quantity, 0),
      pol.unit_price,
      ql.line_total / nullif(ql.quantity, 0)
    ),
    coalesce(
      pol.line_total,
      pol.quantity * coalesce(
        pol.unit_price,
        ql.line_total / nullif(ql.quantity, 0)
      )
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
