-- S1 Support Center hardening: keep ticket mutation behind the trusted server
-- boundary, quiet browser access to the audit table, and cover support FKs.

drop policy if exists support_events_deny_browser_access on public.support_events;
create policy support_events_deny_browser_access
on public.support_events
as restrictive
for all
to authenticated
using (false)
with check (false);

create index if not exists support_messages_org_idx
  on public.support_messages(organization_id);
create index if not exists support_messages_author_idx
  on public.support_messages(author_user_id)
  where author_user_id is not null;

create index if not exists support_attachments_org_idx
  on public.support_attachments(organization_id);
create index if not exists support_attachments_message_idx
  on public.support_attachments(message_id)
  where message_id is not null;
create index if not exists support_attachments_uploaded_by_idx
  on public.support_attachments(uploaded_by)
  where uploaded_by is not null;

create index if not exists support_events_org_idx
  on public.support_events(organization_id);
create index if not exists support_events_actor_idx
  on public.support_events(actor_user_id)
  where actor_user_id is not null;

create or replace function public.create_support_ticket_server(
  target_actor_id uuid,
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
  clean_category text := lower(trim(coalesce(target_category, '')));
  clean_subject text := trim(coalesce(target_subject, ''));
  clean_message text := trim(coalesce(target_message, ''));
  clean_path text := nullif(trim(coalesce(target_context_path, '')), '');
  clean_request_id text := nullif(trim(coalesce(target_request_id, '')), '');
  actor_email text;
  created_ticket_id uuid;
  created_ticket_number bigint;
  created_message_id uuid;
begin
  if target_actor_id is null then
    raise exception 'Actor is required';
  end if;

  if not exists (
    select 1
    from public.organization_members m
    where m.organization_id = target_organization_id
      and m.user_id = target_actor_id
      and m.role in ('owner','admin','member')
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

  select nullif(trim(coalesce(u.email, '')), '')
  into actor_email
  from auth.users u
  where u.id = target_actor_id;

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
    target_actor_id,
    actor_email,
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
    target_actor_id,
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
    target_actor_id,
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

revoke all on function public.create_support_ticket_server(uuid,uuid,text,text,text,text,text) from public;
revoke all on function public.create_support_ticket_server(uuid,uuid,text,text,text,text,text) from anon;
revoke all on function public.create_support_ticket_server(uuid,uuid,text,text,text,text,text) from authenticated;
grant execute on function public.create_support_ticket_server(uuid,uuid,text,text,text,text,text) to service_role;

revoke all on function public.create_support_ticket(uuid,text,text,text,text,text) from public;
revoke all on function public.create_support_ticket(uuid,text,text,text,text,text) from anon;
revoke all on function public.create_support_ticket(uuid,text,text,text,text,text) from authenticated;
revoke all on function public.create_support_ticket(uuid,text,text,text,text,text) from service_role;
drop function if exists public.create_support_ticket(uuid,text,text,text,text,text);
