-- Sprint 3: Sales Order Draft + Business Central adapter foundation.

create table public.erp_entity_mappings (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  provider text not null check (provider in ('business_central')),
  entity_type text not null check (entity_type in ('customer','product')),
  local_entity_id uuid not null,
  external_id text,
  external_number text not null check (char_length(trim(external_number)) between 1 and 120),
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, provider, entity_type, local_entity_id)
);

create table public.sales_order_drafts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  purchase_order_id uuid not null references public.purchase_orders(id) on delete restrict,
  reconciliation_id uuid not null references public.purchase_order_reconciliations(id) on delete restrict,
  quote_id uuid not null references public.quotes(id) on delete restrict,
  customer_id uuid not null references public.customers(id) on delete restrict,
  status text not null default 'draft'
    check (status in ('draft','erp_pending','erp_created','erp_partial','erp_failed')),
  customer_po_number text not null,
  order_date date not null,
  currency text not null check (char_length(trim(currency)) = 3),
  source_policy text not null default 'accepted_po_preferred_v1',
  source_summary jsonb not null default '{}'::jsonb check (jsonb_typeof(source_summary) = 'object'),
  erp_provider text check (erp_provider is null or erp_provider in ('business_central')),
  external_order_id text,
  external_order_number text,
  erp_error text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (purchase_order_id),
  unique (reconciliation_id)
);

create table public.sales_order_draft_lines (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  sales_order_draft_id uuid not null references public.sales_order_drafts(id) on delete cascade,
  line_number integer not null check (line_number > 0),
  source_reconciliation_line_id uuid not null references public.purchase_order_reconciliation_lines(id) on delete restrict,
  source_po_line_id uuid not null references public.purchase_order_lines(id) on delete restrict,
  source_quote_line_id uuid not null references public.quote_lines(id) on delete restrict,
  product_id uuid not null references public.products(id) on delete restrict,
  sku text not null,
  description text not null,
  quantity numeric(14,4) not null check (quantity > 0),
  unit text not null,
  unit_price numeric(14,4) not null check (unit_price >= 0),
  line_total numeric(14,4) not null check (line_total >= 0),
  source_resolution text not null default 'po_values_quote_product'
    check (source_resolution in ('po_values_quote_product')),
  created_at timestamptz not null default now(),
  unique (sales_order_draft_id, line_number)
);

create table public.erp_delivery_attempts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  sales_order_draft_id uuid not null references public.sales_order_drafts(id) on delete cascade,
  provider text not null check (provider in ('business_central')),
  attempt_no integer not null check (attempt_no > 0),
  status text not null default 'pending'
    check (status in ('pending','created','partial','existing','failed')),
  request_payload jsonb not null default '{}'::jsonb check (jsonb_typeof(request_payload) = 'object'),
  response_summary jsonb not null default '{}'::jsonb check (jsonb_typeof(response_summary) = 'object'),
  external_order_id text,
  external_order_number text,
  error_message text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  unique (sales_order_draft_id, attempt_no)
);

create unique index erp_delivery_attempts_one_pending_idx
  on public.erp_delivery_attempts(sales_order_draft_id)
  where status = 'pending';

create index erp_entity_mappings_org_provider_idx
  on public.erp_entity_mappings(organization_id, provider, entity_type);
create index erp_entity_mappings_external_number_idx
  on public.erp_entity_mappings(organization_id, provider, entity_type, external_number);
create index erp_entity_mappings_created_by_idx
  on public.erp_entity_mappings(created_by) where created_by is not null;
create index erp_entity_mappings_updated_by_idx
  on public.erp_entity_mappings(updated_by) where updated_by is not null;

create index sales_order_drafts_org_status_idx
  on public.sales_order_drafts(organization_id, status, created_at desc);
create index sales_order_drafts_quote_idx on public.sales_order_drafts(quote_id);
create index sales_order_drafts_customer_idx on public.sales_order_drafts(customer_id);
create index sales_order_drafts_created_by_idx
  on public.sales_order_drafts(created_by) where created_by is not null;

create index sales_order_draft_lines_org_idx
  on public.sales_order_draft_lines(organization_id);
create index sales_order_draft_lines_draft_idx
  on public.sales_order_draft_lines(sales_order_draft_id, line_number);
create index sales_order_draft_lines_reconciliation_line_idx
  on public.sales_order_draft_lines(source_reconciliation_line_id);
create index sales_order_draft_lines_po_line_idx
  on public.sales_order_draft_lines(source_po_line_id);
create index sales_order_draft_lines_quote_line_idx
  on public.sales_order_draft_lines(source_quote_line_id);
create index sales_order_draft_lines_product_idx
  on public.sales_order_draft_lines(product_id);

create index erp_delivery_attempts_org_created_idx
  on public.erp_delivery_attempts(organization_id, created_at desc);
