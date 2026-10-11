begin;
-- Owner has only the tables needed by the fenced document publication functions.
grant select,update(role) on public.organization_members to averomira_operations_owner;
drop policy if exists operations_member_lock on public.organization_members;
create policy operations_member_lock on public.organization_members for update to averomira_operations_owner using(true) with check(true);
grant update(status) on public.quotes to averomira_operations_owner;
grant select,insert,update on public.customers,public.rfqs,public.rfq_lines,public.rfq_files,public.purchase_orders,public.purchase_order_lines,public.purchase_order_files,public.ai_extractions,public.purchase_order_reconciliations,public.purchase_order_reconciliation_lines to averomira_operations_owner;
grant select on public.quotes,public.quote_lines,public.products,public.workspace_memory_entries to averomira_operations_owner;
grant insert on public.activity_events to averomira_operations_owner;
grant usage on sequence public.activity_events_id_seq to averomira_operations_owner;
grant execute on function private.has_org_role(uuid,text[]),private.is_org_member(uuid) to averomira_operations_owner;
grant execute on function public.refresh_rfq_matches_with_memory_server(uuid,uuid),public.commit_purchase_order_reconciliation(uuid,uuid,text,jsonb,jsonb,jsonb) to averomira_operations_owner;
do $$ declare t text; begin
 foreach t in array array['customers','rfqs','rfq_lines','rfq_files','purchase_orders','purchase_order_lines','purchase_order_files','purchase_order_reconciliations','purchase_order_reconciliation_lines','ai_extractions','quotes','quote_lines','products','workspace_memory_entries','activity_events'] loop
 execute format('drop policy if exists operations_owner_access on public.%I',t);
 execute format('create policy operations_owner_access on public.%I for all to averomira_operations_owner using(true) with check(true)',t);
 end loop;
