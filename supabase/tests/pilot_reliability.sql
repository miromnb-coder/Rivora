-- Nodra pilot reliability regression suite.
-- Run against a Supabase project with at least two distinct pilot workspaces.
-- Every fixture and mutation is wrapped in one transaction and rolled back.

begin;

do $$
declare
  a record;
  b record;
begin
  select m.user_id,m.organization_id into a
  from public.organization_members m
  where m.role in ('owner','admin')
  order by m.organization_id
  limit 1;

  select m.user_id,m.organization_id into b
  from public.organization_members m
  where m.role in ('owner','admin')
    and m.organization_id<>a.organization_id
    and m.user_id<>a.user_id
  order by m.organization_id
  limit 1;

  if a.user_id is null or b.user_id is null then
    raise exception 'RLS suite requires two distinct owner/admin users in different workspaces';
  end if;

  perform set_config('test.user_a',a.user_id::text,true);
  perform set_config('test.org_a',a.organization_id::text,true);
  perform set_config('test.user_b',b.user_id::text,true);
  perform set_config('test.org_b',b.organization_id::text,true);

  perform set_config('test.customer_a',gen_random_uuid()::text,true);
  perform set_config('test.customer_b',gen_random_uuid()::text,true);
  perform set_config('test.product_b',gen_random_uuid()::text,true);
  perform set_config('test.rfq_b',gen_random_uuid()::text,true);
  perform set_config('test.rfq_line_b',gen_random_uuid()::text,true);
  perform set_config('test.quote_b',gen_random_uuid()::text,true);
  perform set_config('test.quote_line_b',gen_random_uuid()::text,true);
  perform set_config('test.attempt_b',gen_random_uuid()::text,true);

  update public.organizations
  set name=coalesce(nullif(name,''),'Tenant A'),
      email=coalesce(nullif(email,''),'tenant-a@example.com'),
      address_line1=coalesce(nullif(address_line1,''),'Testikatu 1'),
      city=coalesce(nullif(city,''),'Tampere')
  where id=a.organization_id;

  update public.organizations
  set name=coalesce(nullif(name,''),'Tenant B'),
      email=coalesce(nullif(email,''),'tenant-b@example.com'),
      address_line1=coalesce(nullif(address_line1,''),'Testikatu 2'),
      city=coalesce(nullif(city,''),'Tampere')
  where id=b.organization_id;

  insert into public.customers(id,organization_id,name)
  values
    (current_setting('test.customer_a')::uuid,a.organization_id,'Nodra Test Customer A'),
    (current_setting('test.customer_b')::uuid,b.organization_id,'Nodra Test Customer B');

  insert into public.products(id,organization_id,sku,name,unit,unit_price,active)
  values (
    current_setting('test.product_b')::uuid,b.organization_id,
    'TENANT-B-SECRET','Tenant B Secret Product','pcs',999,true
  );

  insert into public.rfqs(id,organization_id,customer_id,reference,source_type,status)
  values (
    current_setting('test.rfq_b')::uuid,b.organization_id,
    current_setting('test.customer_b')::uuid,'TENANT-B-RFQ','manual','needs_review'
  );

  insert into public.rfq_lines(
    id,organization_id,rfq_id,line_number,customer_sku,raw_description,quantity,unit,review_status
  ) values (
    current_setting('test.rfq_line_b')::uuid,b.organization_id,current_setting('test.rfq_b')::uuid,
    1,'TENANT-B-SECRET','Secret line',1,'pcs','unmatched'
  );

  insert into public.quotes(
    id,organization_id,customer_id,quote_number,status,currency,valid_until,tax_rate,created_by
  ) values (
    current_setting('test.quote_b')::uuid,b.organization_id,current_setting('test.customer_b')::uuid,
    'Q-TENANT-B','draft','EUR',current_date+14,25.5,b.user_id
  );

  insert into public.quote_lines(
    id,organization_id,quote_id,line_number,product_id,quantity,unit,unit_price,
    catalogue_unit_price,discount_percent,line_total,pricing_required
  ) values (
    current_setting('test.quote_line_b')::uuid,b.organization_id,current_setting('test.quote_b')::uuid,
    1,current_setting('test.product_b')::uuid,1,'pcs',999,999,0,999,false
  );

  insert into public.quote_email_attempts(
    id,organization_id,quote_id,attempt_no,idempotency_key,recipient_email,status,created_by
  ) values (
    current_setting('test.attempt_b')::uuid,b.organization_id,current_setting('test.quote_b')::uuid,
    1,'tenant-b-test-'||current_setting('test.attempt_b'),'secret-b@example.com','pending',b.user_id
  );
