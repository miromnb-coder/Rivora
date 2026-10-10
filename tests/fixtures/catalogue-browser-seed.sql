insert into auth.users(id,email) values ('10000000-0000-0000-0000-000000000001','test1@synthetic.invalid'),('10000000-0000-0000-0000-000000000002','test2@synthetic.invalid'),('10000000-0000-0000-0000-000000000003','test3@synthetic.invalid');
insert into public.organizations(id,name) values ('20000000-0000-0000-0000-000000000001','Synthetic A'),('20000000-0000-0000-0000-000000000002','Synthetic B');
insert into public.organization_members(organization_id,user_id,role) values
 ('20000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','owner'),
 ('20000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000002','admin'),
 ('20000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000003','member');
create function public.can_manage_workspace_feature(target_feature text) returns boolean language sql as $$ select false $$;
grant execute on function public.can_manage_workspace_feature(text) to authenticated;

alter table public.organizations add column erp_provider text default 'none', add column erp_requested_name text;
notify pgrst, 'reload schema';
