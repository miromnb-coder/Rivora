-- Phase 0-2 pilot hardening: commercial safety, tenant isolation, role boundaries and recovery.

alter table public.quote_lines
  add column if not exists pricing_required boolean not null default false;

alter table public.rfqs
  add column if not exists processing_error text;

create or replace function private.has_org_role(target_org_id uuid, allowed_roles text[])
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.organization_members m
    where m.organization_id = target_org_id
      and m.user_id = (select auth.uid())
      and m.role = any(allowed_roles)
  );
$$;

revoke all on function private.has_org_role(uuid, text[]) from public;
grant execute on function private.has_org_role(uuid, text[]) to authenticated, service_role;

-- Replace the public SECURITY DEFINER bootstrap with an invoker wrapper.
create or replace function private.bootstrap_rivora_workspace_impl(workspace_name text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  existing_org uuid;
  new_org uuid;
  clean_name text := trim(workspace_name);
begin
  if uid is null then
    raise exception 'Authentication required';
  end if;

  if clean_name is null or char_length(clean_name) < 1 or char_length(clean_name) > 200 then
    raise exception 'Workspace name must be between 1 and 200 characters';
  end if;

  select organization_id into existing_org
  from public.organization_members
  where user_id = uid
  order by created_at asc
  limit 1;

  if existing_org is not null then
    return existing_org;
  end if;

  insert into public.organizations(name)
  values (clean_name)
  returning id into new_org;

  insert into public.organization_members(organization_id, user_id, role)
  values (new_org, uid, 'owner');

  return new_org;
end;
$$;

revoke all on function private.bootstrap_rivora_workspace_impl(text) from public;
grant execute on function private.bootstrap_rivora_workspace_impl(text) to authenticated, service_role;

create or replace function public.bootstrap_rivora_workspace(workspace_name text)
returns uuid
language sql
security invoker
set search_path = 'pg_catalog', 'public', 'private'
as $$
  select private.bootstrap_rivora_workspace_impl($1);
$$;

revoke all on function public.bootstrap_rivora_workspace(text) from public, anon;
grant execute on function public.bootstrap_rivora_workspace(text) to authenticated, service_role;

-- Catalogue imports are validated and committed atomically.
create or replace function public.import_catalogue_rows(
  target_organization_id uuid,
  payload jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  total_count integer;
  existing_count integer;
  missing_price_count integer;
  duplicate_count integer;
  invalid_count integer;
begin
  if not private.has_org_role(target_organization_id, array['owner','admin']) then
    raise exception 'Owner or admin access is required to import the catalogue';
  end if;

  if payload is null or jsonb_typeof(payload) <> 'array' or jsonb_array_length(payload) = 0 then
    raise exception 'Catalogue payload must contain at least one product';
  end if;

  with incoming as (
    select
      trim(x.sku) as sku,
      trim(x.name) as name,
      x.unit_price
    from jsonb_to_recordset(payload) as x(
      sku text,
      name text,
      manufacturer text,
      manufacturer_part_number text,
      unit text,
      unit_price numeric,
      stock_quantity numeric
    )
  )
  select
    count(*),
    count(*) filter (where unit_price is null),
    count(*) filter (where sku is null or sku = '' or name is null or name = '' or unit_price < 0)
  into total_count, missing_price_count, invalid_count
  from incoming;

  with incoming as (
    select trim(x.sku) as sku
    from jsonb_to_recordset(payload) as x(
      sku text,
      name text,
      manufacturer text,
      manufacturer_part_number text,
      unit text,
      unit_price numeric,
      stock_quantity numeric
    )
  )
  select count(*) - count(distinct lower(sku))
  into duplicate_count
  from incoming;

  if invalid_count > 0 then
    raise exception 'Catalogue contains invalid rows or negative prices';
  end if;

  if duplicate_count > 0 then
    raise exception 'Catalogue contains duplicate SKUs';
  end if;

  with incoming as (
    select trim(x.sku) as sku
    from jsonb_to_recordset(payload) as x(
      sku text,
      name text,
      manufacturer text,
      manufacturer_part_number text,
      unit text,
      unit_price numeric,
      stock_quantity numeric
    )
  )
  select count(*)
  into existing_count
  from incoming i
  join public.products p
    on p.organization_id = target_organization_id
   and p.sku = i.sku;

  insert into public.products(
    organization_id,
    sku,
    name,
    manufacturer,
    manufacturer_part_number,
    unit,
    unit_price,
    stock_quantity,
    active,
    updated_at
  )
  select
    target_organization_id,
    trim(x.sku),
    trim(x.name),
    nullif(trim(x.manufacturer), ''),
    nullif(trim(x.manufacturer_part_number), ''),
    coalesce(nullif(trim(x.unit), ''), 'pcs'),
    x.unit_price,
    x.stock_quantity,
    true,
    now()
  from jsonb_to_recordset(payload) as x(
    sku text,
    name text,
    manufacturer text,
    manufacturer_part_number text,
    unit text,
    unit_price numeric,
    stock_quantity numeric
  )
  on conflict (organization_id, sku)
  do update set
    name = excluded.name,
    manufacturer = excluded.manufacturer,
    manufacturer_part_number = excluded.manufacturer_part_number,
    unit = excluded.unit,
    unit_price = excluded.unit_price,
    stock_quantity = excluded.stock_quantity,
    active = true,
    updated_at = now();

  return jsonb_build_object(
    'total', total_count,
    'created', total_count - existing_count,
    'updated', existing_count,
    'missing_price', missing_price_count
  );
end;
$$;

revoke all on function public.import_catalogue_rows(uuid, jsonb) from public, anon;
grant execute on function public.import_catalogue_rows(uuid, jsonb) to authenticated, service_role;

-- Every suggested match remains human-reviewable until explicitly confirmed.
create or replace function public.refresh_rfq_matches(target_rfq_id uuid)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  org_id uuid;
  total_lines integer;
  review_lines integer;
begin
  select organization_id into org_id
  from public.rfqs
  where id = target_rfq_id;

  if org_id is null then raise exception 'RFQ not found'; end if;
  if not private.has_org_role(org_id, array['owner','admin','member']) then
    raise exception 'Not authorized';
  end if;

  delete from public.product_match_candidates
  where rfq_line_id in (
    select id from public.rfq_lines where rfq_id = target_rfq_id
  );

  with raw_candidates as (
    select l.id as rfq_line_id, m.product_id, 100::numeric as confidence,
           'customer_memory'::text as method, 4 as method_priority
    from public.rfq_lines l
    join public.rfqs r on r.id = l.rfq_id
    join public.customer_product_mappings m
      on m.organization_id = l.organization_id
     and m.customer_id = r.customer_id
     and m.normalized_customer_sku = l.normalized_customer_sku
    where l.rfq_id = target_rfq_id
      and l.normalized_customer_sku <> ''

    union all

    select l.id, p.id, 99::numeric, 'exact_sku'::text, 3
    from public.rfq_lines l
    join public.products p
      on p.organization_id = l.organization_id
     and p.active = true
     and p.normalized_sku = l.normalized_customer_sku
    where l.rfq_id = target_rfq_id
      and l.normalized_customer_sku <> ''

    union all

    select l.id, p.id, 97::numeric, 'exact_mpn'::text, 2
    from public.rfq_lines l
    join public.products p
      on p.organization_id = l.organization_id
     and p.active = true
     and p.normalized_mpn <> ''
     and p.normalized_mpn = l.normalized_customer_sku
    where l.rfq_id = target_rfq_id
      and l.normalized_customer_sku <> ''

    union all

    select
      l.id,
      p.id,
      least(
        89,
        round(
          greatest(
            extensions.similarity(l.normalized_text, p.normalized_search),
            extensions.similarity(l.normalized_customer_sku, p.normalized_sku)
          ) * 100
        )
      )::numeric,
      'fuzzy'::text,
      1
    from public.rfq_lines l
    join public.products p
      on p.organization_id = l.organization_id
     and p.active = true
    where l.rfq_id = target_rfq_id
      and greatest(
        extensions.similarity(l.normalized_text, p.normalized_search),
        extensions.similarity(l.normalized_customer_sku, p.normalized_sku)
      ) >= 0.25
  ),
  dedup as (
    select distinct on (rfq_line_id, product_id)
      rfq_line_id, product_id, confidence, method, method_priority
    from raw_candidates
    order by rfq_line_id, product_id, confidence desc, method_priority desc
  ),
  ranked as (
    select
      d.*,
      row_number() over (
        partition by rfq_line_id
        order by confidence desc, method_priority desc, product_id
      ) as candidate_rank
    from dedup d
  )
  insert into public.product_match_candidates(
    organization_id, rfq_line_id, product_id, confidence, method, rank
  )
  select org_id, rfq_line_id, product_id, confidence, method, candidate_rank
  from ranked
  where candidate_rank <= 5;

  update public.rfq_lines l
  set
    selected_product_id = best.product_id,
    match_confidence = best.confidence,
    match_method = best.method,
    review_status = 'needs_review',
    updated_at = now()
  from (
    select distinct on (rfq_line_id)
      rfq_line_id, product_id, confidence, method
    from public.product_match_candidates
    where rfq_line_id in (
      select id from public.rfq_lines where rfq_id = target_rfq_id
    )
    order by rfq_line_id, rank
  ) best
  where l.id = best.rfq_line_id;

  update public.rfq_lines
  set
    selected_product_id = null,
    match_confidence = 0,
    match_method = null,
    review_status = 'unmatched',
    updated_at = now()
  where rfq_id = target_rfq_id
    and not exists (
      select 1 from public.product_match_candidates c
      where c.rfq_line_id = public.rfq_lines.id
    );

  select count(*) into total_lines
  from public.rfq_lines
  where rfq_id = target_rfq_id;

  select count(*) into review_lines
  from public.rfq_lines
  where rfq_id = target_rfq_id
    and review_status <> 'confirmed';

  update public.rfqs
  set
    overall_confidence = (
      select round(avg(coalesce(match_confidence,0)), 2)
      from public.rfq_lines
      where rfq_id = target_rfq_id
    ),
    status = case when review_lines = 0 and total_lines > 0 then 'ready' else 'needs_review' end,
    processing_error = null
  where id = target_rfq_id;

  return jsonb_build_object(
    'rfq_id', target_rfq_id,
    'total_lines', total_lines,
    'review_lines', review_lines,
    'ready', review_lines = 0 and total_lines > 0
  );
end;
$$;

create or replace function public.confirm_rfq_line_match(
  target_line_id uuid,
  target_product_id uuid,
  remember_for_customer boolean default true
)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  org_id uuid;
  rfq_uuid uuid;
  customer_uuid uuid;
  alias_text text;
  description_text text;
  previous_product uuid;
  unresolved integer;
begin
  select l.organization_id, l.rfq_id, r.customer_id, l.customer_sku, l.raw_description, l.selected_product_id
  into org_id, rfq_uuid, customer_uuid, alias_text, description_text, previous_product
  from public.rfq_lines l
  join public.rfqs r on r.id = l.rfq_id
  where l.id = target_line_id;

  if org_id is null then raise exception 'RFQ line not found'; end if;
  if not private.has_org_role(org_id, array['owner','admin','member']) then
    raise exception 'Not authorized';
  end if;

  if not exists (
    select 1 from public.products
    where id = target_product_id and organization_id = org_id and active = true
  ) then raise exception 'Product not found'; end if;

  update public.rfq_lines
  set selected_product_id = target_product_id,
      match_confidence = 100,
      match_method = 'manual',
      review_status = 'confirmed',
      updated_at = now()
  where id = target_line_id;

  insert into public.match_feedback(
    organization_id, rfq_line_id, selected_product_id, previous_product_id,
    remember_for_customer, user_id
  )
  values (
    org_id, target_line_id, target_product_id, previous_product,
    remember_for_customer, uid
  );

  if remember_for_customer
     and customer_uuid is not null
     and nullif(trim(alias_text),'') is not null then
    insert into public.customer_product_mappings(
      organization_id, customer_id, customer_sku, customer_description,
      product_id, confidence, source, times_used, confirmed_by_user_id, last_used_at
    )
    values (
      org_id, customer_uuid, trim(alias_text), description_text,
      target_product_id, 100, 'user_confirmed', 1, uid, now()
    )
    on conflict (organization_id, customer_id, normalized_customer_sku)
    do update set
      customer_sku = excluded.customer_sku,
      customer_description = excluded.customer_description,
      product_id = excluded.product_id,
      confidence = 100,
      source = 'user_confirmed',
      times_used = public.customer_product_mappings.times_used + 1,
      confirmed_by_user_id = uid,
      last_used_at = now(),
      updated_at = now();
  end if;

  select count(*) into unresolved
  from public.rfq_lines
  where rfq_id = rfq_uuid
    and review_status <> 'confirmed';

  update public.rfqs
  set status = case when unresolved = 0 then 'ready' else 'needs_review' end,
      overall_confidence = (
        select round(avg(coalesce(match_confidence,0)), 2)
        from public.rfq_lines
        where rfq_id = rfq_uuid
      ),
      processing_error = null
  where id = rfq_uuid;

  return jsonb_build_object(
    'ok', true,
    'rfq_id', rfq_uuid,
    'remaining_review_lines', unresolved,
    'remembered', remember_for_customer
  );
end;
$$;

-- Existing auto-matched lines must pass the new human confirmation gate.
update public.rfq_lines
set review_status = 'needs_review',
    updated_at = now()
where review_status = 'matched';

update public.rfqs r
set status = 'needs_review'
where status = 'ready'
  and exists (
    select 1
    from public.rfq_lines l
    where l.rfq_id = r.id
      and l.review_status <> 'confirmed'
  );

-- Quote state and commercial-integrity invariants.
create or replace function private.enforce_quote_state_transition()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.status is distinct from new.status then
    if not (
      (old.status = 'draft' and new.status = 'ready') or
      (old.status = 'ready' and new.status in ('draft','approved')) or
      (old.status = 'approved' and new.status in ('sent','expired')) or
      (old.status = 'sent' and new.status = 'expired')
    ) then
      raise exception 'Invalid quote state transition: % -> %', old.status, new.status;
    end if;
  end if;

  if old.status in ('approved','sent','expired') then
    if new.customer_id is distinct from old.customer_id
      or new.rfq_id is distinct from old.rfq_id
      or new.quote_number is distinct from old.quote_number
      or new.currency is distinct from old.currency
      or new.valid_until is distinct from old.valid_until
      or new.customer_reference is distinct from old.customer_reference
      or new.notes is distinct from old.notes
      or new.tax_rate is distinct from old.tax_rate
    then
      raise exception 'Approved or sent quote commercial fields are locked';
    end if;
  end if;

  if old.status in ('sent','expired') then
    if new.recipient_contact_id is distinct from old.recipient_contact_id
      or new.recipient_name is distinct from old.recipient_name
      or new.recipient_email is distinct from old.recipient_email
    then
      raise exception 'Sent quote recipient is locked';
    end if;
  end if;

  if old.status is distinct from new.status and new.status in ('ready','approved','sent') then
    if new.valid_until is null or new.valid_until < current_date then
      raise exception 'Quote validity date must be today or later';
    end if;

    if not exists (
      select 1 from public.quote_lines l where l.quote_id = new.id
    ) then
      raise exception 'Quote must contain at least one line';
    end if;

    if exists (
      select 1
      from public.quote_lines l
      where l.quote_id = new.id
        and (
          l.quantity <= 0 or
          l.unit_price < 0 or
          l.discount_percent < 0 or
          l.discount_percent > 100 or
          l.pricing_required
        )
    ) then
      raise exception 'Quote contains incomplete or invalid pricing';
    end if;

    if not exists (
      select 1
      from public.organizations o
      where o.id = new.organization_id
        and nullif(trim(o.name),'') is not null
        and nullif(trim(o.email),'') is not null
        and nullif(trim(o.address_line1),'') is not null
        and nullif(trim(o.city),'') is not null
    ) then
      raise exception 'Complete company settings before finalizing a quote';
    end if;
  end if;

  if new.status = 'approved' and (new.approved_by is null or new.approved_at is null) then
    raise exception 'Approved quote must record approver and approval time';
  end if;

  if new.status = 'sent' and (
    new.sent_at is null or
    nullif(trim(coalesce(new.sent_to_email, new.recipient_email, '')), '') is null
  ) then
    raise exception 'Sent quote must record recipient and sent time';
  end if;

  return new;
end;
$$;

drop trigger if exists quotes_state_guard on public.quotes;
create trigger quotes_state_guard
before update on public.quotes
for each row execute function private.enforce_quote_state_transition();

create or replace function private.enforce_quote_line_editable()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  q_status text;
  q_org uuid;
begin
  select status, organization_id into q_status, q_org
  from public.quotes
  where id = coalesce(new.quote_id, old.quote_id);

  if q_status is null then
    raise exception 'Quote not found';
  end if;

  if q_status not in ('draft','ready') then
    raise exception 'Approved or sent quote lines are locked';
  end if;

  if tg_op <> 'DELETE' and q_org <> new.organization_id then
    raise exception 'Quote line workspace mismatch';
  end if;

  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

drop trigger if exists quote_lines_edit_guard on public.quote_lines;
create trigger quote_lines_edit_guard
before insert or update or delete on public.quote_lines
for each row execute function private.enforce_quote_line_editable();

create or replace function private.enforce_quote_line_pricing_state()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' and new.catalogue_unit_price is null then
    new.pricing_required := true;
  elsif tg_op = 'UPDATE'
    and old.pricing_required
    and new.unit_price is distinct from old.unit_price
  then
    new.pricing_required := false;
  end if;

  return new;
end;
$$;

drop trigger if exists quote_lines_pricing_guard on public.quote_lines;
create trigger quote_lines_pricing_guard
before insert or update on public.quote_lines
for each row execute function private.enforce_quote_line_pricing_state();

-- Tenant relation guard: even privileged or future application code cannot join objects across workspaces.
create or replace function private.enforce_workspace_relations()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_table_name = 'rfqs' then
    if new.customer_id is not null and not exists (
      select 1 from public.customers c
      where c.id = new.customer_id and c.organization_id = new.organization_id
    ) then raise exception 'RFQ customer workspace mismatch'; end if;

  elsif tg_table_name = 'rfq_lines' then
    if not exists (
      select 1 from public.rfqs r
      where r.id = new.rfq_id and r.organization_id = new.organization_id
    ) then raise exception 'RFQ line workspace mismatch'; end if;
    if new.selected_product_id is not null and not exists (
      select 1 from public.products p
      where p.id = new.selected_product_id and p.organization_id = new.organization_id
    ) then raise exception 'RFQ line product workspace mismatch'; end if;

  elsif tg_table_name = 'customer_product_mappings' then
    if not exists (
      select 1 from public.customers c
      where c.id = new.customer_id and c.organization_id = new.organization_id
    ) then raise exception 'Customer memory customer workspace mismatch'; end if;
    if not exists (
      select 1 from public.products p
      where p.id = new.product_id and p.organization_id = new.organization_id
    ) then raise exception 'Customer memory product workspace mismatch'; end if;

  elsif tg_table_name = 'customer_contacts' then
    if not exists (
      select 1 from public.customers c
      where c.id = new.customer_id and c.organization_id = new.organization_id
    ) then raise exception 'Contact customer workspace mismatch'; end if;

  elsif tg_table_name = 'product_match_candidates' then
    if not exists (
      select 1 from public.rfq_lines l
      where l.id = new.rfq_line_id and l.organization_id = new.organization_id
    ) then raise exception 'Candidate RFQ line workspace mismatch'; end if;
    if not exists (
      select 1 from public.products p
      where p.id = new.product_id and p.organization_id = new.organization_id
    ) then raise exception 'Candidate product workspace mismatch'; end if;

  elsif tg_table_name = 'match_feedback' then
    if not exists (
      select 1 from public.rfq_lines l
      where l.id = new.rfq_line_id and l.organization_id = new.organization_id
    ) then raise exception 'Feedback RFQ line workspace mismatch'; end if;
    if not exists (
      select 1 from public.products p
      where p.id = new.selected_product_id and p.organization_id = new.organization_id
    ) then raise exception 'Feedback selected product workspace mismatch'; end if;
    if new.previous_product_id is not null and not exists (
      select 1 from public.products p
      where p.id = new.previous_product_id and p.organization_id = new.organization_id
    ) then raise exception 'Feedback previous product workspace mismatch'; end if;

  elsif tg_table_name = 'quotes' then
    if not exists (
      select 1 from public.customers c
      where c.id = new.customer_id and c.organization_id = new.organization_id
    ) then raise exception 'Quote customer workspace mismatch'; end if;
    if new.rfq_id is not null and not exists (
      select 1 from public.rfqs r
      where r.id = new.rfq_id and r.organization_id = new.organization_id
    ) then raise exception 'Quote RFQ workspace mismatch'; end if;
    if new.recipient_contact_id is not null and not exists (
      select 1 from public.customer_contacts c
      where c.id = new.recipient_contact_id
        and c.customer_id = new.customer_id
        and c.organization_id = new.organization_id
    ) then raise exception 'Quote recipient workspace mismatch'; end if;

  elsif tg_table_name = 'quote_lines' then
    if not exists (
      select 1 from public.quotes q
      where q.id = new.quote_id and q.organization_id = new.organization_id
    ) then raise exception 'Quote line quote workspace mismatch'; end if;
    if not exists (
      select 1 from public.products p
      where p.id = new.product_id and p.organization_id = new.organization_id
    ) then raise exception 'Quote line product workspace mismatch'; end if;
    if new.source_rfq_line_id is not null and not exists (
      select 1 from public.rfq_lines l
      where l.id = new.source_rfq_line_id and l.organization_id = new.organization_id
    ) then raise exception 'Quote line source workspace mismatch'; end if;

  elsif tg_table_name = 'ai_extractions' then
    if new.rfq_id is not null and not exists (
      select 1 from public.rfqs r
      where r.id = new.rfq_id and r.organization_id = new.organization_id
    ) then raise exception 'AI extraction RFQ workspace mismatch'; end if;

  elsif tg_table_name = 'quote_email_events' then
    if not exists (
      select 1 from public.quotes q
      where q.id = new.quote_id and q.organization_id = new.organization_id
    ) then raise exception 'Email event quote workspace mismatch'; end if;
  end if;

  return new;
end;
$$;

do $$
declare
  t text;
begin
  foreach t in array array[
    'rfqs','rfq_lines','customer_product_mappings','customer_contacts',
    'product_match_candidates','match_feedback','quotes','quote_lines',
    'ai_extractions','quote_email_events'
  ]
  loop
    execute format('drop trigger if exists workspace_relation_guard on public.%I', t);
    execute format(
      'create trigger workspace_relation_guard before insert or update on public.%I for each row execute function private.enforce_workspace_relations()',
      t
    );
  end loop;
end;
$$;

-- Tighten write roles while preserving read access for workspace reviewers.
drop policy if exists customers_org_access on public.customers;
create policy customers_org_select on public.customers
for select to authenticated using (private.is_org_member(organization_id));
create policy customers_org_insert on public.customers
for insert to authenticated with check (private.has_org_role(organization_id, array['owner','admin','member']));
create policy customers_org_update on public.customers
for update to authenticated
using (private.has_org_role(organization_id, array['owner','admin','member']))
with check (private.has_org_role(organization_id, array['owner','admin','member']));
create policy customers_org_delete on public.customers
for delete to authenticated using (private.has_org_role(organization_id, array['owner','admin','member']));

drop policy if exists products_org_access on public.products;
create policy products_org_select on public.products
for select to authenticated using (private.is_org_member(organization_id));
create policy products_org_insert on public.products
for insert to authenticated with check (private.has_org_role(organization_id, array['owner','admin']));
create policy products_org_update on public.products
for update to authenticated
using (private.has_org_role(organization_id, array['owner','admin']))
with check (private.has_org_role(organization_id, array['owner','admin']));
create policy products_org_delete on public.products
for delete to authenticated using (private.has_org_role(organization_id, array['owner','admin']));

drop policy if exists mappings_org_access on public.customer_product_mappings;
create policy mappings_org_select on public.customer_product_mappings
for select to authenticated using (private.is_org_member(organization_id));
create policy mappings_org_insert on public.customer_product_mappings
for insert to authenticated with check (private.has_org_role(organization_id, array['owner','admin','member']));
create policy mappings_org_update on public.customer_product_mappings
for update to authenticated
using (private.has_org_role(organization_id, array['owner','admin','member']))
with check (private.has_org_role(organization_id, array['owner','admin','member']));
create policy mappings_org_delete on public.customer_product_mappings
for delete to authenticated using (private.has_org_role(organization_id, array['owner','admin']));

drop policy if exists rfqs_org_access on public.rfqs;
create policy rfqs_org_select on public.rfqs
for select to authenticated using (private.is_org_member(organization_id));
create policy rfqs_org_insert on public.rfqs
for insert to authenticated with check (private.has_org_role(organization_id, array['owner','admin','member']));
create policy rfqs_org_update on public.rfqs
for update to authenticated
using (private.has_org_role(organization_id, array['owner','admin','member']))
with check (private.has_org_role(organization_id, array['owner','admin','member']));
create policy rfqs_org_delete on public.rfqs
for delete to authenticated using (private.has_org_role(organization_id, array['owner','admin']));

drop policy if exists rfq_lines_org_access on public.rfq_lines;
create policy rfq_lines_org_select on public.rfq_lines
for select to authenticated using (private.is_org_member(organization_id));
create policy rfq_lines_org_insert on public.rfq_lines
for insert to authenticated with check (private.has_org_role(organization_id, array['owner','admin','member']));
create policy rfq_lines_org_update on public.rfq_lines
for update to authenticated
using (private.has_org_role(organization_id, array['owner','admin','member']))
with check (private.has_org_role(organization_id, array['owner','admin','member']));
create policy rfq_lines_org_delete on public.rfq_lines
for delete to authenticated using (private.has_org_role(organization_id, array['owner','admin']));

drop policy if exists candidates_org_access on public.product_match_candidates;
create policy candidates_org_select on public.product_match_candidates
for select to authenticated using (private.is_org_member(organization_id));
create policy candidates_org_insert on public.product_match_candidates
for insert to authenticated with check (private.has_org_role(organization_id, array['owner','admin','member']));
create policy candidates_org_update on public.product_match_candidates
for update to authenticated
using (private.has_org_role(organization_id, array['owner','admin','member']))
with check (private.has_org_role(organization_id, array['owner','admin','member']));
create policy candidates_org_delete on public.product_match_candidates
for delete to authenticated using (private.has_org_role(organization_id, array['owner','admin','member']));

drop policy if exists feedback_org_access on public.match_feedback;
create policy feedback_org_select on public.match_feedback
for select to authenticated using (private.is_org_member(organization_id));
create policy feedback_org_insert on public.match_feedback
for insert to authenticated with check (
  private.has_org_role(organization_id, array['owner','admin','member'])
  and (user_id is null or user_id = (select auth.uid()))
);

drop policy if exists ai_extractions_org_access on public.ai_extractions;
create policy ai_extractions_org_select on public.ai_extractions
for select to authenticated using (private.is_org_member(organization_id));
create policy ai_extractions_org_insert on public.ai_extractions
for insert to authenticated with check (private.has_org_role(organization_id, array['owner','admin','member']));

drop policy if exists customer_contacts_org_insert on public.customer_contacts;
drop policy if exists customer_contacts_org_update on public.customer_contacts;
drop policy if exists customer_contacts_org_delete on public.customer_contacts;
create policy customer_contacts_org_insert on public.customer_contacts
for insert to authenticated with check (private.has_org_role(organization_id, array['owner','admin','member']));
create policy customer_contacts_org_update on public.customer_contacts
for update to authenticated
using (private.has_org_role(organization_id, array['owner','admin','member']))
with check (private.has_org_role(organization_id, array['owner','admin','member']));
create policy customer_contacts_org_delete on public.customer_contacts
for delete to authenticated using (private.has_org_role(organization_id, array['owner','admin','member']));

grant select, insert, update, delete on public.customers to authenticated;
grant select, insert, update, delete on public.products to authenticated;
grant select, insert, update, delete on public.customer_product_mappings to authenticated;
grant select, insert, update, delete on public.rfqs to authenticated;
grant select, insert, update, delete on public.rfq_lines to authenticated;
grant select, insert, update, delete on public.product_match_candidates to authenticated;
grant select, insert on public.match_feedback to authenticated;
grant select, insert on public.ai_extractions to authenticated;
grant select, insert, update, delete on public.customer_contacts to authenticated;
grant select, insert, update, delete on public.quotes to authenticated;
grant select, insert, update, delete on public.quote_lines to authenticated;
