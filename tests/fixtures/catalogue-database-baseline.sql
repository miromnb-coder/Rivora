-- Fill documented gaps between schema.sql and the current read-only structural metadata.
alter table public.products add column updated_at timestamptz not null default now();
alter table public.products add column normalized_sku text generated always as (regexp_replace(lower(coalesce(sku,'')), '[^[:alnum:]]+', '', 'g')) stored;
alter table public.products add column normalized_mpn text generated always as (regexp_replace(lower(coalesce(manufacturer_part_number,'')), '[^[:alnum:]]+', '', 'g')) stored;
create function public.rivora_normalize(value text) returns text language sql immutable as $$ select regexp_replace(lower(coalesce(value,'')), '[^[:alnum:]]+', ' ', 'g') $$;
alter table public.products add column normalized_search text generated always as (public.rivora_normalize(coalesce(sku,'') || ' ' || coalesce(manufacturer_part_number,'') || ' ' || coalesce(manufacturer,'') || ' ' || coalesce(name,''))) stored;
alter table public.rfq_lines add column normalized_customer_sku text generated always as (regexp_replace(lower(coalesce(customer_sku,'')), '[^[:alnum:]]+', '', 'g')) stored;
alter table public.rfq_lines add column normalized_text text generated always as (public.rivora_normalize(coalesce(customer_sku,'') || ' ' || coalesce(raw_description,''))) stored;
alter table public.rfq_lines add column updated_at timestamptz not null default now();
alter table public.customer_product_mappings add column normalized_customer_sku text generated always as (regexp_replace(lower(coalesce(customer_sku,'')), '[^[:alnum:]]+', '', 'g')) stored;
create unique index mappings_normalized_key on public.customer_product_mappings(organization_id,customer_id,normalized_customer_sku);
alter table public.quotes add column updated_at timestamptz not null default now(), add column recipient_name text, add column recipient_email text,
  add column sent_to_email text, add column email_provider_id text, add column delivery_status text, add column delivery_status_at timestamptz,
  add column last_sent_at timestamptz, add column delivered_at timestamptz, add column bounced_at timestamptz, add column failed_at timestamptz,
  add column delivery_attempt_count integer not null default 0;
alter table public.quote_lines add column source_rfq_line_id uuid references public.rfq_lines(id), add column sku_snapshot text,
  add column description_snapshot text, add column catalogue_unit_price numeric, add column discount_percent numeric(5,2) default 0,
  add column line_total numeric default 0, add column updated_at timestamptz not null default now();
create table public.ai_extractions(id uuid primary key default gen_random_uuid(), organization_id uuid references public.organizations(id));
alter table public.ai_extractions enable row level security;
create table public.quote_email_events(id uuid primary key default gen_random_uuid(), organization_id uuid references public.organizations(id),
  quote_id uuid references public.quotes(id),event_type text,provider_email_id text,recipient_email text,occurred_at timestamptz default now());
create function private.is_org_member(org uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.organization_members where organization_id=org and user_id=auth.uid()) $$;
revoke all on function private.is_org_member(uuid) from public;
grant execute on function private.is_org_member(uuid) to authenticated;
create policy org_select on public.organizations for select to authenticated using(private.is_org_member(id));
create policy members_select on public.organization_members for select to authenticated using(user_id=auth.uid());
create policy contacts_select on public.customer_contacts for select to authenticated using(private.is_org_member(organization_id));
alter table public.customer_contacts enable row level security;
grant select on public.organization_members, public.organizations to authenticated;

alter table public.rfq_lines add column organization_id uuid references public.organizations(id);
alter table public.product_match_candidates add column organization_id uuid references public.organizations(id);

alter table public.quotes add column valid_until date, add column customer_reference text, add column notes text, add column tax_rate numeric(5,2) default 0,
 add column created_by uuid references auth.users(id), add column approved_by uuid references auth.users(id), add column approved_at timestamptz,
 add column sent_at timestamptz;

alter table public.quote_lines add column organization_id uuid references public.organizations(id);
alter table public.quotes drop constraint quotes_status_check;
alter table public.quotes add constraint quotes_status_check check(status in ('draft','ready','approved','sent','expired'));
create policy quotes_org_access on public.quotes for all to authenticated using(private.is_org_member(organization_id)) with check(exists(select 1 from public.organization_members m where m.organization_id=quotes.organization_id and m.user_id=auth.uid() and m.role in ('owner','admin')));
create policy quote_lines_org_access on public.quote_lines for all to authenticated using(private.is_org_member(organization_id)) with check(exists(select 1 from public.organization_members m where m.organization_id=quote_lines.organization_id and m.user_id=auth.uid() and m.role in ('owner','admin')));
