-- SEC-L1: harden Leads access behind an explicit workspace feature.
--
-- Leads are an internal sales capability, not a generic owner/admin capability.
-- Access now requires BOTH:
--   1) owner/admin membership
--   2) organization_features(feature_key='leads', enabled=true)
--
-- No workspace is enabled by this migration. Production enablement is applied
-- explicitly after deploy so similarly named workspaces cannot inherit access.

create table if not exists public.organization_features (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  feature_key text not null,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (organization_id, feature_key),
  constraint organization_features_key_check
    check (feature_key ~ '^[a-z][a-z0-9_]{0,63}$')
);

alter table public.organization_features enable row level security;

drop policy if exists organization_features_deny_browser_access
  on public.organization_features;

create policy organization_features_deny_browser_access
on public.organization_features
as restrictive
for all
to authenticated
using (false)
with check (false);

revoke all on table public.organization_features from anon;
revoke all on table public.organization_features from authenticated;
grant select, insert, update, delete on table public.organization_features to service_role;

comment on table public.organization_features is
  'Explicit workspace capabilities. Leads access must never be inferred from workspace name.';


create or replace function public.can_manage_workspace_feature(
  target_feature text
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.organization_members m
    join public.organization_features f
      on f.organization_id = m.organization_id
    where m.user_id = (select auth.uid())
      and m.role in ('owner', 'admin')
      and f.feature_key = lower(trim(coalesce(target_feature, '')))
      and f.enabled = true
  )
$$;

revoke all on function public.can_manage_workspace_feature(text) from public;
revoke all on function public.can_manage_workspace_feature(text) from anon;
grant execute on function public.can_manage_workspace_feature(text) to authenticated;
grant execute on function public.can_manage_workspace_feature(text) to service_role;


drop policy if exists marketing_leads_owner_admin_select on public.marketing_leads;
drop policy if exists marketing_leads_owner_admin_update on public.marketing_leads;

create policy marketing_leads_feature_admin_select
on public.marketing_leads
for select
to authenticated
using (public.can_manage_workspace_feature('leads'));

create policy marketing_leads_feature_admin_update
on public.marketing_leads
for update
to authenticated
using (public.can_manage_workspace_feature('leads'))
with check (
  public.can_manage_workspace_feature('leads')
  and status = any (array['new'::text, 'contacted'::text, 'qualified'::text, 'closed'::text])
);

-- Preserve public lead capture, but remove unnecessary table privileges.
revoke all on table public.marketing_leads from anon;
revoke all on table public.marketing_leads from authenticated;
grant insert on table public.marketing_leads to anon;
grant insert, select, update on table public.marketing_leads to authenticated;


drop policy if exists "pilot invites sales admin insert" on public.pilot_access_invites;
drop policy if exists "pilot invites sales admin read" on public.pilot_access_invites;
drop policy if exists "pilot invites sales admin update" on public.pilot_access_invites;

create policy "pilot invites feature admin insert"
on public.pilot_access_invites
for insert
to authenticated
with check (
  approved_by = (select auth.uid())
  and public.can_manage_workspace_feature('leads')
);

create policy "pilot invites feature admin read"
on public.pilot_access_invites
for select
to authenticated
using (public.can_manage_workspace_feature('leads'));

create policy "pilot invites feature admin update"
on public.pilot_access_invites
for update
to authenticated
using (public.can_manage_workspace_feature('leads'))
with check (public.can_manage_workspace_feature('leads'));

-- Keep the existing self-read policy for invite recipients. Remove destructive
-- browser privileges that are not used by the product.
revoke all on table public.pilot_access_invites from authenticated;
grant select, insert, update on table public.pilot_access_invites to authenticated;
