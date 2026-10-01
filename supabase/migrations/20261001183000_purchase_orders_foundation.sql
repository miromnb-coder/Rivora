-- Purchase order foundation: upload, extraction, workspace isolation and audit trail.

create table public.purchase_orders (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  customer_id uuid not null references public.customers(id) on delete restrict,
  quote_id uuid references public.quotes(id) on delete set null,
  po_number text not null check (char_length(trim(po_number)) between 1 and 200),
  quote_reference text,
  source_type text not null check (source_type in ('pdf','csv','excel','email','manual')),
  source_file_name text,
  status text not null default 'received' check (
    status in (
      'received','processing','extracted','needs_review','matched',
      'approved','ready_for_erp','erp_created','failed'
    )
  ),
  currency text not null default 'EUR' check (char_length(trim(currency)) = 3),
  order_date date,
  overall_confidence numeric(5,2) check (
    overall_confidence is null or (overall_confidence between 0 and 100)
  ),
  extraction_provider text,
  extraction_model text,
  extraction_confidence numeric(5,2) check (
    extraction_confidence is null or (extraction_confidence between 0 and 100)
  ),
  extraction_warnings jsonb not null default '[]'::jsonb,
  extraction_completed_at timestamptz,
  processing_error text,
  created_by uuid references auth.users(id) on delete set null,
  received_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.purchase_order_lines (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  purchase_order_id uuid not null references public.purchase_orders(id) on delete cascade,
  line_number integer not null check (line_number > 0),
  customer_sku text,
  raw_description text not null default '',
  manufacturer text,
  manufacturer_part_number text,
  quantity numeric(14,4) not null check (quantity > 0),
  unit text,
  unit_price numeric(14,4) check (unit_price is null or unit_price >= 0),
  line_total numeric(14,4) check (line_total is null or line_total >= 0),
  extraction_confidence numeric(5,2) check (
    extraction_confidence is null or (extraction_confidence between 0 and 100)
  ),
  source_page integer check (source_page is null or source_page > 0),
  extraction_notes text,
  created_at timestamptz not null default now(),
  unique (purchase_order_id, line_number)
);

create table public.purchase_order_files (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  purchase_order_id uuid not null references public.purchase_orders(id) on delete cascade,
  file_name text not null,
  storage_path text not null unique,
  mime_type text,
  size_bytes bigint not null check (size_bytes >= 0),
  sha256 text not null check (char_length(sha256) = 64),
  created_at timestamptz not null default now()
);

alter table public.ai_extractions
  add column if not exists purchase_order_id uuid
  references public.purchase_orders(id) on delete cascade;

create index purchase_orders_org_status_idx
  on public.purchase_orders(organization_id, status, received_at desc);
create index purchase_orders_quote_idx
  on public.purchase_orders(organization_id, quote_id)
  where quote_id is not null;
create index purchase_order_lines_order_idx
  on public.purchase_order_lines(purchase_order_id, line_number);
create index purchase_order_files_order_idx
  on public.purchase_order_files(purchase_order_id, created_at desc);
create index ai_extractions_purchase_order_idx
  on public.ai_extractions(purchase_order_id)
  where purchase_order_id is not null;

alter table public.purchase_orders enable row level security;
alter table public.purchase_order_lines enable row level security;
alter table public.purchase_order_files enable row level security;

create policy purchase_orders_org_select on public.purchase_orders
for select to authenticated
using (private.is_org_member(organization_id));

create policy purchase_orders_org_insert on public.purchase_orders
for insert to authenticated
with check (private.has_org_role(organization_id, array['owner','admin','member']));

create policy purchase_orders_org_update on public.purchase_orders
for update to authenticated
using (private.has_org_role(organization_id, array['owner','admin','member']))
with check (private.has_org_role(organization_id, array['owner','admin','member']));

create policy purchase_orders_org_delete on public.purchase_orders
for delete to authenticated
using (private.has_org_role(organization_id, array['owner','admin','member']));

create policy purchase_order_lines_org_select on public.purchase_order_lines
for select to authenticated
using (private.is_org_member(organization_id));

create policy purchase_order_lines_org_insert on public.purchase_order_lines
for insert to authenticated
with check (private.has_org_role(organization_id, array['owner','admin','member']));

create policy purchase_order_lines_org_update on public.purchase_order_lines
for update to authenticated
using (private.has_org_role(organization_id, array['owner','admin','member']))
with check (private.has_org_role(organization_id, array['owner','admin','member']));

create policy purchase_order_lines_org_delete on public.purchase_order_lines
for delete to authenticated
using (private.has_org_role(organization_id, array['owner','admin','member']));

create policy purchase_order_files_org_select on public.purchase_order_files
for select to authenticated
using (private.is_org_member(organization_id));

create policy purchase_order_files_org_insert on public.purchase_order_files
for insert to authenticated
with check (private.has_org_role(organization_id, array['owner','admin','member']));

create policy purchase_order_files_org_delete on public.purchase_order_files
for delete to authenticated
using (private.has_org_role(organization_id, array['owner','admin','member']));

grant select, insert, update, delete on public.purchase_orders to authenticated;
grant select, insert, update, delete on public.purchase_order_lines to authenticated;
grant select, insert, delete on public.purchase_order_files to authenticated;

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

  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists purchase_orders_scope on public.purchase_orders;
create trigger purchase_orders_scope
before insert or update on public.purchase_orders
for each row execute function private.enforce_purchase_order_scope();

create or replace function private.enforce_purchase_order_child_scope()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not exists (
    select 1
    from public.purchase_orders p
    where p.id = new.purchase_order_id
      and p.organization_id = new.organization_id
  ) then
    raise exception 'Purchase order child row must belong to the same workspace';
  end if;
  return new;
end;
$$;

drop trigger if exists purchase_order_lines_scope on public.purchase_order_lines;
create trigger purchase_order_lines_scope
before insert or update on public.purchase_order_lines
for each row execute function private.enforce_purchase_order_child_scope();

drop trigger if exists purchase_order_files_scope on public.purchase_order_files;
create trigger purchase_order_files_scope
before insert or update on public.purchase_order_files
for each row execute function private.enforce_purchase_order_child_scope();

create or replace function private.audit_purchase_order_change()
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
      new.id,
      'purchase_order_created',
      jsonb_build_object(
        'status', new.status,
        'source_type', new.source_type,
        'po_number', new.po_number,
        'quote_id', new.quote_id
      ),
      new.created_by
    );
  elsif old.status is distinct from new.status then
    perform private.write_activity_event(
      new.organization_id,
      'purchase_order',
      new.id,
      case
        when new.status = 'extracted' then 'purchase_order_extracted'
        when new.status = 'failed' then 'purchase_order_processing_failed'
        else 'purchase_order_status_changed'
      end,
      jsonb_build_object(
        'from_status', old.status,
        'to_status', new.status,
        'po_number', new.po_number,
        'error', case when new.status = 'failed' then left(coalesce(new.processing_error, ''), 500) else null end
      )
    );
  end if;

  return new;
