-- Synthetic data only; run via scripts/test-catalogue-sql.sh in the local Docker cluster.
begin;
create function pg_temp.assert_true(ok boolean, label text) returns void language plpgsql as $$ begin
  if ok is distinct from true then raise exception 'FAIL: %',label; end if;
  raise notice 'PASS: %',label;
end $$;
create function pg_temp.expect_error(command text, expected text) returns void language plpgsql as $$ begin
  begin execute command; exception when others then
    if position(expected in sqlerrm)>0 then raise notice 'PASS: rejects %',expected; return; end if;
    raise;
  end;
  raise exception 'FAIL: expected %',expected;
end $$;
insert into auth.users(id,email) values
 ('10000000-0000-0000-0000-000000000001','owner-a@synthetic.invalid'),
 ('10000000-0000-0000-0000-000000000002','owner-b@synthetic.invalid'),
 ('10000000-0000-0000-0000-000000000003','member@synthetic.invalid');
insert into public.organizations(id,name,email,address_line1,city) values
 ('20000000-0000-0000-0000-000000000001','Synthetic A','a@synthetic.invalid','Test 1','Test'),
 ('20000000-0000-0000-0000-000000000002','Synthetic B','b@synthetic.invalid','Test 2','Test');
insert into public.organization_members(organization_id,user_id,role) values
 ('20000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','owner'),
 ('20000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000002','admin'),
 ('20000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000003','member');
insert into public.products(id,organization_id,sku,name,unit_price,stock_quantity) values
 ('30000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001','ABC-1','Old',10,7),
 ('30000000-0000-0000-0000-000000000002','20000000-0000-0000-0000-000000000001','KEEP','Retain',20,8),
 ('30000000-0000-0000-0000-000000000003','20000000-0000-0000-0000-000000000002','ABC-1','Other tenant',100,99);
insert into public.customers(id,organization_id,name) values ('40000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001','Synthetic customer');
insert into public.customer_product_mappings(organization_id,customer_id,customer_sku,product_id)
 values('20000000-0000-0000-0000-000000000001','40000000-0000-0000-0000-000000000001','Customer item','30000000-0000-0000-0000-000000000001');
select set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000001',true);
set local role authenticated;
select pg_temp.expect_error($q$select public.prepare_catalogue_import('20000000-0000-0000-0000-000000000001',gen_random_uuid(),'[{"sku":"Bad","name":"Bad","unit_price":"abc","stock_quantity_provided":false}]','merge',repeat('a',64))$q$,'CATALOGUE_INVALID_ROW');
select pg_temp.expect_error($q$select public.prepare_catalogue_import('20000000-0000-0000-0000-000000000001',gen_random_uuid(),'[{"sku":"Bad","name":"Bad","unit_price":-1,"stock_quantity_provided":false}]','merge',repeat('a',64))$q$,'CATALOGUE_INVALID_NUMBER');
select pg_temp.expect_error($q$select public.prepare_catalogue_import('20000000-0000-0000-0000-000000000001',gen_random_uuid(),'[{"sku":"Bad","name":"Bad","unit_price":0.12345,"stock_quantity_provided":false}]','merge',repeat('a',64))$q$,'CATALOGUE_INVALID_NUMBER');
select pg_temp.expect_error($q$select public.prepare_catalogue_import('20000000-0000-0000-0000-000000000001',gen_random_uuid(),'[{"sku":"Bad","name":"Bad","unit_price":10000000000,"stock_quantity_provided":false}]','merge',repeat('a',64))$q$,'CATALOGUE_INVALID_NUMBER');
select pg_temp.expect_error($q$select public.prepare_catalogue_import('20000000-0000-0000-0000-000000000001',gen_random_uuid(),'[{"sku":"DUP","name":"1","stock_quantity_provided":false},{"sku":"dup","name":"2","stock_quantity_provided":false}]','merge',repeat('a',64))$q$,'CATALOGUE_DUPLICATE_SKU');
select pg_temp.expect_error($q$select public.prepare_catalogue_import('20000000-0000-0000-0000-000000000002',gen_random_uuid(),'[{"sku":"X","name":"x","stock_quantity_provided":false}]','merge',repeat('a',64))$q$,'CATALOGUE_FORBIDDEN');
select pg_temp.expect_error($q$select public.import_catalogue_rows('20000000-0000-0000-0000-000000000001','[{"sku":"X","name":"x"}]')$q$,'CATALOGUE_PREVIEW_REQUIRED');
select pg_temp.assert_true((select count(*)=2 from public.products),'RLS isolates products and invalid input leaves catalogue intact');

