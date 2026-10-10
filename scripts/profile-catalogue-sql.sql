-- Synthetic local-only SQL profile, transaction rolls back all 25 000 rows.
\timing on
begin;
insert into auth.users(id,email) values('10000000-0000-0000-0000-000000000098','profile@synthetic.invalid');
insert into public.organizations(id,name) values('20000000-0000-0000-0000-000000000098','Synthetic profile');
insert into public.organization_members(organization_id,user_id,role) values('20000000-0000-0000-0000-000000000098','10000000-0000-0000-0000-000000000098','owner');
select set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000098',true);
set local role authenticated;
select (public.prepare_catalogue_import('20000000-0000-0000-0000-000000000098','50000000-0000-0000-0000-000000000098',
 (select jsonb_agg(jsonb_build_object('sku','SYN-'||i,'name','Synthetic '||i,'unit_price',12.34,'stock_quantity_provided',false)) from generate_series(1,25000) i),'merge',repeat('a',64))->'summary') - 'changes';
select public.commit_catalogue_import('20000000-0000-0000-0000-000000000098','50000000-0000-0000-0000-000000000098',false);
select count(*)=25000 as all_rows_committed from public.products where organization_id='20000000-0000-0000-0000-000000000098';
rollback;