end;
$$;

revoke all on function private.audit_purchase_order_change() from public;

drop trigger if exists purchase_orders_audit on public.purchase_orders;
create trigger purchase_orders_audit
after insert or update on public.purchase_orders
for each row execute function private.audit_purchase_order_change();

insert into storage.buckets(id, name, public, file_size_limit)
values ('purchase-order-files', 'purchase-order-files', false, 10485760)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit;

drop policy if exists purchase_order_storage_select on storage.objects;
create policy purchase_order_storage_select on storage.objects
for select to authenticated
using (
  bucket_id = 'purchase-order-files'
  and exists (
    select 1
    from public.organization_members m
    where m.user_id = (select auth.uid())
      and m.organization_id::text = (storage.foldername(name))[1]
  )
);

drop policy if exists purchase_order_storage_insert on storage.objects;
create policy purchase_order_storage_insert on storage.objects
for insert to authenticated
with check (
  bucket_id = 'purchase-order-files'
  and exists (
    select 1
    from public.organization_members m
    where m.user_id = (select auth.uid())
      and m.organization_id::text = (storage.foldername(name))[1]
      and m.role in ('owner','admin','member')
  )
);

drop policy if exists purchase_order_storage_delete on storage.objects;
create policy purchase_order_storage_delete on storage.objects
for delete to authenticated
using (
  bucket_id = 'purchase-order-files'
  and exists (
    select 1
    from public.organization_members m
    where m.user_id = (select auth.uid())
      and m.organization_id::text = (storage.foldername(name))[1]
      and m.role in ('owner','admin','member')
  )
);
