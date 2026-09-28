-- Pilot hardening: catalogue sync/replace semantics, inactive-product quote guards,
-- and database-backed commercial audit trail.

-- Audit events are append-only for application users. Writes happen through trusted
-- database functions/triggers so users cannot edit or delete history.
drop policy if exists activity_org_access on public.activity_events;
drop policy if exists activity_org_select on public.activity_events;
create policy activity_org_select on public.activity_events
for select to authenticated
using (private.is_org_member(organization_id));

revoke insert, update, delete on public.activity_events from authenticated;
grant select on public.activity_events to authenticated;

create or replace function private.write_activity_event(
  p_organization_id uuid,
  p_entity_type text,
  p_entity_id uuid,
  p_event_type text,
  p_metadata jsonb default '{}'::jsonb,
  p_actor_user_id uuid default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_organization_id is null or p_entity_id is null then
    raise exception 'Audit event requires organization and entity';
  end if;

  insert into public.activity_events(
    organization_id,
    entity_type,
    entity_id,
    event_type,
    actor_user_id,
    metadata
  )
  values (
    p_organization_id,
    left(coalesce(nullif(trim(p_entity_type), ''), 'unknown'), 120),
    p_entity_id,
    left(coalesce(nullif(trim(p_event_type), ''), 'unknown'), 160),
    coalesce(p_actor_user_id, (select auth.uid())),
    coalesce(p_metadata, '{}'::jsonb)
  );
end;
$$;

revoke all on function private.write_activity_event(uuid,text,uuid,text,jsonb,uuid) from public;
grant execute on function private.write_activity_event(uuid,text,uuid,text,jsonb,uuid) to authenticated, service_role;

-- Catalogue imports are full workspace synchronizations:
-- incoming rows are active; previously active SKUs omitted from the file are deactivated.
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
  deactivated_count integer := 0;
begin
  if not private.has_org_role(target_organization_id, array['owner','admin']) then
    raise exception 'Owner or admin access is required to import the catalogue';
  end if;

  if payload is null or jsonb_typeof(payload) <> 'array' or jsonb_array_length(payload) = 0 then
    raise exception 'Catalogue payload must contain at least one product';
  end if;

  with incoming as (
    select trim(x.sku) as sku, trim(x.name) as name, x.unit_price
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
    count(*) filter (
      where sku is null or sku = ''
         or name is null or name = ''
         or unit_price < 0
    )
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

  update public.products p
  set active = false,
      updated_at = now()
  where p.organization_id = target_organization_id
    and p.active = true
    and not exists (
      select 1
      from jsonb_to_recordset(payload) as x(
        sku text,
        name text,
        manufacturer text,
        manufacturer_part_number text,
        unit text,
        unit_price numeric,
        stock_quantity numeric
      )
      where lower(trim(x.sku)) = lower(p.sku)
    );

  get diagnostics deactivated_count = row_count;

  perform private.write_activity_event(
    target_organization_id,
    'catalogue',
    target_organization_id,
    'catalogue_imported',
    jsonb_build_object(
      'mode', 'sync_replace',
      'total', total_count,
      'created', total_count - existing_count,
      'updated', existing_count,
      'missing_price', missing_price_count,
      'deactivated', deactivated_count
    ),
    (select auth.uid())
  );

  return jsonb_build_object(
    'total', total_count,
    'created', total_count - existing_count,
    'updated', existing_count,
    'missing_price', missing_price_count,
    'deactivated', deactivated_count
  );
end;
$$;

-- Quotes may never advance to a commercial state while referencing inactive products.
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

    if exists (
      select 1
      from public.quote_lines l
      join public.products p on p.id = l.product_id
      where l.quote_id = new.id
        and (p.organization_id <> new.organization_id or p.active is not true)
    ) then
      raise exception 'Quote contains an inactive or unavailable product; return to RFQ review';
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

-- New quote lines must also point to an active product. Historical approved/sent lines
-- remain intact if a product is later deactivated.
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

  if tg_op <> 'DELETE' and not exists (
    select 1
    from public.products p
    where p.id = new.product_id
      and p.organization_id = q_org
      and p.active = true
  ) then
    raise exception 'Quote line product is inactive or unavailable';
  end if;

  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

-- Core audit triggers.
create or replace function private.audit_rfq_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    perform private.write_activity_event(
      new.organization_id, 'rfq', new.id, 'rfq_created',
      jsonb_build_object('status', new.status, 'source_type', new.source_type)
    );
  elsif old.status is distinct from new.status then
    if new.status = 'failed' then
      perform private.write_activity_event(
        new.organization_id, 'rfq', new.id, 'rfq_processing_failed',
        jsonb_build_object('from_status', old.status, 'error', left(coalesce(new.processing_error,''), 500))
      );
    elsif new.status = 'ready' then
      perform private.write_activity_event(
        new.organization_id, 'rfq', new.id, 'rfq_ready',
        jsonb_build_object('from_status', old.status)
      );
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists rfqs_audit on public.rfqs;
create trigger rfqs_audit
after insert or update on public.rfqs
for each row execute function private.audit_rfq_change();

create or replace function private.audit_match_feedback()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.write_activity_event(
    new.organization_id,
    'rfq_line',
    new.rfq_line_id,
    'product_match_confirmed',
    jsonb_build_object(
      'selected_product_id', new.selected_product_id,
      'previous_product_id', new.previous_product_id,
      'remember_for_customer', new.remember_for_customer
    ),
    new.user_id
  );
  return new;
end;
$$;

drop trigger if exists match_feedback_audit on public.match_feedback;
create trigger match_feedback_audit
after insert on public.match_feedback
for each row execute function private.audit_match_feedback();

create or replace function private.audit_customer_memory()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    perform private.write_activity_event(
      new.organization_id,
      'customer_memory',
      new.id,
      'customer_memory_created',
      jsonb_build_object(
        'customer_id', new.customer_id,
        'customer_sku', new.customer_sku,
        'product_id', new.product_id
      ),
      new.confirmed_by_user_id
    );
  elsif old.product_id is distinct from new.product_id then
    perform private.write_activity_event(
      new.organization_id,
      'customer_memory',
      new.id,
      'customer_memory_changed',
      jsonb_build_object(
        'customer_id', new.customer_id,
        'customer_sku', new.customer_sku,
        'old_product_id', old.product_id,
        'new_product_id', new.product_id
      ),
      new.confirmed_by_user_id
    );
  end if;
  return new;
end;
$$;

drop trigger if exists customer_memory_audit on public.customer_product_mappings;
create trigger customer_memory_audit
after insert or update on public.customer_product_mappings
for each row execute function private.audit_customer_memory();

create or replace function private.audit_quote_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  event_name text;
  actor uuid;
begin
  if tg_op = 'INSERT' then
    perform private.write_activity_event(
      new.organization_id,
      'quote',
      new.id,
      'quote_created',
      jsonb_build_object('rfq_id', new.rfq_id, 'quote_number', new.quote_number),
      new.created_by
    );
    return new;
  end if;

  if old.status is distinct from new.status then
    event_name := case
      when old.status = 'ready' and new.status = 'draft' then 'quote_returned_to_draft'
      when new.status = 'ready' then 'quote_ready'
      when new.status = 'approved' then 'quote_approved'
      when new.status = 'sent' then 'quote_sent'
      when new.status = 'expired' then 'quote_expired'
      else 'quote_status_changed'
    end;

    actor := case when new.status = 'approved' then new.approved_by else (select auth.uid()) end;

    perform private.write_activity_event(
      new.organization_id,
      'quote',
      new.id,
      event_name,
      jsonb_build_object(
        'from_status', old.status,
        'to_status', new.status,
        'quote_number', new.quote_number,
        'recipient_email', case when new.status = 'sent' then new.sent_to_email else null end
      ),
      actor
    );
  end if;

  return new;
end;
$$;

drop trigger if exists quotes_audit on public.quotes;
create trigger quotes_audit
after insert or update on public.quotes
for each row execute function private.audit_quote_change();

create or replace function private.audit_quote_line_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.quantity is distinct from new.quantity
     or old.unit_price is distinct from new.unit_price
     or old.discount_percent is distinct from new.discount_percent
     or old.pricing_required is distinct from new.pricing_required then
    perform private.write_activity_event(
      new.organization_id,
      'quote',
      new.quote_id,
      'quote_line_pricing_changed',
      jsonb_build_object(
        'quote_line_id', new.id,
        'line_number', new.line_number,
        'old_quantity', old.quantity,
        'new_quantity', new.quantity,
        'old_unit_price', old.unit_price,
        'new_unit_price', new.unit_price,
        'old_discount_percent', old.discount_percent,
        'new_discount_percent', new.discount_percent,
        'pricing_required', new.pricing_required
      )
    );
  end if;
  return new;
end;
$$;

drop trigger if exists quote_lines_audit on public.quote_lines;
create trigger quote_lines_audit
after update on public.quote_lines
for each row execute function private.audit_quote_line_change();

create or replace function private.audit_quote_email_event()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  normalized text;
begin
  normalized := lower(new.event_type);

  perform private.write_activity_event(
    new.organization_id,
    'quote',
    new.quote_id,
    case
      when normalized like '%delivered%' then 'quote_delivered'
      when normalized like '%bounced%' then 'quote_bounced'
      when normalized like '%failed%' then 'quote_delivery_failed'
      when normalized like '%sent%' then 'quote_delivery_sent'
      else 'quote_delivery_event'
    end,
    jsonb_build_object(
      'provider_event_type', new.event_type,
      'provider_email_id', new.provider_email_id,
      'recipient_email', new.recipient_email,
      'occurred_at', new.occurred_at
    ),
    null
  );

  return new;
end;
$$;

drop trigger if exists quote_email_events_audit on public.quote_email_events;
create trigger quote_email_events_audit
after insert on public.quote_email_events
for each row execute function private.audit_quote_email_event();
