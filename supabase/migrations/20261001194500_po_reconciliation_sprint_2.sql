-- Sprint 2: deterministic Quote ↔ PO reconciliation and exception review.

create table public.purchase_order_reconciliations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  purchase_order_id uuid not null references public.purchase_orders(id) on delete cascade,
  quote_id uuid not null references public.quotes(id) on delete restrict,
  run_number integer not null check (run_number > 0),
  algorithm_version text not null check (char_length(trim(algorithm_version)) between 1 and 120),
  status text not null check (status in ('matched','needs_review','approved')),
  header_exceptions jsonb not null default '[]'::jsonb
    check (jsonb_typeof(header_exceptions) = 'array'),
  header_review_status text not null default 'not_required'
    check (header_review_status in ('not_required','open','accepted')),
  header_review_note text,
  header_reviewed_by uuid references auth.users(id) on delete set null,
  header_reviewed_at timestamptz,
  summary jsonb not null default '{}'::jsonb
    check (jsonb_typeof(summary) = 'object'),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  unique (purchase_order_id, run_number),
  check (
    (jsonb_array_length(header_exceptions) = 0 and header_review_status = 'not_required')
    or
    (jsonb_array_length(header_exceptions) > 0 and header_review_status in ('open','accepted'))
  )
);

create table public.purchase_order_reconciliation_lines (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  reconciliation_id uuid not null references public.purchase_order_reconciliations(id) on delete cascade,
  purchase_order_id uuid not null references public.purchase_orders(id) on delete cascade,
  po_line_id uuid references public.purchase_order_lines(id) on delete cascade,
  quote_line_id uuid references public.quote_lines(id) on delete restrict,
  line_kind text not null check (line_kind in ('paired','extra_po','missing_quote')),
  match_method text not null check (
    match_method in (
      'customer_sku_exact','sku_exact','mpn_exact','description_exact',
      'description_similarity','unmatched_po','missing_quote'
    )
  ),
  match_score numeric(6,2) not null default 0
    check (match_score between 0 and 100),
  exception_codes jsonb not null default '[]'::jsonb
    check (jsonb_typeof(exception_codes) = 'array'),
  review_status text not null default 'not_required'
    check (review_status in ('not_required','open','accepted')),
  review_note text,
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  po_snapshot jsonb,
  quote_snapshot jsonb,
  created_at timestamptz not null default now(),
  check (
    (line_kind = 'paired' and po_line_id is not null and quote_line_id is not null)
    or
    (line_kind = 'extra_po' and po_line_id is not null and quote_line_id is null)
    or
    (line_kind = 'missing_quote' and po_line_id is null and quote_line_id is not null)
  ),
  check (
    (jsonb_array_length(exception_codes) = 0 and review_status = 'not_required')
    or
    (jsonb_array_length(exception_codes) > 0 and review_status in ('open','accepted'))
  )
);

create index purchase_order_reconciliations_org_created_idx
  on public.purchase_order_reconciliations(organization_id, created_at desc);
create index purchase_order_reconciliations_po_run_idx
  on public.purchase_order_reconciliations(purchase_order_id, run_number desc);
create index purchase_order_reconciliations_quote_idx
  on public.purchase_order_reconciliations(quote_id);
create index purchase_order_reconciliations_created_by_idx
  on public.purchase_order_reconciliations(created_by)
  where created_by is not null;
create index purchase_order_reconciliations_reviewed_by_idx
  on public.purchase_order_reconciliations(reviewed_by)
  where reviewed_by is not null;
create index purchase_order_reconciliations_header_reviewed_by_idx
  on public.purchase_order_reconciliations(header_reviewed_by)
  where header_reviewed_by is not null;

create index purchase_order_reconciliation_lines_org_idx
  on public.purchase_order_reconciliation_lines(organization_id);
create index purchase_order_reconciliation_lines_reconciliation_idx
  on public.purchase_order_reconciliation_lines(reconciliation_id, created_at);
create index purchase_order_reconciliation_lines_po_idx
  on public.purchase_order_reconciliation_lines(purchase_order_id);
create index purchase_order_reconciliation_lines_po_line_idx
  on public.purchase_order_reconciliation_lines(po_line_id)
  where po_line_id is not null;
create index purchase_order_reconciliation_lines_quote_line_idx
  on public.purchase_order_reconciliation_lines(quote_line_id)
  where quote_line_id is not null;