-- Case-only SKU update; preserve omitted stock, IDs, display SKU and mappings.
do $$ declare prepared jsonb; result jsonb; begin
  prepared := public.prepare_catalogue_import('20000000-0000-0000-0000-000000000001','50000000-0000-0000-0000-000000000001',
   '[{"sku":"abc-1","name":"Updated","unit_price":0,"stock_quantity_provided":false},{"sku":"NEW","name":"New","unit_price":null,"stock_quantity_provided":false}]','merge',repeat('a',64));
  perform pg_temp.assert_true(prepared->'summary'->>'created'='1' and prepared->'summary'->>'updated'='1' and prepared->'summary'->>'deactivated'='0','merge preview counts');
  perform pg_temp.assert_true((select name='Old' from public.products where sku='ABC-1'),'preview is read-only for catalogue');
  result := public.commit_catalogue_import('20000000-0000-0000-0000-000000000001','50000000-0000-0000-0000-000000000001',false);
  perform pg_temp.assert_true(result=public.commit_catalogue_import('20000000-0000-0000-0000-000000000001','50000000-0000-0000-0000-000000000001',false),'duplicate commit returns same result');
  perform pg_temp.assert_true((select id='30000000-0000-0000-0000-000000000001' and sku='ABC-1' and name='Updated' and unit_price=0 and stock_quantity=7 from public.products where sku='ABC-1'),'case identity preserves ID, display SKU, stock and zero');
  perform pg_temp.assert_true((select active from public.products where sku='KEEP'),'merge does not deactivate omitted products');
  perform pg_temp.assert_true((select unit_price is null from public.products where sku='NEW'),'missing price stays null');
  perform pg_temp.assert_true((select product_id='30000000-0000-0000-0000-000000000001' from public.customer_product_mappings),'old mapping reference survives');
  perform pg_temp.assert_true((select count(*)=1 from public.activity_events where entity_id='50000000-0000-0000-0000-000000000001' and metadata->>'file_hash'=repeat('a',64) and metadata->>'mode'='merge'),'audit exactly once with file hash and mode');
end $$;
select pg_temp.expect_error($q$insert into public.products(organization_id,sku,name) values('20000000-0000-0000-0000-000000000001','AbC-1','duplicate')$q$,'products_org_sku_identity');

-- Approved quote snapshots must survive later catalogue replacement/deactivation.
insert into public.quotes(id,organization_id,customer_id,quote_number,status,currency,valid_until,tax_rate,created_by)
values('60000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001','40000000-0000-0000-0000-000000000001','SYNTHETIC-Q','draft','EUR',current_date+14,25.5,auth.uid());
insert into public.quote_lines(id,organization_id,quote_id,line_number,product_id,quantity,unit,unit_price,catalogue_unit_price,discount_percent,line_total,sku_snapshot,description_snapshot)
values('70000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001','60000000-0000-0000-0000-000000000001',1,'30000000-0000-0000-0000-000000000002',2,'pcs',20,20,10,36,'KEEP','Retain');
update public.quotes set status='ready' where id='60000000-0000-0000-0000-000000000001';
update public.quotes set status='approved',approved_by=auth.uid(),approved_at=now() where id='60000000-0000-0000-0000-000000000001';
select pg_temp.expect_error($q$update public.quote_lines set unit_price=1 where id='70000000-0000-0000-0000-000000000001'$q$,'Approved or sent quote lines are locked');
select pg_temp.expect_error($q$update public.quotes set notes='tamper' where id='60000000-0000-0000-0000-000000000001'$q$,'commercial fields are locked');