end $$;

-- 1) RLS tenant isolation: tenant A cannot see or mutate tenant B fixtures.
select set_config('request.jwt.claim.sub',current_setting('test.user_a'),true);
set local role authenticated;

do $$
declare
  n integer;
  changed integer;
  blocked boolean := false;
begin
  select count(*) into n from public.customers where id=current_setting('test.customer_b')::uuid;
  if n<>0 then raise exception 'RLS leak: customers'; end if;

  select count(*) into n from public.products where id=current_setting('test.product_b')::uuid;
  if n<>0 then raise exception 'RLS leak: products'; end if;

  select count(*) into n from public.rfqs where id=current_setting('test.rfq_b')::uuid;
  if n<>0 then raise exception 'RLS leak: rfqs'; end if;

  select count(*) into n from public.rfq_lines where id=current_setting('test.rfq_line_b')::uuid;
  if n<>0 then raise exception 'RLS leak: rfq_lines'; end if;

  select count(*) into n from public.quotes where id=current_setting('test.quote_b')::uuid;
  if n<>0 then raise exception 'RLS leak: quotes'; end if;

  select count(*) into n from public.quote_lines where id=current_setting('test.quote_line_b')::uuid;
  if n<>0 then raise exception 'RLS leak: quote_lines'; end if;

  select count(*) into n from public.quote_email_attempts where id=current_setting('test.attempt_b')::uuid;
  if n<>0 then raise exception 'RLS leak: quote_email_attempts'; end if;

  update public.products set name='LEAKED' where id=current_setting('test.product_b')::uuid;
  get diagnostics changed = row_count;
  if changed<>0 then raise exception 'RLS mutation leak: products'; end if;

  begin
    perform public.refresh_rfq_matches(current_setting('test.rfq_b')::uuid);
  exception when others then
    blocked := position('Not authorized' in sqlerrm)>0 or position('RFQ not found' in sqlerrm)>0;
  end;
  if not blocked then raise exception 'Cross-tenant refresh_rfq_matches was not blocked'; end if;

  blocked := false;
  begin
    perform public.import_catalogue_rows(
      current_setting('test.org_b')::uuid,
      '[{"sku":"X","name":"X","unit":"pcs","unit_price":1}]'::jsonb
    );
  exception when others then
    blocked := position('Owner or admin access' in sqlerrm)>0;
  end;
  if not blocked then raise exception 'Cross-tenant catalogue import was not blocked'; end if;
end $$;

-- 2) Catalogue integration: import is atomic sync/replace and missing price stays explicit.
do $$
declare
  r jsonb;
  n integer;
begin
  r := public.import_catalogue_rows(
    current_setting('test.org_a')::uuid,
    '[
      {"sku":"CAT-A","name":"Catalogue A","manufacturer":"Nodra","manufacturer_part_number":"MPN-A","unit":"pcs","unit_price":10,"stock_quantity":5},
      {"sku":"CAT-B","name":"Catalogue B","manufacturer":"Nodra","manufacturer_part_number":"MPN-B","unit":"pcs","unit_price":null,"stock_quantity":2}
    ]'::jsonb
  );

  if (r->>'total')::int<>2 or (r->>'missing_price')::int<>1 then
    raise exception 'Catalogue summary regression: %',r;
  end if;

  r := public.import_catalogue_rows(
    current_setting('test.org_a')::uuid,
    '[
      {"sku":"CAT-A","name":"Catalogue A v2","manufacturer":"Nodra","manufacturer_part_number":"MPN-A","unit":"pcs","unit_price":11,"stock_quantity":4}
    ]'::jsonb
  );

  select count(*) into n
  from public.products
  where organization_id=current_setting('test.org_a')::uuid and sku='CAT-B' and active=false;
  if n<>1 then raise exception 'Catalogue sync did not deactivate omitted SKU'; end if;

  select count(*) into n
  from public.activity_events
  where organization_id=current_setting('test.org_a')::uuid
    and event_type='catalogue_imported'
    and metadata->>'mode'='sync_replace';
  if n<2 then raise exception 'Catalogue audit events missing'; end if;

  begin
    perform public.import_catalogue_rows(
      current_setting('test.org_a')::uuid,
      '[{"sku":"DUP","name":"One"},{"sku":"dup","name":"Two"}]'::jsonb
    );
    raise exception 'Duplicate catalogue SKU should have failed';
  exception when others then
    if position('duplicate SKUs' in sqlerrm)=0 then raise; end if;
  end;
