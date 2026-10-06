-- ERP-A5 hardening: make browser denial explicit for the security linter.
--
-- Direct table grants are already revoked. This deny policy is defense in
-- depth and documents that browser sessions must never read ERP connection
-- metadata or Vault secret references directly.

drop policy if exists erp_connections_deny_browser_access on public.erp_connections;

create policy erp_connections_deny_browser_access
on public.erp_connections
as restrictive
for all
to authenticated
using (false)
with check (false);

revoke all on table public.erp_connections from anon;
revoke all on table public.erp_connections from authenticated;
grant select, insert, update, delete on table public.erp_connections to service_role;
