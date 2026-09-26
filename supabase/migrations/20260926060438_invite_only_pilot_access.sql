create table if not exists public.pilot_access_invites (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid references public.marketing_leads(id) on delete set null,
  email text not null,
  company_name text,
  approved_by uuid references auth.users(id) on delete set null,
  approved_at timestamptz not null default now(),
  invite_sent_at timestamptz,
  invite_error text,
  accepted_by uuid references auth.users(id) on delete set null,
  accepted_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint pilot_access_invites_email_not_blank check (char_length(trim(email)) > 3)
);

create unique index if not exists pilot_access_invites_email_lower_uidx
  on public.pilot_access_invites (lower(email))
  where revoked_at is null;

alter table public.pilot_access_invites enable row level security;

drop policy if exists "pilot invites self read" on public.pilot_access_invites;
create policy "pilot invites self read"
on public.pilot_access_invites
for select
to authenticated
using (
  revoked_at is null
  and lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
);

drop policy if exists "pilot invites sales admin read" on public.pilot_access_invites;
create policy "pilot invites sales admin read"
on public.pilot_access_invites
for select
to authenticated
using (
  exists (
    select 1
    from public.organization_members om
    where om.user_id = (select auth.uid())
      and om.role in ('owner','admin')
  )
);

drop policy if exists "pilot invites sales admin insert" on public.pilot_access_invites;
create policy "pilot invites sales admin insert"
on public.pilot_access_invites
for insert
to authenticated
with check (
  approved_by = (select auth.uid())
  and exists (
    select 1
    from public.organization_members om
    where om.user_id = (select auth.uid())
      and om.role in ('owner','admin')
  )
);

drop policy if exists "pilot invites sales admin update" on public.pilot_access_invites;
create policy "pilot invites sales admin update"
on public.pilot_access_invites
for update
to authenticated
using (
  exists (
    select 1
    from public.organization_members om
    where om.user_id = (select auth.uid())
      and om.role in ('owner','admin')
  )
)
with check (
  exists (
    select 1
    from public.organization_members om
    where om.user_id = (select auth.uid())
      and om.role in ('owner','admin')
  )
);

grant select, insert, update on public.pilot_access_invites to authenticated;
revoke all on public.pilot_access_invites from anon;

create or replace function private.bootstrap_rivora_workspace_impl(workspace_name text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $function$
declare
  uid uuid := (select auth.uid());
  user_email text := lower(coalesce(auth.jwt() ->> 'email', ''));
  existing_org uuid;
  invite_id uuid;
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

  if user_email = '' then
    raise exception 'Verified email is required';
  end if;

  select id into invite_id
  from public.pilot_access_invites
  where lower(email) = user_email
    and revoked_at is null
    and (accepted_at is null or accepted_by = uid)
  order by approved_at desc
  limit 1
  for update;

  if invite_id is null then
    raise exception 'Pilot invitation required';
  end if;

  insert into public.organizations(name)
  values (clean_name)
  returning id into new_org;

  insert into public.organization_members(organization_id, user_id, role)
  values (new_org, uid, 'owner');

  update public.pilot_access_invites
  set accepted_by = uid,
      accepted_at = coalesce(accepted_at, now()),
      updated_at = now()
  where id = invite_id;

  return new_org;
end;
$function$;