create index purchase_order_reconciliation_lines_reviewed_by_idx
  on public.purchase_order_reconciliation_lines(reviewed_by)
  where reviewed_by is not null;

alter table public.purchase_order_reconciliations enable row level security;
alter table public.purchase_order_reconciliation_lines enable row level security;

create policy purchase_order_reconciliations_org_select
on public.purchase_order_reconciliations
for select to authenticated
using (private.is_org_member(organization_id));

create policy purchase_order_reconciliations_org_insert
on public.purchase_order_reconciliations
for insert to authenticated
with check (private.has_org_role(organization_id, array['owner','admin','member']));

create policy purchase_order_reconciliations_org_update
on public.purchase_order_reconciliations
for update to authenticated
using (private.has_org_role(organization_id, array['owner','admin','member']))
with check (private.has_org_role(organization_id, array['owner','admin','member']));

create policy purchase_order_reconciliation_lines_org_select
on public.purchase_order_reconciliation_lines
for select to authenticated
using (private.is_org_member(organization_id));

create policy purchase_order_reconciliation_lines_org_insert
on public.purchase_order_reconciliation_lines
for insert to authenticated
with check (private.has_org_role(organization_id, array['owner','admin','member']));

create policy purchase_order_reconciliation_lines_org_update
on public.purchase_order_reconciliation_lines
for update to authenticated
using (private.has_org_role(organization_id, array['owner','admin','member']))
with check (private.has_org_role(organization_id, array['owner','admin','member']));

grant select, insert on public.purchase_order_reconciliations to authenticated;
grant update (
  status,
  header_review_status,
  header_review_note,
  header_reviewed_by,
  header_reviewed_at,
  reviewed_by,
  reviewed_at
) on public.purchase_order_reconciliations to authenticated;

grant select, insert on public.purchase_order_reconciliation_lines to authenticated;
grant update (
  review_status,
  review_note,
  reviewed_by,
  reviewed_at
) on public.purchase_order_reconciliation_lines to authenticated;

create or replace function private.enforce_purchase_order_reconciliation_scope()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  po_org uuid;
  po_customer uuid;
  po_quote uuid;
  quote_org uuid;
  quote_customer uuid;
begin
  select p.organization_id, p.customer_id, p.quote_id
  into po_org, po_customer, po_quote
  from public.purchase_orders p
  where p.id = new.purchase_order_id;

  if po_org is null or po_org <> new.organization_id then
    raise exception 'Reconciliation purchase order must belong to the same workspace';
  end if;

  select q.organization_id, q.customer_id
  into quote_org, quote_customer
  from public.quotes q
  where q.id = new.quote_id;

  if quote_org is null or quote_org <> new.organization_id then
    raise exception 'Reconciliation quote must belong to the same workspace';
  end if;

  if quote_customer <> po_customer then
    raise exception 'Reconciliation quote customer must match the purchase order customer';
  end if;

  if po_quote is distinct from new.quote_id then
    raise exception 'Reconciliation must use the purchase order selected quote';
  end if;

  return new;
end;
$$;

drop trigger if exists purchase_order_reconciliations_scope
  on public.purchase_order_reconciliations;
create trigger purchase_order_reconciliations_scope
before insert or update on public.purchase_order_reconciliations
for each row execute function private.enforce_purchase_order_reconciliation_scope();

create or replace function private.enforce_purchase_order_reconciliation_line_scope()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  reconciliation_org uuid;
  reconciliation_po uuid;
  reconciliation_quote uuid;
begin
  select r.organization_id, r.purchase_order_id, r.quote_id
  into reconciliation_org, reconciliation_po, reconciliation_quote
  from public.purchase_order_reconciliations r
  where r.id = new.reconciliation_id;

  if reconciliation_org is null
     or reconciliation_org <> new.organization_id
     or reconciliation_po <> new.purchase_order_id then
    raise exception 'Reconciliation line scope mismatch';
  end if;

  if new.po_line_id is not null and not exists (
    select 1
    from public.purchase_order_lines l
    where l.id = new.po_line_id
      and l.purchase_order_id = reconciliation_po
      and l.organization_id = reconciliation_org
  ) then
    raise exception 'PO line does not belong to the reconciled purchase order';
  end if;

  if new.quote_line_id is not null and not exists (
    select 1
    from public.quote_lines l
    where l.id = new.quote_line_id
      and l.quote_id = reconciliation_quote
      and l.organization_id = reconciliation_org
  ) then
    raise exception 'Quote line does not belong to the reconciled quote';
  end if;

  return new;