create index erp_delivery_attempts_draft_idx
  on public.erp_delivery_attempts(sales_order_draft_id, attempt_no desc);
create index erp_delivery_attempts_created_by_idx
  on public.erp_delivery_attempts(created_by) where created_by is not null;

alter table public.erp_entity_mappings enable row level security;
alter table public.sales_order_drafts enable row level security;
alter table public.sales_order_draft_lines enable row level security;
alter table public.erp_delivery_attempts enable row level security;

create policy erp_entity_mappings_select
on public.erp_entity_mappings for select to authenticated
using (private.is_org_member(organization_id));

create policy erp_entity_mappings_insert
on public.erp_entity_mappings for insert to authenticated
with check (private.has_org_role(organization_id, array['owner','admin']));

create policy erp_entity_mappings_update
on public.erp_entity_mappings for update to authenticated
using (private.has_org_role(organization_id, array['owner','admin']))
with check (private.has_org_role(organization_id, array['owner','admin']));

create policy erp_entity_mappings_delete
on public.erp_entity_mappings for delete to authenticated
using (private.has_org_role(organization_id, array['owner','admin']));

create policy sales_order_drafts_select
on public.sales_order_drafts for select to authenticated
using (private.is_org_member(organization_id));

create policy sales_order_draft_lines_select
on public.sales_order_draft_lines for select to authenticated
using (private.is_org_member(organization_id));

create policy erp_delivery_attempts_select
on public.erp_delivery_attempts for select to authenticated
using (private.is_org_member(organization_id));

grant select, insert, update, delete on public.erp_entity_mappings to authenticated;
grant select on public.sales_order_drafts to authenticated;
grant select on public.sales_order_draft_lines to authenticated;
grant select on public.erp_delivery_attempts to authenticated;

create or replace function private.enforce_erp_mapping_scope()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.entity_type = 'customer' then
    if not exists (
      select 1 from public.customers c
      where c.id = new.local_entity_id
        and c.organization_id = new.organization_id
    ) then
      raise exception 'ERP customer mapping must reference a customer in the same workspace';
    end if;
  elsif new.entity_type = 'product' then
    if not exists (
      select 1 from public.products p
      where p.id = new.local_entity_id
        and p.organization_id = new.organization_id
    ) then
      raise exception 'ERP product mapping must reference a product in the same workspace';
    end if;
  else
    raise exception 'Unsupported ERP mapping entity type';
  end if;

  if tg_op = 'UPDATE' then
    new.updated_at := now();
    new.updated_by := coalesce(new.updated_by, (select auth.uid()));
  else
    new.created_by := coalesce(new.created_by, (select auth.uid()));
    new.updated_by := coalesce(new.updated_by, (select auth.uid()));
  end if;

  return new;
end;
$$;

drop trigger if exists erp_entity_mappings_scope on public.erp_entity_mappings;
create trigger erp_entity_mappings_scope
before insert or update on public.erp_entity_mappings
for each row execute function private.enforce_erp_mapping_scope();

create or replace function public.create_sales_order_draft(target_purchase_order_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
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
  if actor is null then
    raise exception 'Authentication required';
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

  if not private.has_org_role(target_org, array['owner','admin']) then
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
    actor
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
    actor
  );

  return created_draft;
end;
$$;

revoke all on function public.create_sales_order_draft(uuid) from public;
revoke all on function public.create_sales_order_draft(uuid) from anon;
grant execute on function public.create_sales_order_draft(uuid) to authenticated;

create or replace function public.begin_erp_delivery_attempt(
  target_sales_order_draft_id uuid,
  target_provider text,
  target_request_payload jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
  target_org uuid;
  target_status text;
  next_attempt integer;
  created_attempt uuid;
begin
  if actor is null then
    raise exception 'Authentication required';
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

  if not private.has_org_role(target_org, array['owner','admin']) then
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
    actor
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

revoke all on function public.begin_erp_delivery_attempt(uuid,text,jsonb) from public;
revoke all on function public.begin_erp_delivery_attempt(uuid,text,jsonb) from anon;
grant execute on function public.begin_erp_delivery_attempt(uuid,text,jsonb) to authenticated;

create or replace function public.finish_erp_delivery_attempt(
  target_attempt_id uuid,
  target_status text,
  target_external_order_id text,
  target_external_order_number text,
  target_error_message text,
  target_response_summary jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
  target_org uuid;
  target_draft uuid;
  current_status text;
  draft_status text;
begin
  if actor is null then
    raise exception 'Authentication required';
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

  if not private.has_org_role(target_org, array['owner','admin']) then
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
    actor
  );
end;
$$;

revoke all on function public.finish_erp_delivery_attempt(uuid,text,text,text,text,jsonb) from public;
revoke all on function public.finish_erp_delivery_attempt(uuid,text,text,text,text,jsonb) from anon;
grant execute on function public.finish_erp_delivery_attempt(uuid,text,text,text,text,jsonb) to authenticated;
