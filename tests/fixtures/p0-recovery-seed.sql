-- Synthetic recovery canary, never execute in a hosted project.
begin;
insert into auth.users(id,email) values
 ('10000000-0000-0000-0000-000000000099','recovery@synthetic.invalid');
insert into public.organizations(id,name) values
 ('20000000-0000-0000-0000-000000000099','Synthetic recovery');
insert into public.organization_members(organization_id,user_id,role) values
 ('20000000-0000-0000-0000-000000000099','10000000-0000-0000-0000-000000000099','owner');
insert into public.products(id,organization_id,sku,name,unit_price) values
 ('30000000-0000-0000-0000-000000000099','20000000-0000-0000-0000-000000000099','RECOVERY-1','Synthetic recovery',123.45);
set local request.jwt.claim.sub='10000000-0000-0000-0000-000000000099';
set local role authenticated;
select public.prepare_catalogue_import('20000000-0000-0000-0000-000000000099','50000000-0000-0000-0000-000000000099',
 '[{"sku":"RECOVERY-1","name":"Synthetic recovery","unit_price":123.45,"stock_quantity_provided":false}]','merge',repeat('e',64));
select public.commit_catalogue_import('20000000-0000-0000-0000-000000000099','50000000-0000-0000-0000-000000000099',false);
commit;