end $$;

-- Prepare deterministic matching catalogue.
do $$
declare
  r jsonb;
begin
  r := public.import_catalogue_rows(
    current_setting('test.org_a')::uuid,
    '[
      {"sku":"EXACT-100","name":"Exact Valve","manufacturer":"Acme","manufacturer_part_number":"MPN-EXACT-100","unit":"pcs","unit_price":100},
      {"sku":"MPN-200","name":"MPN Bearing","manufacturer":"Acme","manufacturer_part_number":"BEARING-7788","unit":"pcs","unit_price":50},
      {"sku":"FUZZY-300","name":"Alpha Industrial Fuzzy Valve Assembly","manufacturer":"Acme","manufacturer_part_number":"FV-300","unit":"pcs","unit_price":75},
      {"sku":"MEM-A","name":"Memory Product A","manufacturer":"Acme","manufacturer_part_number":"MEM-A-MPN","unit":"pcs","unit_price":25},
      {"sku":"MEM-B","name":"Memory Product B","manufacturer":"Acme","manufacturer_part_number":"MEM-B-MPN","unit":"pcs","unit_price":30}
    ]'::jsonb
  );
end $$;

-- 3-4) RFQ matching + Customer Memory regressions.
do $$
declare
  cust uuid := current_setting('test.customer_a')::uuid;
  org uuid := current_setting('test.org_a')::uuid;
  uid uuid := current_setting('test.user_a')::uuid;
  p_mem_a uuid;
  p_mem_b uuid;
  rfq uuid := gen_random_uuid();
  l_mem uuid := gen_random_uuid();
  l_sku uuid := gen_random_uuid();
  l_mpn uuid := gen_random_uuid();
  l_fuzzy uuid := gen_random_uuid();
  l_none uuid := gen_random_uuid();
  rfq2 uuid := gen_random_uuid();
  l_mem2 uuid := gen_random_uuid();
  mapping_id uuid;
  method text;
  review text;
  selected uuid;
  n integer;
