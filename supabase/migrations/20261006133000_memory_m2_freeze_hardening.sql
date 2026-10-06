-- M2 freeze hardening
--
-- Follow-up for Product Memory after production smoke and PR review.
-- Keeps previously valid match methods compatible, preserves an explicit actor
-- for legacy Customer Memory delete audit events, and adds the covering index
-- expected by the database performance advisor.

create index if not exists workspace_memory_entries_customer_id_idx
  on public.workspace_memory_entries(customer_id);


alter table public.product_match_candidates
  drop constraint if exists product_match_candidates_method_check;

alter table public.product_match_candidates
  add constraint product_match_candidates_method_check
  check (
    method in (
      'product_memory',
      'customer_memory',
      'exact_sku',
      'exact_mpn',
      'fuzzy',
      'catalogue',
      'ai_suggestion'
    )
  );

alter table public.rfq_lines
  drop constraint if exists rfq_lines_match_method_check;

alter table public.rfq_lines
  add constraint rfq_lines_match_method_check
  check (
    match_method is null
    or match_method in (
      'product_memory',
      'customer_memory',
      'exact_sku',
      'exact_mpn',
      'fuzzy',
      'catalogue',
      'ai_suggestion',
      'manual'
    )
  );


create or replace function private.audit_customer_memory()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op='INSERT' then
    perform private.write_activity_event(
      new.organization_id,'customer_memory',new.id,'customer_memory_created',
      jsonb_build_object(
        'customer_id',new.customer_id,
        'customer_sku',new.customer_sku,
        'product_id',new.product_id
      ),
      new.confirmed_by_user_id
    );
    return new;
  elsif tg_op='UPDATE' then
    if old.product_id is distinct from new.product_id then
      perform private.write_activity_event(
        new.organization_id,'customer_memory',new.id,'customer_memory_changed',
        jsonb_build_object(
          'customer_id',new.customer_id,
          'customer_sku',new.customer_sku,
          'old_product_id',old.product_id,
          'new_product_id',new.product_id
        ),
        coalesce(new.confirmed_by_user_id,(select auth.uid()))
      );
    end if;
    return new;
  else
    perform private.write_activity_event(
      old.organization_id,'customer_memory',old.id,'customer_memory_deleted',
      jsonb_build_object(
        'customer_id',old.customer_id,
        'customer_sku',old.customer_sku,
        'product_id',old.product_id
      ),
      coalesce((select auth.uid()), old.confirmed_by_user_id)
    );
    return old;
  end if;
end;
$$;


create or replace function public.disable_customer_product_memory_server(
  target_mapping_id uuid,
  target_actor_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  mapping_row public.customer_product_mappings;
  normalized_alias text;
begin
  if target_actor_id is null then
    raise exception 'Actor is required';
  end if;

  select m.*
  into mapping_row
  from public.customer_product_mappings m
  where m.id = target_mapping_id
  for update;

  if mapping_row.id is null then
    raise exception 'Customer Memory mapping not found';
  end if;

  if not exists (
    select 1
    from public.organization_members om
    where om.organization_id = mapping_row.organization_id
      and om.user_id = target_actor_id
      and om.role in ('owner','admin')
  ) then
    raise exception 'Owner or admin access is required';
  end if;

  normalized_alias := private.normalize_memory_key(mapping_row.customer_sku);

  update public.workspace_memory_entries
  set verification_state = 'disabled',
      updated_by = target_actor_id,
      updated_at = now()
  where organization_id = mapping_row.organization_id
    and scope = 'customer'
    and customer_id = mapping_row.customer_id
    and memory_type = 'customer_sku_product'
    and source_key = normalized_alias;

  -- The legacy audit trigger runs under service role for this RPC. Stamp the
  -- validated actor onto the row immediately before DELETE so the trigger can
  -- preserve who performed the removal without relying on auth.uid().
  update public.customer_product_mappings
  set confirmed_by_user_id = target_actor_id,
      updated_at = now()
  where id = mapping_row.id;

  delete from public.customer_product_mappings
  where id = mapping_row.id;
end;
$$;

revoke all on function public.disable_customer_product_memory_server(uuid,uuid) from public;
revoke all on function public.disable_customer_product_memory_server(uuid,uuid) from anon;
revoke all on function public.disable_customer_product_memory_server(uuid,uuid) from authenticated;
grant execute on function public.disable_customer_product_memory_server(uuid,uuid) to service_role;
