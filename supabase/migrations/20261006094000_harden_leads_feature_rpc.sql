-- SEC-L1 hardening: keep the feature-check RPC invoker-safe.
--
-- The feature flag itself is non-secret. Authenticated users may read only
-- feature rows for organizations they belong to; no browser role can mutate
-- feature flags. This lets the public RPC run as SECURITY INVOKER and avoids
-- exposing a SECURITY DEFINER RPC through PostgREST.

drop policy if exists organization_features_deny_browser_access
  on public.organization_features;

drop policy if exists organization_features_member_read
  on public.organization_features;

create policy organization_features_member_read
on public.organization_features
for select
to authenticated
using (
  exists (
    select 1
    from public.organization_members m
    where m.organization_id = organization_features.organization_id
      and m.user_id = (select auth.uid())
  )
);

revoke all on table public.organization_features from anon;
revoke all on table public.organization_features from authenticated;
grant select on table public.organization_features to authenticated;
grant select, insert, update, delete on table public.organization_features to service_role;

create or replace function public.can_manage_workspace_feature(
  target_feature text
)
returns boolean
language sql
stable
security invoker
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