begin
  select id into p_mem_a from public.products where organization_id=org and sku='MEM-A';
  select id into p_mem_b from public.products where organization_id=org and sku='MEM-B';

  insert into public.customer_product_mappings(
    organization_id,customer_id,customer_sku,customer_description,product_id,
    confidence,source,times_used,confirmed_by_user_id
  ) values (
    org,cust,'CUSTOM-MEM','Remembered alias',p_mem_a,100,'user_confirmed',1,uid
  ) returning id into mapping_id;

  insert into public.rfqs(id,organization_id,customer_id,reference,source_type,status)
  values (rfq,org,cust,'MATCH-TEST','manual','processing');

  insert into public.rfq_lines(
    id,organization_id,rfq_id,line_number,customer_sku,raw_description,quantity,unit,review_status
  ) values
    (l_mem,org,rfq,1,'CUSTOM-MEM','Remembered alias',1,'pcs','pending'),
    (l_sku,org,rfq,2,'EXACT-100','Exact SKU request',2,'pcs','pending'),
    (l_mpn,org,rfq,3,'BEARING-7788','MPN request',3,'pcs','pending'),
    (l_fuzzy,org,rfq,4,null,'Alpha Industrial Fuzzy Valve Assembly',4,'pcs','pending'),
    (l_none,org,rfq,5,null,'QZXCVBNM UNMATCHABLE 9922',1,'pcs','pending');

  perform public.refresh_rfq_matches(rfq);

  select match_method,review_status into method,review from public.rfq_lines where id=l_mem;
  if method<>'customer_memory' or review<>'needs_review' then
    raise exception 'Customer Memory match must still require human review: %, %',method,review;
  end if;

  select match_method,review_status into method,review from public.rfq_lines where id=l_sku;
  if method<>'exact_sku' or review<>'needs_review' then
    raise exception 'Exact SKU match regression: %, %',method,review;
  end if;

  select match_method,review_status into method,review from public.rfq_lines where id=l_mpn;
  if method<>'exact_mpn' or review<>'needs_review' then
    raise exception 'Exact MPN match regression: %, %',method,review;
  end if;

  select match_method,review_status into method,review from public.rfq_lines where id=l_fuzzy;
  if method<>'fuzzy' or review<>'needs_review' then
    raise exception 'Fuzzy match regression: %, %',method,review;
  end if;

  select review_status into review from public.rfq_lines where id=l_none;
  if review<>'unmatched' then raise exception 'No-match line must remain unmatched: %',review; end if;

  perform public.confirm_rfq_line_match(l_mem,p_mem_b,true);

  select product_id into selected from public.customer_product_mappings where id=mapping_id;
  if selected<>p_mem_b then raise exception 'Confirmed correction did not update Customer Memory'; end if;

  insert into public.rfqs(id,organization_id,customer_id,reference,source_type,status)
  values (rfq2,org,cust,'MEMORY-REUSE','manual','processing');
  insert into public.rfq_lines(
    id,organization_id,rfq_id,line_number,customer_sku,raw_description,quantity,unit,review_status
  ) values (l_mem2,org,rfq2,1,'CUSTOM-MEM','Remembered alias again',1,'pcs','pending');

  perform public.refresh_rfq_matches(rfq2);
  select selected_product_id,match_method,review_status into selected,method,review
  from public.rfq_lines where id=l_mem2;

  if selected<>p_mem_b or method<>'customer_memory' or review<>'needs_review' then
    raise exception 'Customer Memory reuse regression';
  end if;

  update public.customer_product_mappings
  set product_id=p_mem_a,confirmed_by_user_id=uid,updated_at=now()
  where id=mapping_id;
  delete from public.customer_product_mappings where id=mapping_id;

  select count(*) into n from public.activity_events
  where entity_id=mapping_id and event_type='customer_memory_changed';
  if n<1 then raise exception 'Customer Memory change audit missing'; end if;
  select count(*) into n from public.activity_events
  where entity_id=mapping_id and event_type='customer_memory_deleted';
  if n<>1 then raise exception 'Customer Memory delete audit missing'; end if;
end $$;

-- 5) Quote state / pricing / approval invariants and durable send reconciliation.
do $$
declare
  org uuid := current_setting('test.org_a')::uuid;
  uid uuid := current_setting('test.user_a')::uuid;
  cust uuid := current_setting('test.customer_a')::uuid;
  prod uuid;
  q uuid := gen_random_uuid();
  ql uuid := gen_random_uuid();
  attempt jsonb;
  attempt_id uuid;
  blocked boolean := false;
  status_now text;
begin
  select id into prod from public.products where organization_id=org and sku='EXACT-100';

  insert into public.quotes(
    id,organization_id,customer_id,quote_number,status,currency,valid_until,tax_rate,created_by,recipient_email
  ) values (
    q,org,cust,'Q-STATE-TEST','draft','EUR',current_date+14,25.5,uid,'buyer@example.com'
  );

  insert into public.quote_lines(
    id,organization_id,quote_id,line_number,product_id,quantity,unit,unit_price,
    catalogue_unit_price,discount_percent,line_total,pricing_required
  ) values (ql,org,q,1,prod,1,'pcs',0,null,0,0,true);

  begin
    update public.quotes set status='ready',updated_at=now() where id=q;
  exception when others then
    blocked := position('incomplete or invalid pricing' in sqlerrm)>0;
  end;
  if not blocked then raise exception 'Quote ready allowed incomplete pricing'; end if;

  update public.quote_lines
  set unit_price=100,catalogue_unit_price=100,pricing_required=false,line_total=100
  where id=ql;

  update public.quotes set status='ready',updated_at=now() where id=q;

  blocked := false;
  begin
    update public.quotes set status='approved',updated_at=now() where id=q;
  exception when others then
    blocked := position('approver and approval time' in sqlerrm)>0;
  end;
  if not blocked then raise exception 'Quote approved without approver metadata'; end if;

  update public.quotes
  set status='approved',approved_by=uid,approved_at=now(),updated_at=now()
  where id=q;

  blocked := false;
  begin
    update public.quote_lines set unit_price=101,line_total=101 where id=ql;
  exception when others then
    blocked := position('locked' in lower(sqlerrm))>0;
  end;
  if not blocked then raise exception 'Approved quote line remained editable'; end if;

  attempt := public.begin_quote_email_attempt(q,'buyer@example.com');
  attempt_id := (attempt->>'attempt_id')::uuid;
  perform public.record_quote_email_provider_accept(
    attempt_id,'email-reconcile-'||attempt_id::text,jsonb_build_object('id','email-reconcile-'||attempt_id::text)
  );
  perform public.reconcile_quote_email_attempt(attempt_id);

  select status into status_now from public.quotes where id=q;
  if status_now<>'sent' then raise exception 'Provider-accepted email did not reconcile quote to sent'; end if;

  select status into status_now from public.quote_email_attempts where id=attempt_id;
  if status_now<>'sent' then raise exception 'Email attempt did not reconcile to sent'; end if;
