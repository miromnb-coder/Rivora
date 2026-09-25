-- Rivora v0.1 foundation schema.
-- Do not apply this to the existing OrderDesk Nordic project.
-- Provision a dedicated Rivora Supabase project before running it.

create extension if not exists pgcrypto;

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 200),
  created_at timestamptz not null default now()
);

create table public.organization_members (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member' check (role in ('owner','admin','member','reviewer')),
  created_at timestamptz not null default now(),
  primary key (organization_id, user_id)
);

create table public.customers (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  external_id text,
  email_domain text,
  created_at timestamptz not null default now(),
  unique (organization_id, external_id)
);

create table public.products (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  sku text not null,
  manufacturer text,
  manufacturer_part_number text,
  name text not null,
  unit text not null default 'pcs',
  unit_price numeric(14,4),
  stock_quantity numeric(14,4),
  search_text text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (organization_id, sku)
);

create table public.customer_product_mappings (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  customer_id uuid not null references public.customers(id) on delete cascade,
  customer_sku text not null,
  customer_description text,
  product_id uuid not null references public.products(id) on delete restrict,
  confidence numeric(5,2) not null default 100 check (confidence between 0 and 100),
  source text not null default 'user_confirmed' check (source in ('user_confirmed','imported','system')),
  times_used integer not null default 0 check (times_used >= 0),
  confirmed_by_user_id uuid references auth.users(id) on delete set null,
  last_used_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, customer_id, customer_sku)
);

create table public.rfqs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  customer_id uuid references public.customers(id) on delete set null,
  reference text,
  source_type text not null check (source_type in ('pdf','excel','email','manual')),
  status text not null default 'received' check (status in ('received','processing','needs_review','ready','quoted','failed')),
  overall_confidence numeric(5,2) check (overall_confidence between 0 and 100),
  received_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table public.rfq_files (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  rfq_id uuid not null references public.rfqs(id) on delete cascade,
  file_name text not null,
  storage_path text not null,
  mime_type text,
  created_at timestamptz not null default now()
);

create table public.rfq_lines (
  id uuid primary key default gen_random_uuid(),
  rfq_id uuid not null references public.rfqs(id) on delete cascade,
  line_number integer not null check (line_number > 0),
  customer_sku text,
  raw_description text,
  quantity numeric(14,4) not null check (quantity > 0),
  unit text,
  selected_product_id uuid references public.products(id) on delete set null,
  match_confidence numeric(5,2) check (match_confidence between 0 and 100),
  match_method text check (match_method in ('customer_memory','exact_sku','catalogue','ai_suggestion','manual')),
  review_status text not null default 'pending' check (review_status in ('pending','matched','needs_review','confirmed','unmatched')),
  created_at timestamptz not null default now(),
  unique (rfq_id, line_number)
);

create table public.product_match_candidates (
  id uuid primary key default gen_random_uuid(),
  rfq_line_id uuid not null references public.rfq_lines(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  confidence numeric(5,2) not null check (confidence between 0 and 100),
  method text not null check (method in ('customer_memory','exact_sku','catalogue','ai_suggestion')),
  rank integer not null check (rank > 0),
  created_at timestamptz not null default now(),
  unique (rfq_line_id, product_id)
);

create table public.match_feedback (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  rfq_line_id uuid not null references public.rfq_lines(id) on delete cascade,
  selected_product_id uuid not null references public.products(id) on delete restrict,
  previous_product_id uuid references public.products(id) on delete set null,
  remember_for_customer boolean not null default true,
  user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.quotes (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  customer_id uuid not null references public.customers(id) on delete restrict,
  rfq_id uuid references public.rfqs(id) on delete set null,
  quote_number text,
  status text not null default 'draft' check (status in ('draft','approved','sent','expired')),
  currency text not null default 'EUR',
  created_at timestamptz not null default now()
);

create table public.quote_lines (
  id uuid primary key default gen_random_uuid(),
  quote_id uuid not null references public.quotes(id) on delete cascade,
  line_number integer not null check (line_number > 0),
  product_id uuid not null references public.products(id) on delete restrict,
  quantity numeric(14,4) not null check (quantity > 0),
  unit text not null,
  unit_price numeric(14,4) not null check (unit_price >= 0),
  created_at timestamptz not null default now(),
  unique (quote_id, line_number)
);

create table public.activity_events (
  id bigint generated always as identity primary key,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  entity_type text not null,
  entity_id uuid not null,
  event_type text not null,
  actor_user_id uuid references auth.users(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index products_org_sku_idx on public.products(organization_id, sku);
create index customer_product_mappings_lookup_idx on public.customer_product_mappings(organization_id, customer_id, customer_sku);
create index rfqs_org_status_idx on public.rfqs(organization_id, status, received_at desc);
create index rfq_lines_rfq_idx on public.rfq_lines(rfq_id, line_number);
create index match_candidates_line_rank_idx on public.product_match_candidates(rfq_line_id, rank);
create index activity_events_entity_idx on public.activity_events(organization_id, entity_type, entity_id, created_at desc);

alter table public.organizations enable row level security;
alter table public.organization_members enable row level security;
alter table public.customers enable row level security;
alter table public.products enable row level security;
alter table public.customer_product_mappings enable row level security;
alter table public.rfqs enable row level security;
alter table public.rfq_files enable row level security;
alter table public.rfq_lines enable row level security;
alter table public.product_match_candidates enable row level security;
alter table public.match_feedback enable row level security;
alter table public.quotes enable row level security;
alter table public.quote_lines enable row level security;
alter table public.activity_events enable row level security;

-- Data API stays closed until organization-scoped Auth/RLS policies are added.
revoke all on all tables in schema public from anon, authenticated;


-- Nodra workspace/company settings, CRM and pilot monitoring extensions.
alter table public.organizations
  add column if not exists business_id text,
  add column if not exists address_line1 text,
  add column if not exists address_line2 text,
  add column if not exists postal_code text,
  add column if not exists city text,
  add column if not exists country text not null default 'Finland',
  add column if not exists email text,
  add column if not exists phone text,
  add column if not exists logo_path text,
  add column if not exists default_tax_rate numeric not null default 25.5,
  add column if not exists default_quote_validity_days integer not null default 14,
  add column if not exists onboarding_completed_at timestamptz,
  add column if not exists updated_at timestamptz not null default now();

create table if not exists public.customer_contacts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  customer_id uuid not null references public.customers(id) on delete cascade,
  name text not null,
  email text not null,
  phone text,
  title text,
  is_primary boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists customer_contacts_customer_email_uidx
  on public.customer_contacts(customer_id, lower(email));

alter table public.quotes
  add column if not exists recipient_contact_id uuid
  references public.customer_contacts(id) on delete set null;

create table if not exists public.app_error_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  route text,
  action text,
  message text not null,
  error_digest text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);


create index if not exists quotes_recipient_contact_id_idx
  on public.quotes(recipient_contact_id)
  where recipient_contact_id is not null;

create index if not exists app_error_events_user_id_idx
  on public.app_error_events(user_id)
  where user_id is not null;