select pg_temp.assert_true(public.catalogue_sku_keys(array['ÄBC-1','äbc-1'])=array['äbc-1','äbc-1'],'Unicode diagnostics use database SKU identity');
select pg_temp.expect_error($q$select public.prepare_catalogue_import('20000000-0000-0000-0000-000000000001',gen_random_uuid(),'[{"sku":"ÄBC-1","name":"1","stock_quantity_provided":false},{"sku":"äbc-1","name":"2","stock_quantity_provided":false}]','merge',repeat('a',64))$q$,'CATALOGUE_DUPLICATE_SKU');

-- Matching unchanged projection and explicit replacement.
do $$ declare p jsonb; begin
 p := public.prepare_catalogue_import('20000000-0000-0000-0000-000000000001','50000000-0000-0000-0000-000000000002',
  '[{"sku":"abc-1","name":"Updated","unit_price":0,"stock_quantity_provided":false}]','replace',repeat('b',64));
 perform pg_temp.assert_true(p->'summary'->>'unchanged'='1' and p->'summary'->>'deactivated'='2','replace previews unchanged and omitted products');
end $$;
select pg_temp.expect_error($q$select public.commit_catalogue_import('20000000-0000-0000-0000-000000000001','50000000-0000-0000-0000-000000000002',false)$q$,'CATALOGUE_REPLACE_CONFIRMATION_REQUIRED');
select pg_temp.assert_true((public.commit_catalogue_import('20000000-0000-0000-0000-000000000001','50000000-0000-0000-0000-000000000002',true)->>'deactivated')='2','explicit replacement deactivates exactly previewed products');

select pg_temp.assert_true((select product_id='30000000-0000-0000-0000-000000000002' and unit_price=20 and catalogue_unit_price=20 and discount_percent=10 and sku_snapshot='KEEP' and description_snapshot='Retain' from public.quote_lines where id='70000000-0000-0000-0000-000000000001'),'deactivation preserves approved commercial snapshots and discounts');
insert into public.quotes(id,organization_id,customer_id,quote_number,status,currency,valid_until,tax_rate,created_by)
values('60000000-0000-0000-0000-000000000002','20000000-0000-0000-0000-000000000001','40000000-0000-0000-0000-000000000001','SYNTHETIC-DRAFT','draft','EUR',current_date+14,25.5,auth.uid());
select pg_temp.expect_error($q$insert into public.quote_lines(organization_id,quote_id,line_number,product_id,quantity,unit,unit_price,catalogue_unit_price)
values('20000000-0000-0000-0000-000000000001','60000000-0000-0000-0000-000000000002',1,'30000000-0000-0000-0000-000000000002',1,'pcs',20,20)$q$,'inactive');

-- Stale revisions, changed payload under same ID, actor binding and expiry.
select public.prepare_catalogue_import('20000000-0000-0000-0000-000000000001','50000000-0000-0000-0000-000000000003','[{"sku":"abc-1","name":"Updated","unit_price":0,"stock_quantity_provided":false}]','merge',repeat('c',64)) is not null;
update public.products set name='Concurrent edit' where sku='ABC-1';
select pg_temp.expect_error($q$select public.commit_catalogue_import('20000000-0000-0000-0000-000000000001','50000000-0000-0000-0000-000000000003',false)$q$,'CATALOGUE_PREVIEW_STALE');
select pg_temp.expect_error($q$select public.prepare_catalogue_import('20000000-0000-0000-0000-000000000001','50000000-0000-0000-0000-000000000003','[{"sku":"OTHER","name":"changed","stock_quantity_provided":false}]','merge',repeat('c',64))$q$,'CATALOGUE_IDEMPOTENCY_CONFLICT');
select pg_temp.expect_error($q$select * from private.catalogue_imports$q$,'permission denied');
insert into public.catalogue_field_maps(organization_id,name,format,headers,mapping) values('20000000-0000-0000-0000-000000000001','Synthetic ERP','csv','["Product No.","Item Description"]','{"sku":"Product No.","name":"Item Description"}');
update public.catalogue_field_maps set mapping='{"sku":"Product No.","name":"Item Description"}' where name='Synthetic ERP';
select pg_temp.assert_true((select count(*)=1 from public.catalogue_field_maps),'saved mapping can be reused and edited');
select set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000002',true);
select pg_temp.assert_true((select unit_price=100 and active from public.products where sku='ABC-1'),'other tenant same SKU untouched');
select pg_temp.assert_true((select count(*)=0 from public.catalogue_field_maps),'field maps isolated by organization');
select pg_temp.expect_error($q$select public.commit_catalogue_import('20000000-0000-0000-0000-000000000002','50000000-0000-0000-0000-000000000003',false)$q$,'CATALOGUE_PREVIEW_NOT_FOUND');
select set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000003',true);
select pg_temp.expect_error($q$select public.prepare_catalogue_import('20000000-0000-0000-0000-000000000001',gen_random_uuid(),'[{"sku":"X","name":"x","stock_quantity_provided":false}]','merge',repeat('a',64))$q$,'CATALOGUE_FORBIDDEN');
select pg_temp.expect_error($q$insert into public.catalogue_field_maps(organization_id,name,format,headers,mapping) values('20000000-0000-0000-0000-000000000001','blocked','csv','["x"]','{}')$q$,'row-level security');
reset role;
update private.catalogue_imports set expires_at=now()-interval '1 second' where id='50000000-0000-0000-0000-000000000003';
select set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000001',true);
set local role authenticated;
select pg_temp.expect_error($q$select public.commit_catalogue_import('20000000-0000-0000-0000-000000000001','50000000-0000-0000-0000-000000000003',false)$q$,'CATALOGUE_PREVIEW_EXPIRED');