end $$;

reset role;

-- 6) Signed Resend webhook: valid signature, duplicate idempotency and monotonic delivery state.
do $$
declare
  org uuid := current_setting('test.org_a')::uuid;
  uid uuid := current_setting('test.user_a')::uuid;
  cust uuid := current_setting('test.customer_a')::uuid;
  prod uuid;
  q uuid := gen_random_uuid();
  ql uuid := gen_random_uuid();
  a uuid := gen_random_uuid();
  provider_id text := 'email-webhook-'||gen_random_uuid()::text;
  secret text;
  secret_bytes bytea;
  ts text := floor(extract(epoch from now()))::bigint::text;
  svix_id text := 'msg_'||replace(gen_random_uuid()::text,'-','');
  payload text;
  signed text;
  sig text;
  result jsonb;
  current_delivery text;
  attempt_status text;
  status_now text;
  n integer;
  older_payload text;
  older_svix text := 'msg_'||replace(gen_random_uuid()::text,'-','');
  older_sig text;
  q2 uuid := gen_random_uuid();
  ql2 uuid := gen_random_uuid();
  a2 uuid := gen_random_uuid();
  provider_id2 text := 'email-webhook-tag-'||gen_random_uuid()::text;
  tag_payload text;
  tag_svix text := 'msg_'||replace(gen_random_uuid()::text,'-','');
  tag_sig text;
