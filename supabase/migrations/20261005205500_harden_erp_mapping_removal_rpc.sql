-- ERP-A4 hardening: mapping removal does not need SECURITY DEFINER.
-- Authenticated owner/admin users already have RLS-guarded delete access to
-- erp_entity_mappings, and activity logging is handled by its own audited helper.

alter function public.remove_erp_entity_mapping(text,text,uuid)
  security invoker;

alter function public.remove_erp_entity_mapping(text,uuid)
  security invoker;
