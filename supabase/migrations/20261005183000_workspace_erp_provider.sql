-- ERP-A1: persist one ERP provider choice per workspace.
-- Existing workspaces that already have Business Central mappings or delivery
-- attempts retain Business Central. Other and future workspaces start without
-- an ERP integration.

alter table public.organizations
  add column if not exists erp_provider text;

update public.organizations o
set erp_provider = 'business_central'
where o.erp_provider is null
  and (
    exists (
      select 1
      from public.erp_entity_mappings m
      where m.organization_id = o.id
        and m.provider = 'business_central'
    )
    or exists (
      select 1
      from public.erp_delivery_attempts a
      where a.organization_id = o.id
        and a.provider = 'business_central'
    )
  );

update public.organizations
set erp_provider = 'none'
where erp_provider is null;

alter table public.organizations
  drop constraint if exists organizations_erp_provider_check;

alter table public.organizations
  add constraint organizations_erp_provider_check
  check (erp_provider in ('business_central', 'custom', 'none'));

alter table public.organizations
  alter column erp_provider set default 'none',
  alter column erp_provider set not null;

comment on column public.organizations.erp_provider is
  'Workspace ERP selection. business_central uses the native BC adapter; custom means another ERP is desired but not yet natively connected; none disables ERP export UI.';