begin
  select id into prod from public.products where organization_id=org and sku='EXACT-100';
  select secret_value into secret from private.integration_secrets where name='resend_webhook_signing_secret';
  if secret is null then raise exception 'Resend webhook signing secret missing'; end if;
  secret_bytes := decode(substring(secret from 7),'base64');

  insert into public.quotes(
    id,organization_id,customer_id,quote_number,status,currency,valid_until,tax_rate,
    created_by,approved_by,approved_at,recipient_email
  ) values (
    q,org,cust,'Q-WEBHOOK-TEST','draft','EUR',current_date+14,25.5,uid,null,null,'buyer@example.com'
  );
  insert into public.quote_lines(
    id,organization_id,quote_id,line_number,product_id,quantity,unit,unit_price,
    catalogue_unit_price,discount_percent,line_total,pricing_required
  ) values (ql,org,q,1,prod,1,'pcs',100,100,0,100,false);
  update public.quotes set status='ready' where id=q;
  update public.quotes set status='approved',approved_by=uid,approved_at=now() where id=q;

  insert into public.quote_email_attempts(
    id,organization_id,quote_id,attempt_no,idempotency_key,recipient_email,status,
    provider_email_id,provider_response,created_by,accepted_at
  ) values (
    a,org,q,1,'webhook-test-'||a::text,'buyer@example.com','provider_accepted',
    provider_id,jsonb_build_object('id',provider_id),uid,now()-interval '5 seconds'
  );

  payload := jsonb_build_object(
    'id','evt_delivered_'||a::text,
    'type','email.delivered',
    'created_at',now(),
    'data',jsonb_build_object(
      'email_id',provider_id,
      'to',jsonb_build_array('buyer@example.com'),
      'message_id','message-'||a::text
    )
  )::text;

  signed := svix_id||'.'||ts||'.'||payload;
  sig := 'v1,'||encode(extensions.hmac(convert_to(signed,'UTF8'),secret_bytes,'sha256'),'base64');

  result := public.process_resend_webhook(payload,svix_id,ts,sig);
  if result->>'status'<>'processed' then raise exception 'Valid webhook was not processed: %',result; end if;

  select delivery_status into current_delivery from public.quotes where id=q;
  if current_delivery<>'delivered' then raise exception 'Delivered webhook did not update quote'; end if;
  select status into attempt_status from public.quote_email_attempts where id=a;
  if attempt_status<>'delivered' then raise exception 'Delivered webhook did not update attempt'; end if;

  perform public.process_resend_webhook(payload,svix_id,ts,sig);
  select count(*) into n from public.quote_email_events
  where quote_id=q and provider_email_id=provider_id and event_type='delivered';
  if n<>1 then raise exception 'Duplicate webhook created duplicate logical event'; end if;

  older_payload := jsonb_build_object(
    'id','evt_sent_old_'||a::text,
    'type','email.sent',
    'created_at',now()-interval '1 minute',
    'data',jsonb_build_object('email_id',provider_id,'to',jsonb_build_array('buyer@example.com'))
  )::text;
  signed := older_svix||'.'||ts||'.'||older_payload;
  older_sig := 'v1,'||encode(extensions.hmac(convert_to(signed,'UTF8'),secret_bytes,'sha256'),'base64');
  perform public.process_resend_webhook(older_payload,older_svix,ts,older_sig);

  select delivery_status into current_delivery from public.quotes where id=q;
  if current_delivery<>'delivered' then raise exception 'Older sent event regressed delivered state'; end if;

  begin
    perform public.process_resend_webhook(payload,'bad-id',ts,'v1,invalid');
    raise exception 'Invalid webhook signature should fail';
  exception when others then
    if position('Invalid webhook signature' in sqlerrm)=0 then raise; end if;
  end;

  -- Provider acceptance persistence can fail after the provider accepted the email.
  -- A signed attempt tag must be enough to repair the pending attempt from webhook data.
  insert into public.quotes(
    id,organization_id,customer_id,quote_number,status,currency,valid_until,tax_rate,
    created_by,approved_by,approved_at,recipient_email
  ) values (
    q2,org,cust,'Q-WEBHOOK-TAG-TEST','draft','EUR',current_date+14,25.5,uid,null,null,'buyer2@example.com'
  );
  insert into public.quote_lines(
    id,organization_id,quote_id,line_number,product_id,quantity,unit,unit_price,
    catalogue_unit_price,discount_percent,line_total,pricing_required
  ) values (ql2,org,q2,1,prod,1,'pcs',100,100,0,100,false);
  update public.quotes set status='ready' where id=q2;
  update public.quotes set status='approved',approved_by=uid,approved_at=now() where id=q2;

  insert into public.quote_email_attempts(
    id,organization_id,quote_id,attempt_no,idempotency_key,recipient_email,status,created_by
  ) values (
    a2,org,q2,1,'webhook-tag-test-'||a2::text,'buyer2@example.com','pending',uid
  );

  tag_payload := jsonb_build_object(
    'id','evt_sent_tag_'||a2::text,
    'type','email.sent',
    'created_at',now(),
    'data',jsonb_build_object(
      'email_id',provider_id2,
      'to',jsonb_build_array('buyer2@example.com'),
      'tags',jsonb_build_object(
        'nodra_quote_id',q2::text,
        'nodra_attempt_id',a2::text,
        'nodra_attempt','1'
      )
    )
  )::text;
  signed := tag_svix||'.'||ts||'.'||tag_payload;
  tag_sig := 'v1,'||encode(extensions.hmac(convert_to(signed,'UTF8'),secret_bytes,'sha256'),'base64');

  result := public.process_resend_webhook(tag_payload,tag_svix,ts,tag_sig);
  if result->>'status'<>'processed' or result->>'attempt_id'<>a2::text then
    raise exception 'Webhook attempt-tag reconciliation failed: %',result;
  end if;

  select status,provider_email_id into attempt_status,provider_id
  from public.quote_email_attempts where id=a2;
  if attempt_status<>'sent' or provider_id<>provider_id2 then
    raise exception 'Pending attempt was not repaired from signed attempt tag';
  end if;

  select status into status_now from public.quotes where id=q2;
  if status_now<>'sent' then raise exception 'Attempt-tag webhook did not reconcile quote to sent'; end if;
end $$;

rollback;
