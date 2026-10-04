create or replace function public.remove_erp_entity_mapping(
  target_entity_type text,
  target_local_entity_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_org uuid;
  old_mapping jsonb;
begin
  select organization_id,
         jsonb_build_object(
           'provider', provider,
           'entity_type', entity_type,
           'local_entity_id', local_entity_id,
           'external_id', external_id,
           'external_number', external_number,
           'metadata', metadata
         )
  into target_org, old_mapping
  from public.erp_entity_mappings
  where provider = 'business_central'
    and entity_type = target_entity_type
    and local_entity_id = target_local_entity_id
  limit 1;

  if target_org is null then
    return;
  end if;

  if not private.has_org_role(target_org, array['owner','admin']) then
    raise exception 'Owner or admin access is required.';
  end if;

  delete from public.erp_entity_mappings
  where organization_id = target_org
    and provider = 'business_central'
    and entity_type = target_entity_type
    and local_entity_id = target_local_entity_id;

  perform private.write_activity_event(
    target_org,
    target_entity_type,
    target_local_entity_id,
    'business_central_mapping_removed',
    jsonb_build_object('previous_mapping', old_mapping),
    auth.uid()
  );
end;
$$;

revoke all on function public.remove_erp_entity_mapping(text,uuid) from public;
revoke all on function public.remove_erp_entity_mapping(text,uuid) from anon;
grant execute on function public.remove_erp_entity_mapping(text,uuid) to authenticated;
grant execute on function public.remove_erp_entity_mapping(text,uuid) to service_role;