end;
$$;

drop trigger if exists purchase_order_reconciliation_lines_scope
  on public.purchase_order_reconciliation_lines;
create trigger purchase_order_reconciliation_lines_scope
before insert or update on public.purchase_order_reconciliation_lines
for each row execute function private.enforce_purchase_order_reconciliation_line_scope();

create or replace function private.enforce_purchase_order_reconciliation_review()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.review_status is distinct from new.review_status then
    if new.review_status = 'accepted' then
      if jsonb_array_length(new.exception_codes) = 0 then
        raise exception 'Clean reconciliation lines do not require exception acceptance';
      end if;
      if not private.has_org_role(new.organization_id, array['owner','admin','member']) then
        raise exception 'Reviewer access is required to accept a purchase order exception';
      end if;
      new.reviewed_by := coalesce(new.reviewed_by, (select auth.uid()));
      new.reviewed_at := coalesce(new.reviewed_at, now());
    elsif old.review_status = 'accepted' then
      raise exception 'Accepted reconciliation exceptions are immutable';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists purchase_order_reconciliation_lines_review
  on public.purchase_order_reconciliation_lines;
create trigger purchase_order_reconciliation_lines_review
before update on public.purchase_order_reconciliation_lines
for each row execute function private.enforce_purchase_order_reconciliation_review();

create or replace function private.enforce_purchase_order_reconciliation_approval()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.header_review_status is distinct from new.header_review_status then
    if new.header_review_status = 'accepted' then
      if jsonb_array_length(new.header_exceptions) = 0 then
        raise exception 'No header exceptions require acceptance';
      end if;
      if not private.has_org_role(new.organization_id, array['owner','admin','member']) then
        raise exception 'Reviewer access is required to accept header exceptions';
      end if;
      new.header_reviewed_by := coalesce(new.header_reviewed_by, (select auth.uid()));
      new.header_reviewed_at := coalesce(new.header_reviewed_at, now());
    elsif old.header_review_status = 'accepted' then
      raise exception 'Accepted header exceptions are immutable';
    end if;
  end if;

  if old.status is distinct from new.status and new.status = 'approved' then
    if not private.has_org_role(new.organization_id, array['owner','admin']) then
      raise exception 'Owner or admin access is required to approve PO reconciliation';
    end if;

    if exists (
      select 1
      from public.purchase_order_reconciliations newer
      where newer.purchase_order_id = new.purchase_order_id
        and newer.run_number > new.run_number
    ) then
      raise exception 'Only the latest reconciliation run can be approved';
    end if;

    if new.header_review_status = 'open' then
      raise exception 'Header exceptions must be reviewed before approval';
    end if;

    if exists (
      select 1
      from public.purchase_order_reconciliation_lines l
      where l.reconciliation_id = new.id
        and l.review_status = 'open'
    ) then
      raise exception 'All line exceptions must be reviewed before approval';
    end if;

    new.reviewed_by := coalesce(new.reviewed_by, (select auth.uid()));
    new.reviewed_at := coalesce(new.reviewed_at, now());
  end if;

  return new;
end;
$$;

drop trigger if exists purchase_order_reconciliations_approval
  on public.purchase_order_reconciliations;
create trigger purchase_order_reconciliations_approval
before update on public.purchase_order_reconciliations
for each row execute function private.enforce_purchase_order_reconciliation_approval();