end $$;
create or replace function private.operation_publish_document(p_id uuid,p_generation bigint,p_token uuid) returns uuid
language plpgsql security definer set search_path='' as $$
declare j private.operation_jobs; e jsonb; c uuid; customer text; q public.quotes; line jsonb; n integer:=0; warnings jsonb;
begin
 j:=private.operation_fence(p_id,p_generation,p_token);
 -- Membership cannot be changed while this delayed business mutation commits.
 perform 1 from public.organization_members where organization_id=j.organization_id and user_id=j.actor_id and role in('owner','admin','member') for share;
 if not found then raise exception 'OPERATION_PERMISSION'; end if;
 if j.entity_id is not null then return j.entity_id; end if;
 if j.stage<>'extraction_persisted' or j.checkpoint is null then raise exception 'OPERATION_NO_CHECKPOINT'; end if;
 e:=j.checkpoint->'extraction';warnings:=coalesce(e->'warnings','[]'::jsonb);
 if (j.type='rfq_pdf_process' and e->>'document_type'<>'rfq') or (j.type='po_pdf_process' and e->>'document_type'<>'purchase_order') or j.type not in('rfq_pdf_process','po_pdf_process') then raise exception 'OPERATION_INVALID_EXTRACTION'; end if;
 if jsonb_typeof(e->'lines')<>'array' or jsonb_array_length(e->'lines') not between 1 and (case when j.type='rfq_pdf_process' then 1000 else 2000 end) then raise exception 'OPERATION_INVALID_EXTRACTION'; end if;
 customer:=left(trim(coalesce(nullif(j.metadata->>'customerName',''),e->>'customer_name','')),200);
 if j.type='po_pdf_process' and nullif(j.metadata->>'quoteId','') is not null then
 select * into q from public.quotes where id=(j.metadata->>'quoteId')::uuid and organization_id=j.organization_id for share;
 if not found or q.status not in('approved','sent') then raise exception 'OPERATION_PERMISSION'; end if;
 c:=q.customer_id;
 if customer<>'' and not exists(select 1 from public.customers where id=c and organization_id=j.organization_id and lower(name)=lower(customer)) then warnings:=warnings||jsonb_build_array('Selected quote customer differs from extracted document; human review required.'); end if;
 else
 if customer='' then raise exception 'OPERATION_INVALID_EXTRACTION'; end if;
 insert into public.customers(organization_id,name) values(j.organization_id,customer) on conflict do nothing;
 select id into c from public.customers where organization_id=j.organization_id and name=customer order by created_at limit 1;
 end if;
 if not exists(select 1 from public.customers where id=c and organization_id=j.organization_id) then raise exception 'OPERATION_PERMISSION'; end if;
 if j.type='rfq_pdf_process' then
 insert into public.rfqs(id,organization_id,customer_id,reference,source_type,source_file_name,status,extraction_provider,extraction_model,extraction_confidence,extraction_warnings,extraction_completed_at)
 values(j.id,j.organization_id,c,left(coalesce(nullif(j.metadata->>'reference',''),e->>'reference',j.metadata->>'fileName','PDF'),240),'pdf',left(j.metadata->>'fileName',240),'processing','openai',j.checkpoint->>'model',(e->>'overall_confidence')::numeric,warnings,now());
 insert into public.rfq_files(organization_id,rfq_id,file_name,storage_path,mime_type) values(j.organization_id,j.id,coalesce(j.metadata->>'fileName','document.pdf'),j.input_ref,'application/pdf');
 else
 insert into public.purchase_orders(id,organization_id,customer_id,quote_id,po_number,quote_reference,source_type,source_file_name,status,currency,order_date,overall_confidence,extraction_provider,extraction_model,extraction_confidence,extraction_warnings,extraction_completed_at,created_by)
 values(j.id,j.organization_id,c,q.id,left(coalesce(nullif(j.metadata->>'reference',''),nullif(e->>'po_number',''),'PDF'),200),coalesce(e->>'quote_reference',q.quote_number),'pdf',left(j.metadata->>'fileName',240),'extracted',case when coalesce(e->>'currency','')~'^[A-Z]{3}$' then e->>'currency' else coalesce(q.currency,'EUR') end,case when coalesce(e->>'order_date','')~'^\d{4}-\d{2}-\d{2}$' then (e->>'order_date')::date else null end,(e->>'overall_confidence')::numeric,'openai',j.checkpoint->>'model',(e->>'overall_confidence')::numeric,warnings,now(),j.actor_id);
 insert into public.purchase_order_files(organization_id,purchase_order_id,file_name,storage_path,mime_type,size_bytes,sha256) values(j.organization_id,j.id,coalesce(j.metadata->>'fileName','document.pdf'),j.input_ref,'application/pdf',(j.metadata->>'size')::bigint,j.input_hash);
 end if;
 for line in select value from jsonb_array_elements(e->'lines') loop
 n:=n+1;
 if (line->>'quantity')::numeric<=0 or (line->>'quantity')::numeric='NaN'::numeric or length(coalesce(line->>'description',''))>10000 then raise exception 'OPERATION_INVALID_EXTRACTION'; end if;
 if j.type='rfq_pdf_process' then
 insert into public.rfq_lines(organization_id,rfq_id,line_number,customer_sku,raw_description,quantity,unit,manufacturer,manufacturer_part_number,extraction_confidence,source_page,extraction_notes)
 values(j.organization_id,j.id,n,line->>'customer_sku',line->>'description',(line->>'quantity')::numeric,line->>'unit',line->>'manufacturer',line->>'manufacturer_part_number',(line->>'confidence')::numeric,(line->>'source_page')::integer,line->>'notes');
 else
 insert into public.purchase_order_lines(organization_id,purchase_order_id,line_number,customer_sku,raw_description,quantity,unit,manufacturer,manufacturer_part_number,extraction_confidence,source_page,extraction_notes,unit_price,line_total)
 values(j.organization_id,j.id,n,line->>'customer_sku',coalesce(line->>'description',''),(line->>'quantity')::numeric,line->>'unit',line->>'manufacturer',line->>'manufacturer_part_number',(line->>'confidence')::numeric,(line->>'source_page')::integer,line->>'notes',(line->>'unit_price')::numeric,(line->>'line_total')::numeric);
 end if;
 end loop;
 insert into public.ai_extractions(organization_id,rfq_id,purchase_order_id,provider,model,response_id,status,source_file_name,source_file_sha256,document_type,overall_confidence,extracted_payload,warnings,usage)
 values(j.organization_id,case when j.type='rfq_pdf_process' then j.id end,case when j.type='po_pdf_process' then j.id end,'openai',j.checkpoint->>'model',j.checkpoint->>'responseId','completed',j.metadata->>'fileName',j.input_hash,e->>'document_type',(e->>'overall_confidence')::numeric,e,warnings,j.checkpoint->'usage');
 insert into public.activity_events(organization_id,actor_user_id,entity_type,entity_id,event_type,metadata) values(j.organization_id,j.actor_id,'operation',j.id,'operation_document_published',jsonb_build_object('job_id',j.id,'type',j.type));
 update private.operation_jobs set entity_id=j.id,stage='lines_persisted',updated_at=now() where id=j.id;
 return j.id;
end $$;

