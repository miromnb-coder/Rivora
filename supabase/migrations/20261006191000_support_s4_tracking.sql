-- S4 — In-app support ticket tracking, replies, unread state and operator workflow.

alter table public.support_tickets
  add column if not exists last_message_at timestamptz,
  add column if not exists last_user_message_at timestamptz,
  add column if not exists last_support_message_at timestamptz;

with message_rollup as (
  select
    ticket_id,
    max(created_at) as last_message_at,
    max(created_at) filter (where author_type = 'user') as last_user_message_at,
    max(created_at) filter (where author_type = 'support') as last_support_message_at
  from public.support_messages
  group by ticket_id
)
update public.support_tickets t
set
  last_message_at = coalesce(r.last_message_at, t.created_at),
  last_user_message_at = r.last_user_message_at,
  last_support_message_at = r.last_support_message_at
from message_rollup r
where r.ticket_id = t.id;

update public.support_tickets
set last_message_at = created_at
where last_message_at is null;

alter table public.support_tickets
  alter column last_message_at set default now();

create table if not exists public.support_ticket_reads (
  ticket_id uuid not null references public.support_tickets(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  last_read_at timestamptz not null default now(),
  primary key (ticket_id, user_id)
);

create index if not exists support_ticket_reads_org_user_idx
  on public.support_ticket_reads(organization_id, user_id, last_read_at desc);
create index if not exists support_ticket_reads_user_idx
  on public.support_ticket_reads(user_id, last_read_at desc);

alter table public.support_ticket_reads enable row level security;

drop policy if exists support_ticket_reads_deny_browser_access on public.support_ticket_reads;
create policy support_ticket_reads_deny_browser_access
on public.support_ticket_reads
as restrictive
for all
to authenticated
using (false)
with check (false);

revoke all on table public.support_ticket_reads from public, anon, authenticated;
grant select, insert, update, delete on table public.support_ticket_reads to service_role;

create or replace function private.touch_support_ticket_from_message()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  update public.support_tickets
  set
    updated_at = greatest(updated_at, new.created_at),
    last_message_at = new.created_at,
    last_user_message_at = case
      when new.author_type = 'user' then new.created_at
      else last_user_message_at
    end,
    last_support_message_at = case
      when new.author_type = 'support' then new.created_at
      else last_support_message_at
    end
  where id = new.ticket_id
    and organization_id = new.organization_id;

  return new;
end;
$$;

drop trigger if exists support_messages_touch_ticket on public.support_messages;
create trigger support_messages_touch_ticket
after insert on public.support_messages
for each row execute function private.touch_support_ticket_from_message();

create or replace function public.mark_support_ticket_read_server(
  target_actor_id uuid,
  target_organization_id uuid,
  target_ticket_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  allowed boolean;
begin
  select exists (
    select 1
    from public.support_tickets t
    where t.id = target_ticket_id
      and t.organization_id = target_organization_id
      and (
        t.created_by = target_actor_id
        or exists (
          select 1
          from public.organization_members m
          where m.organization_id = t.organization_id
            and m.user_id = target_actor_id
            and m.role in ('owner','admin')
        )
      )
  ) into allowed;

  if not allowed then
    raise exception 'Not authorized';
  end if;

  insert into public.support_ticket_reads(
    ticket_id,
    organization_id,
    user_id,
    last_read_at
  )
  values (
    target_ticket_id,
    target_organization_id,
    target_actor_id,
    now()
  )
  on conflict (ticket_id, user_id)
  do update set
    organization_id = excluded.organization_id,
    last_read_at = excluded.last_read_at;

  return true;
end;
$$;

revoke all on function public.mark_support_ticket_read_server(uuid,uuid,uuid) from public, anon, authenticated;
grant execute on function public.mark_support_ticket_read_server(uuid,uuid,uuid) to service_role;

create or replace function public.append_support_user_message_server(
  target_actor_id uuid,
  target_organization_id uuid,
  target_ticket_id uuid,
  target_message text
)
returns table (
  message_id uuid,
  ticket_status text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  clean_message text := trim(coalesce(target_message, ''));
  current_status text;
  created_message_id uuid;
  next_status text;
begin
  if char_length(clean_message) < 1 or char_length(clean_message) > 5000 then
    raise exception 'Support message must be between 1 and 5000 characters';
  end if;

  select t.status
  into current_status
  from public.support_tickets t
  where t.id = target_ticket_id
    and t.organization_id = target_organization_id
    and (
      t.created_by = target_actor_id
      or exists (
        select 1
        from public.organization_members m
        where m.organization_id = t.organization_id
          and m.user_id = target_actor_id
          and m.role in ('owner','admin')
      )
    )
  for update;

  if current_status is null then
    raise exception 'Not authorized';
  end if;

  next_status := case
    when current_status in ('waiting_customer','resolved') then 'in_progress'
    else current_status
  end;

  insert into public.support_messages(
    ticket_id,
    organization_id,
    author_user_id,
    author_type,
    body
  )
  values (
    target_ticket_id,
    target_organization_id,
    target_actor_id,
    'user',
    clean_message
  )
  returning id into created_message_id;

  update public.support_tickets
  set
    status = next_status,
    resolved_at = case when next_status = 'resolved' then resolved_at else null end,
    updated_at = now()
  where id = target_ticket_id;

  insert into public.support_events(
    ticket_id,
    organization_id,
    actor_user_id,
    event_type,
    metadata
  )
  values (
    target_ticket_id,
    target_organization_id,
    target_actor_id,
    'customer_message_added',
    jsonb_build_object(
      'message_id', created_message_id,
      'previous_status', current_status,
      'status', next_status
    )
  );

  return query select created_message_id, next_status;
end;
$$;

revoke all on function public.append_support_user_message_server(uuid,uuid,uuid,text) from public, anon, authenticated;
grant execute on function public.append_support_user_message_server(uuid,uuid,uuid,text) to service_role;

create or replace function public.append_support_operator_message_server(
  target_operator_id uuid,
  target_ticket_id uuid,
  target_message text,
  target_status text default 'waiting_customer'
)
returns table (
  message_id uuid,
  ticket_status text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  clean_message text := trim(coalesce(target_message, ''));
  clean_status text := lower(trim(coalesce(target_status, 'waiting_customer')));
  target_org_id uuid;
  previous_status text;
  created_message_id uuid;
begin
  if clean_status not in ('new','in_progress','waiting_customer','resolved') then
    raise exception 'Invalid support status';
  end if;

  if char_length(clean_message) < 1 or char_length(clean_message) > 5000 then
    raise exception 'Support message must be between 1 and 5000 characters';
  end if;

  select t.organization_id, t.status
  into target_org_id, previous_status
  from public.support_tickets t
  where t.id = target_ticket_id
  for update;

  if target_org_id is null then
    raise exception 'Support ticket not found';
  end if;

  insert into public.support_messages(
    ticket_id,
    organization_id,
    author_user_id,
    author_type,
    body
  )
  values (
    target_ticket_id,
    target_org_id,
    target_operator_id,
    'support',
    clean_message
  )
  returning id into created_message_id;

  update public.support_tickets
  set
    status = clean_status,
    resolved_at = case when clean_status = 'resolved' then now() else null end,
    updated_at = now()
  where id = target_ticket_id;

  insert into public.support_events(
    ticket_id,
    organization_id,
    actor_user_id,
    event_type,
    metadata
  )
  values (
    target_ticket_id,
    target_org_id,
    target_operator_id,
    'support_message_added',
    jsonb_build_object(
      'message_id', created_message_id,
      'previous_status', previous_status,
      'status', clean_status
    )
  );

  return query select created_message_id, clean_status;
end;
$$;

revoke all on function public.append_support_operator_message_server(uuid,uuid,text,text) from public, anon, authenticated;
grant execute on function public.append_support_operator_message_server(uuid,uuid,text,text) to service_role;

create or replace function public.update_support_ticket_operator_server(
  target_operator_id uuid,
  target_ticket_id uuid,
  target_status text,
  target_priority text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  clean_status text := lower(trim(coalesce(target_status, '')));
  clean_priority text := lower(trim(coalesce(target_priority, '')));
  target_org_id uuid;
  previous_status text;
  previous_priority text;
begin
  if clean_status not in ('new','in_progress','waiting_customer','resolved') then
    raise exception 'Invalid support status';
  end if;

  if clean_priority not in ('low','normal','high') then
    raise exception 'Invalid support priority';
  end if;

  select organization_id, status, priority
  into target_org_id, previous_status, previous_priority
  from public.support_tickets
  where id = target_ticket_id
  for update;

  if target_org_id is null then
    raise exception 'Support ticket not found';
  end if;

  update public.support_tickets
  set
    status = clean_status,
    priority = clean_priority,
    resolved_at = case
      when clean_status = 'resolved' then coalesce(resolved_at, now())
      else null
    end,
    updated_at = now()
  where id = target_ticket_id;

  insert into public.support_events(
    ticket_id,
    organization_id,
    actor_user_id,
    event_type,
    metadata
  )
  values (
    target_ticket_id,
    target_org_id,
    target_operator_id,
    'ticket_updated',
    jsonb_build_object(
      'previous_status', previous_status,
      'status', clean_status,
      'previous_priority', previous_priority,
      'priority', clean_priority
    )
  );

  return true;
end;
$$;

revoke all on function public.update_support_ticket_operator_server(uuid,uuid,text,text) from public, anon, authenticated;
grant execute on function public.update_support_ticket_operator_server(uuid,uuid,text,text) to service_role;

comment on table public.support_ticket_reads is
  'Per-user read cursor for in-app support ticket unread indicators.';
comment on function public.append_support_user_message_server(uuid,uuid,uuid,text) is
  'Service-role-only customer support reply boundary with workspace visibility checks.';
comment on function public.append_support_operator_message_server(uuid,uuid,text,text) is
  'Service-role-only operator reply boundary. Operator authorization is enforced by the trusted application server.';