create or replace function public.commit_purchase_order_reconciliation(
  target_purchase_order_id uuid,
  target_quote_id uuid,
  target_algorithm_version text,
  target_header_exceptions jsonb,
  target_summary jsonb,
  target_lines jsonb
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  target_org uuid;
  target_customer uuid;
  selected_quote uuid;
  quote_customer uuid;
  quote_status text;
  next_run integer;
  reconciliation_status text;
  reconciliation_id uuid;
  header_review text;
  line_exception_count integer;
begin
  select p.organization_id, p.customer_id, p.quote_id
  into target_org, target_customer, selected_quote
  from public.purchase_orders p
  where p.id = target_purchase_order_id
  for update;

  if target_org is null then
    raise exception 'Purchase order not found';
  end if;

  if not private.has_org_role(target_org, array['owner','admin','member']) then
    raise exception 'Reviewer access is required to reconcile a purchase order';
  end if;

  if selected_quote is null or selected_quote <> target_quote_id then
    raise exception 'Purchase order is not linked to the selected quote';
  end if;

  select q.customer_id, q.status
  into quote_customer, quote_status
  from public.quotes q
  where q.id = target_quote_id
    and q.organization_id = target_org;

  if quote_customer is null or quote_customer <> target_customer then
    raise exception 'Quote customer must match purchase order customer';
  end if;

  if quote_status not in ('approved','sent') then
    raise exception 'Purchase order reconciliation requires an approved or sent quote';
  end if;

  if target_lines is null
     or jsonb_typeof(target_lines) <> 'array'
     or jsonb_array_length(target_lines) = 0 then
    raise exception 'Reconciliation payload must contain comparison lines';
  end if;

  if target_header_exceptions is null or jsonb_typeof(target_header_exceptions) <> 'array' then
    raise exception 'Header exceptions must be a JSON array';
  end if;

  if target_summary is null or jsonb_typeof(target_summary) <> 'object' then
    raise exception 'Reconciliation summary must be a JSON object';
  end if;

  select count(*)
  into line_exception_count
  from jsonb_array_elements(target_lines) item
  where jsonb_array_length(coalesce(item->'exception_codes', '[]'::jsonb)) > 0;

  reconciliation_status := case
    when jsonb_array_length(target_header_exceptions) > 0 or line_exception_count > 0
      then 'needs_review'
    else 'matched'
  end;

  header_review := case
    when jsonb_array_length(target_header_exceptions) > 0 then 'open'
    else 'not_required'
  end;

  select coalesce(max(r.run_number), 0) + 1
  into next_run
  from public.purchase_order_reconciliations r
  where r.purchase_order_id = target_purchase_order_id;

  insert into public.purchase_order_reconciliations(
    organization_id,
    purchase_order_id,
    quote_id,
    run_number,
    algorithm_version,
    status,
    header_exceptions,
    header_review_status,
    summary,
    created_by
  )
  values (
    target_org,
    target_purchase_order_id,
    target_quote_id,
    next_run,
    left(trim(target_algorithm_version), 120),
    reconciliation_status,
    target_header_exceptions,
    header_review,
    target_summary,
    (select auth.uid())
  )
  returning id into reconciliation_id;

  insert into public.purchase_order_reconciliation_lines(
    organization_id,
    reconciliation_id,
    purchase_order_id,
    po_line_id,
    quote_line_id,
    line_kind,
    match_method,
    match_score,
    exception_codes,
    review_status,
    po_snapshot,
    quote_snapshot
  )
  select
    target_org,
    reconciliation_id,
    target_purchase_order_id,
    x.po_line_id,
    x.quote_line_id,
    x.line_kind,
    x.match_method,
    x.match_score,
    coalesce(x.exception_codes, '[]'::jsonb),
    x.review_status,
    x.po_snapshot,
    x.quote_snapshot
  from jsonb_to_recordset(target_lines) as x(
    po_line_id uuid,
    quote_line_id uuid,
    line_kind text,
    match_method text,
    match_score numeric,
    exception_codes jsonb,
    review_status text,
    po_snapshot jsonb,
    quote_snapshot jsonb
  );

  update public.purchase_orders
  set status = reconciliation_status,
      processing_error = null,
      updated_at = now()
  where id = target_purchase_order_id
    and organization_id = target_org;

  return reconciliation_id;
end;
$$;

revoke all on function public.commit_purchase_order_reconciliation(uuid,uuid,text,jsonb,jsonb,jsonb)
from public;
grant execute on function public.commit_purchase_order_reconciliation(uuid,uuid,text,jsonb,jsonb,jsonb)
to authenticated;

create or replace function private.enforce_purchase_order_scope()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  selected_quote_customer uuid;
begin
  if not exists (
    select 1
    from public.customers c
    where c.id = new.customer_id
      and c.organization_id = new.organization_id
  ) then
    raise exception 'Purchase order customer must belong to the same workspace';
  end if;

  if new.quote_id is not null then
    select q.customer_id
    into selected_quote_customer
    from public.quotes q
    where q.id = new.quote_id
      and q.organization_id = new.organization_id;

    if selected_quote_customer is null then
      raise exception 'Selected quote must belong to the same workspace';
    end if;

    if selected_quote_customer <> new.customer_id then
      raise exception 'Purchase order customer must match the selected quote customer';
    end if;
  end if;

  if tg_op = 'UPDATE' then
    if old.status in ('approved','ready_for_erp','erp_created')
       and new.quote_id is distinct from old.quote_id then
      raise exception 'Approved purchase order quote link is locked';
    end if;

    if old.status is distinct from new.status
       and new.status in ('approved','ready_for_erp','erp_created')
       and not private.has_org_role(new.organization_id, array['owner','admin']) then
      raise exception 'Owner or admin access is required for approved purchase order states';
    end if;

    if old.status is distinct from new.status and new.status = 'approved' then
      if not exists (
        select 1
        from public.purchase_order_reconciliations r
        where r.purchase_order_id = new.id
          and r.status = 'approved'
          and not exists (
            select 1
            from public.purchase_order_reconciliations newer
            where newer.purchase_order_id = new.id
              and newer.run_number > r.run_number
          )
      ) then
        raise exception 'Latest PO reconciliation must be approved first';
      end if;
    end if;
  end if;

  new.updated_at := now();
  return new;
end;
$$;

create or replace function private.audit_purchase_order_reconciliation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    perform private.write_activity_event(
      new.organization_id,
      'purchase_order',
      new.purchase_order_id,
      'purchase_order_reconciled',
      jsonb_build_object(
        'reconciliation_id', new.id,
        'quote_id', new.quote_id,
        'run_number', new.run_number,
        'status', new.status,
        'algorithm_version', new.algorithm_version,
        'summary', new.summary,
        'header_exceptions', new.header_exceptions
      ),
      new.created_by
    );
  elsif old.status is distinct from new.status and new.status = 'approved' then
    perform private.write_activity_event(
      new.organization_id,
      'purchase_order',
      new.purchase_order_id,
      'purchase_order_reconciliation_approved',
      jsonb_build_object(
        'reconciliation_id', new.id,
        'quote_id', new.quote_id,
        'run_number', new.run_number
      ),
      new.reviewed_by
    );
  end if;

  return new;
end;
$$;

revoke all on function private.audit_purchase_order_reconciliation() from public;

drop trigger if exists purchase_order_reconciliations_audit
  on public.purchase_order_reconciliations;
create trigger purchase_order_reconciliations_audit
after insert or update on public.purchase_order_reconciliations
for each row execute function private.audit_purchase_order_reconciliation();

create or replace function private.audit_purchase_order_exception_review()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.review_status is distinct from new.review_status
     and new.review_status = 'accepted' then
    perform private.write_activity_event(
      new.organization_id,
      'purchase_order',
      new.purchase_order_id,
      'purchase_order_exception_accepted',
      jsonb_build_object(
        'reconciliation_id', new.reconciliation_id,
        'reconciliation_line_id', new.id,
        'po_line_id', new.po_line_id,
        'quote_line_id', new.quote_line_id,
        'exception_codes', new.exception_codes,
        'review_note', new.review_note
      ),
      new.reviewed_by
    );
  end if;

  return new;
end;
$$;

revoke all on function private.audit_purchase_order_exception_review() from public;

drop trigger if exists purchase_order_reconciliation_lines_audit
  on public.purchase_order_reconciliation_lines;
create trigger purchase_order_reconciliation_lines_audit
after update on public.purchase_order_reconciliation_lines
for each row execute function private.audit_purchase_order_exception_review();


create or replace function public.approve_purchase_order_reconciliation(
  target_reconciliation_id uuid
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  target_org uuid;
  target_po uuid;
  target_run integer;
begin
  select r.organization_id, r.purchase_order_id, r.run_number
  into target_org, target_po, target_run
  from public.purchase_order_reconciliations r
  where r.id = target_reconciliation_id
  for update;

  if target_org is null then
    raise exception 'Purchase order reconciliation not found';
  end if;

  if not private.has_org_role(target_org, array['owner','admin']) then
    raise exception 'Owner or admin access is required to approve PO reconciliation';
  end if;

  if exists (
    select 1
    from public.purchase_order_reconciliations newer
    where newer.purchase_order_id = target_po
      and newer.run_number > target_run
  ) then
    raise exception 'Only the latest reconciliation run can be approved';
  end if;

  update public.purchase_order_reconciliations
  set status = 'approved',
      reviewed_by = (select auth.uid()),
      reviewed_at = now()
  where id = target_reconciliation_id;

  update public.purchase_orders
  set status = 'approved',
      processing_error = null,
      updated_at = now()
  where id = target_po
    and organization_id = target_org;
end;
$$;

revoke all on function public.approve_purchase_order_reconciliation(uuid)
from public;
grant execute on function public.approve_purchase_order_reconciliation(uuid)
to authenticated;