create or replace function private.operation_complete_document(p_id uuid,p_generation bigint,p_token uuid) returns void
language plpgsql security definer set search_path='' as $$
declare j private.operation_jobs;
begin
 j:=private.operation_fence(p_id,p_generation,p_token);
 perform 1 from public.organization_members where organization_id=j.organization_id and user_id=j.actor_id and role in('owner','admin','member') for share;
 if not found then raise exception 'OPERATION_PERMISSION'; end if;
 if j.type<>'rfq_pdf_process' or not exists(select 1 from public.rfqs where id=j.entity_id and organization_id=j.organization_id) then raise exception 'OPERATION_INVALID_ENTITY'; end if;
 if j.stage='matching_completed' then return; end if;
 perform public.refresh_rfq_matches_with_memory_server(j.entity_id,j.actor_id);
 update private.operation_jobs set stage='matching_completed',updated_at=now() where id=j.id;
end $$;

create or replace function private.operation_po_context(p_id uuid,p_generation bigint,p_token uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare j private.operation_jobs; po public.purchase_orders; q public.quotes; result jsonb;
begin
 j:=private.operation_fence(p_id,p_generation,p_token);
 if j.type<>'po_pdf_process' then raise exception 'OPERATION_INVALID_ENTITY'; end if;
 select * into po from public.purchase_orders where id=j.entity_id and organization_id=j.organization_id;
 if not found then raise exception 'OPERATION_INVALID_ENTITY'; end if;
 if po.quote_id is null then return null; end if;
 select * into q from public.quotes where id=po.quote_id and organization_id=j.organization_id and customer_id=po.customer_id and status in('approved','sent') for share;
 if not found then raise exception 'OPERATION_PERMISSION'; end if;
 select jsonb_build_object('purchaseOrder',to_jsonb(po),'quote',to_jsonb(q),
 'poLines',(select jsonb_agg(to_jsonb(l)) from public.purchase_order_lines l where purchase_order_id=po.id and organization_id=j.organization_id),
 'quoteLines',(select jsonb_agg(to_jsonb(l)||jsonb_build_object('product',to_jsonb(p),'sourceLine',to_jsonb(r))) from public.quote_lines l left join public.products p on p.id=l.product_id and p.organization_id=j.organization_id left join public.rfq_lines r on r.id=l.rfq_line_id and r.organization_id=j.organization_id where l.quote_id=q.id and l.organization_id=j.organization_id),
 'unitMemory',(select coalesce(jsonb_agg(jsonb_build_object('id',id,'source_key',source_key,'source_value',source_value,'target_value',target_value)),'[]') from public.workspace_memory_entries where organization_id=j.organization_id and customer_id=po.customer_id and scope='customer' and memory_type='customer_unit_alias' and verification_state='verified' and target_entity_type='unit')) into result;
 return result;
end $$;
create or replace function private.operation_commit_po_reconciliation(p_id uuid,p_generation bigint,p_token uuid,p_header jsonb,p_summary jsonb,p_lines jsonb) returns void
language plpgsql security definer set search_path='' as $$
declare j private.operation_jobs; qid uuid; old_claim text:=current_setting('request.jwt.claim.sub',true);
begin
 j:=private.operation_fence(p_id,p_generation,p_token);
 perform 1 from public.organization_members where organization_id=j.organization_id and user_id=j.actor_id and role in('owner','admin','member') for share;
 if not found then raise exception 'OPERATION_PERMISSION'; end if;
 if j.type<>'po_pdf_process' or j.entity_id is null then raise exception 'OPERATION_INVALID_ENTITY'; end if;
 if j.stage='reconciliation_completed' then return; end if;
 select quote_id into qid from public.purchase_orders where id=j.entity_id and organization_id=j.organization_id for update;
 if not found then raise exception 'OPERATION_INVALID_ENTITY'; end if;
 if qid is not null then
 -- The existing domain function validates tenant, quote and commercial locks.
 -- Actor comes only from the fenced job; no user JWT is persisted.
 perform set_config('request.jwt.claim.sub',j.actor_id::text,true);
 perform public.commit_purchase_order_reconciliation(j.entity_id,qid,'deterministic-v2-memory',p_header,p_summary,p_lines);
 perform set_config('request.jwt.claim.sub',coalesce(old_claim,''),true);
 else update public.purchase_orders set status='needs_review' where id=j.entity_id and organization_id=j.organization_id; end if;
 update private.operation_jobs set stage='reconciliation_completed',updated_at=now() where id=j.id;
end $$;

do $$ declare f record; begin
 for f in select p.oid::regprocedure::text sig from pg_proc p where p.pronamespace='private'::regnamespace and p.proname in('operation_publish_document','operation_complete_document','operation_po_context','operation_commit_po_reconciliation') loop
 execute 'alter function '||f.sig||' owner to averomira_operations_owner';
 execute 'revoke all on function '||f.sig||' from public,anon,authenticated,service_role';
 execute 'grant execute on function '||f.sig||' to averomira_worker';
 end loop;
end $$;
commit;
