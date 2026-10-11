-- Transaction is intentionally rolled back when the migration's preflight rejects it.
begin;
insert into public.organizations(id,name) values('20000000-0000-0000-0000-000000000099','Synthetic conflict fixture');
drop index public.products_org_sku_identity;
insert into public.products(organization_id,sku,name) values
 ('20000000-0000-0000-0000-000000000099','ABC-1','one'),('20000000-0000-0000-0000-000000000099','abc-1','two');
