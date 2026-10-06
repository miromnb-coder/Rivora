-- S1 Support Center foundation: workspace-scoped support tickets, messages,
-- private attachments and an authenticated creation boundary.

create table if not exists public.support_tickets (
  id uuid primary key default gen_random_uuid(),
  ticket_number bigint generated always as identity unique,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  created_by uuid references auth.users(id) on delete set null,
  requester_email text,
  category text not null,
  subject text not null,
  status text not null default 'new',
  priority text not null default 'normal',
  context_path text,
  request_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  resolved_at timestamptz,
  constraint support_tickets_category_check
    check (category in ('product','integration','billing','account','other')),
  constraint support_tickets_subject_check
    check (char_length(trim(subject)) between 3 and 160),
  constraint support_tickets_status_check
    check (status in ('new','in_progress','waiting_customer','resolved')),
  constraint support_tickets_priority_check
    check (priority in ('low','normal','high')),
  constraint support_tickets_context_path_check
    check (
      context_path is null
      or (
        char_length(context_path) <= 500
        and context_path like '/app%'
      )
    ),
  constraint support_tickets_request_id_check
    check (request_id is null or char_length(request_id) <= 120)
);

create table if not exists public.support_messages (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.support_tickets(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  author_user_id uuid references auth.users(id) on delete set null,
  author_type text not null,
  body text not null,
  created_at timestamptz not null default now(),
  constraint support_messages_author_type_check
    check (author_type in ('user','support','system')),
  constraint support_messages_body_check
    check (char_length(trim(body)) between 1 and 5000)
);

create table if not exists public.support_attachments (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.support_tickets(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  message_id uuid references public.support_messages(id) on delete set null,
  uploaded_by uuid references auth.users(id) on delete set null,
  bucket text not null default 'support-attachments',
  storage_path text not null,
  file_name text not null,
  mime_type text not null,
  size_bytes bigint not null,
  created_at timestamptz not null default now(),
  constraint support_attachments_size_check
    check (size_bytes > 0 and size_bytes <= 5242880),
  constraint support_attachments_mime_check
    check (mime_type in ('image/png','image/jpeg','image/webp'))
);

create table if not exists public.support_events (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.support_tickets(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  actor_user_id uuid references auth.users(id) on delete set null,
  event_type text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint support_events_event_type_check
    check (event_type ~ '^[a-z][a-z0-9_]{0,63}$')
);

create index if not exists support_tickets_org_created_idx
  on public.support_tickets(organization_id, created_at desc);
create index if not exists support_tickets_creator_created_idx
  on public.support_tickets(created_by, created_at desc)
  where created_by is not null;
create index if not exists support_tickets_status_created_idx
  on public.support_tickets(status, created_at desc);
create index if not exists support_messages_ticket_created_idx
  on public.support_messages(ticket_id, created_at);
create index if not exists support_attachments_ticket_created_idx
  on public.support_attachments(ticket_id, created_at);
create index if not exists support_events_ticket_created_idx
  on public.support_events(ticket_id, created_at);

alter table public.support_tickets enable row level security;
alter table public.support_messages enable row level security;
alter table public.support_attachments enable row level security;
alter table public.support_events enable row level security;

drop policy if exists support_tickets_member_read on public.support_tickets;
create policy support_tickets_member_read
on public.support_tickets
for select
to authenticated
using (
  created_by = (select auth.uid())
  or private.has_org_role(
    organization_id,
    array['owner','admin']::text[]
  )
);

drop policy if exists support_messages_member_read on public.support_messages;
create policy support_messages_member_read
on public.support_messages
for select
to authenticated
using (
  exists (
    select 1
    from public.support_tickets t
    where t.id = support_messages.ticket_id
      and t.organization_id = support_messages.organization_id
      and (
        t.created_by = (select auth.uid())
        or private.has_org_role(
          t.organization_id,
          array['owner','admin']::text[]
        )
      )
  )
);

drop policy if exists support_attachments_member_read on public.support_attachments;
create policy support_attachments_member_read
on public.support_attachments
for select
to authenticated
using (
  exists (
    select 1
    from public.support_tickets t
    where t.id = support_attachments.ticket_id
      and t.organization_id = support_attachments.organization_id
      and (
        t.created_by = (select auth.uid())
        or private.has_org_role(
          t.organization_id,
          array['owner','admin']::text[]
        )
      )
  )
);

-- Tickets are created atomically through a single authenticated RPC. Browser
-- roles have no direct mutation access to the support tables.
revoke all on table public.support_tickets from anon, authenticated;
revoke all on table public.support_messages from anon, authenticated;
revoke all on table public.support_attachments from anon, authenticated;
revoke all on table public.support_events from anon, authenticated;

grant select on table public.support_tickets to authenticated;
grant select on table public.support_messages to authenticated;
grant select on table public.support_attachments to authenticated;

grant select, insert, update, delete on table public.support_tickets to service_role;
grant select, insert, update, delete on table public.support_messages to service_role;
grant select, insert, update, delete on table public.support_attachments to service_role;
grant select, insert, update, delete on table public.support_events to service_role;

create or replace function public.create_support_ticket(
  target_organization_id uuid,
  target_category text,
  target_subject text,
  target_message text,
  target_context_path text default null,
  target_request_id text default null
)
returns table (
  ticket_id uuid,
  ticket_number bigint
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  clean_category text := lower(trim(coalesce(target_category, '')));
  clean_subject text := trim(coalesce(target_subject, ''));
  clean_message text := trim(coalesce(target_message, ''));
  clean_path text := nullif(trim(coalesce(target_context_path, '')), '');
  clean_request_id text := nullif(trim(coalesce(target_request_id, '')), '');
  created_ticket_id uuid;
  created_ticket_number bigint;
  created_message_id uuid;
begin
  if uid is null then
    raise exception 'Authentication required';
  end if;

  if not private.has_org_role(
    target_organization_id,
    array['owner','admin','member']::text[]
  ) then
    raise exception 'Not authorized';
  end if;

  if clean_category not in ('product','integration','billing','account','other') then
    raise exception 'Invalid support category';
  end if;

  if char_length(clean_subject) < 3 or char_length(clean_subject) > 160 then
    raise exception 'Support subject must be between 3 and 160 characters';
  end if;

  if char_length(clean_message) < 10 or char_length(clean_message) > 5000 then
    raise exception 'Support message must be between 10 and 5000 characters';
  end if;

  if clean_path is not null and (
    char_length(clean_path) > 500
    or clean_path not like '/app%'
  ) then
    raise exception 'Invalid support context path';
  end if;

  if clean_request_id is not null and char_length(clean_request_id) > 120 then
    raise exception 'Invalid support request id';
  end if;

  insert into public.support_tickets(
    organization_id,
    created_by,
    requester_email,
    category,
    subject,
    context_path,
    request_id
  )
  values (
    target_organization_id,
    uid,
    nullif(trim(coalesce((select auth.jwt()) ->> 'email', '')), ''),
    clean_category,
    clean_subject,
    clean_path,
    clean_request_id
  )
  returning id, public.support_tickets.ticket_number
  into created_ticket_id, created_ticket_number;

  insert into public.support_messages(
    ticket_id,
    organization_id,
    author_user_id,
    author_type,
    body
  )
  values (
    created_ticket_id,
    target_organization_id,
    uid,
    'user',
    clean_message
  )
  returning id into created_message_id;

  insert into public.support_events(
    ticket_id,
    organization_id,
    actor_user_id,
    event_type,
    metadata
  )
  values (
    created_ticket_id,
    target_organization_id,
    uid,
    'ticket_created',
    jsonb_build_object(
      'category', clean_category,
      'context_path', clean_path,
      'message_id', created_message_id
    )
  );

  return query
  select created_ticket_id, created_ticket_number;
end;
$$;

revoke all on function public.create_support_ticket(uuid,text,text,text,text,text) from public;
revoke all on function public.create_support_ticket(uuid,text,text,text,text,text) from anon;
grant execute on function public.create_support_ticket(uuid,text,text,text,text,text) to authenticated;
grant execute on function public.create_support_ticket(uuid,text,text,text,text,text) to service_role;

-- Private screenshot bucket. Uploads are performed server-side after the
-- authenticated ticket RPC succeeds; no public storage policy is added.
insert into storage.buckets(
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'support-attachments',
  'support-attachments',
  false,
  5242880,
  array['image/png','image/jpeg','image/webp']::text[]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

comment on table public.support_tickets is
  'Workspace-scoped customer support tickets. S1 creates tickets; later support phases add in-app tracking.';
comment on table public.support_events is
  'Append-only support audit trail written by trusted server boundaries.';