-- A failure after product mutation must roll back products, revisions and audit together.
select public.prepare_catalogue_import('20000000-0000-0000-0000-000000000001','50000000-0000-0000-0000-000000000004','[{"sku":"ATOMIC","name":"rollback test","unit_price":5,"stock_quantity_provided":false}]','merge',repeat('d',64)) is not null;
reset role;
create function pg_temp.reject_catalogue_audit() returns trigger language plpgsql as $$ begin if new.event_type='catalogue_imported' then raise exception 'INJECTED_AUDIT_FAILURE'; end if; return new; end $$;
create trigger synthetic_audit_failure before insert on public.activity_events for each row execute function pg_temp.reject_catalogue_audit();
set local role authenticated;
select pg_temp.expect_error($q$select public.commit_catalogue_import('20000000-0000-0000-0000-000000000001','50000000-0000-0000-0000-000000000004',false)$q$,'INJECTED_AUDIT_FAILURE');
select pg_temp.assert_true((select count(*)=0 from public.products where sku='ATOMIC'),'failure after writes rolls back all products');
reset role;
drop trigger synthetic_audit_failure on public.activity_events;
set local role authenticated;
select pg_temp.assert_true(public.commit_catalogue_import('20000000-0000-0000-0000-000000000001','50000000-0000-0000-0000-000000000004',false)->>'created'='1','retry after failure succeeds with same preview and revision');
do $$ declare payload jsonb; p jsonb; begin
  select jsonb_agg(jsonb_build_object('sku','WIDE-'||i,'name',repeat(chr(1),5000),
    'manufacturer',repeat(chr(1),5000),'manufacturer_part_number',repeat(chr(1),5000),'unit',repeat(chr(1),5000),'stock_quantity_provided',false))
    into payload from generate_series(1,50) i;
  p := public.prepare_catalogue_import('20000000-0000-0000-0000-000000000001','50000000-0000-0000-0000-000000000005',payload,'merge',repeat('e',64));
  perform pg_temp.assert_true((p->'summary'->>'page_size')::integer<50 and octet_length(p::text)<4*1024*1024,'wide escaped rows use bounded response pages');
  perform public.catalogue_preview_action('20000000-0000-0000-0000-000000000001','50000000-0000-0000-0000-000000000005',0,true);
end $$;
reset role;
select pg_temp.assert_true((select payload is null and plan ? 'changes' = false from private.catalogue_imports where id='50000000-0000-0000-0000-000000000004'),'committed import retains aggregates only');
select pg_temp.assert_true(not has_function_privilege('anon','public.prepare_catalogue_import(uuid,uuid,jsonb,text,text)','execute'),'anonymous preview RPC unavailable');
select pg_temp.assert_true(not has_function_privilege('anon','private.commit_catalogue_import_impl(uuid,uuid,boolean)','execute'),'anonymous privileged commit unavailable');
rollback;
