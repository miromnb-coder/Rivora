-- ERP-B0: capture the name of an unsupported customer ERP without
-- pretending that it is a native provider.
alter table public.organizations
  add column if not exists erp_requested_name text;

alter table public.organizations
  drop constraint if exists organizations_erp_requested_name_length_check;

alter table public.organizations
  add constraint organizations_erp_requested_name_length_check
  check (
    erp_requested_name is null
    or char_length(erp_requested_name) between 1 and 120
  );

comment on column public.organizations.erp_requested_name is
  'Human-readable ERP name when erp_provider=custom. This does not enable a native connection or automatic export.';
