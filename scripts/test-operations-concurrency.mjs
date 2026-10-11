// Native PostgreSQL only, through a fixed local Docker container. No URLs/secrets.
import {execFile,execFileSync} from 'node:child_process';
import {promisify} from 'node:util';
import {randomUUID} from 'node:crypto';
import assert from 'node:assert/strict';
const args=['--host=unix:///var/run/docker.sock','exec','-i','averomira-catalogue-test','psql','-U','postgres','-d','averomira_test','-Atq','-v','ON_ERROR_STOP=1'];
const options={encoding:'utf8',env:{PATH:process.env.PATH},maxBuffer:2*1024*1024};
const sql=q=>execFileSync('docker',args,{...options,input:q}).trim().split('\n').filter(Boolean).at(-1);
const sqlAsync=q=>new Promise((resolve,reject)=>{const p=execFile('docker',args,options,(e,out)=>e?reject(e):resolve(out.trim().split('\n').filter(Boolean).at(-1)));p.stdin.end(q);});
const lit=x=>x==null?'null':"'"+String(x).replaceAll("'","''")+"'";
const orgs=[randomUUID(),randomUUID()],actors=[randomUUID(),randomUUID()];let checks=0;
function equal(actual,expected,label){assert.deepEqual(actual,expected,label);checks++;console.log('PASS:',label);}
const worker=q=>sql('set role averomira_worker; '+q);
const auth=(a,q)=>sql(`set role authenticated; select set_config('request.jwt.claim.sub',${lit(a)},false); ${q}`);
function fn(name,values){return `select private.${name}(${values.map(x=>lit(typeof x==='object'&&x!=null?JSON.stringify(x):x)).join(',')});`;}
const invoke=(name,job,extra=[])=>worker(fn(name,[job.id,job.generation,job.lease_token,...extra]));
const claim=()=>JSON.parse(worker(fn('operation_claim',[randomUUID(),'synthetic']))||'null');
const jobIds=[];
sql(`insert into auth.users(id,email) values (${lit(actors[0])},'synthetic-a@example.invalid'),(${lit(actors[1])},'synthetic-b@example.invalid');insert into public.organizations(id,name) values (${lit(orgs[0])},'Synthetic A'),(${lit(orgs[1])},'Synthetic B');insert into public.organization_members(organization_id,user_id,role) values (${lit(orgs[0])},${lit(actors[0])},'owner'),(${lit(orgs[1])},${lit(actors[1])},'member');insert into private.operation_limits(scope_id,max_queued,daily_micro_usd,monthly_micro_usd,enabled_types) values (${lit(orgs[0])},1000,1000000,1000000,array['rfq_pdf_process','po_pdf_process','support_notification','email_reconcile','incident_notification']),(${lit(orgs[1])},1000,1000000,1000000,array['rfq_pdf_process','po_pdf_process','support_notification','email_reconcile','incident_notification']);update private.operation_limits set enabled_types=array['rfq_pdf_process','po_pdf_process','support_notification','email_reconcile','incident_notification'],daily_micro_usd=1000000,monthly_micro_usd=1000000 where scope_id='00000000-0000-0000-0000-000000000000';`);
for(let n=0;n<100;n++){
 const id=randomUUID(),org=orgs[n%2],actor=actors[n%2],type=n%4===0?'po_pdf_process':'rfq_pdf_process';jobIds.push(id);
 auth(actor,`select public.begin_document_operation(${lit(org)},${lit(id)},${lit(type)},'{"fileName":"synthetic.pdf","customerName":"Synthetic buyer"}');select public.enqueue_document_operation(${lit(org)},${lit(id)},${lit('a'.repeat(64))},100,1);`);
}
equal(Number(sql('select count(*) from private.operation_jobs')),100,'100 durable document jobs accepted');
const firstId=jobIds[0];
const duplicates=await Promise.all([0,1].map(()=>sqlAsync(`set role authenticated;select set_config('request.jwt.claim.sub',${lit(actors[0])},false);select public.enqueue_document_operation(${lit(orgs[0])},${lit(firstId)},${lit('a'.repeat(64))},100,1);`)));
equal(duplicates,[firstId,firstId],'simultaneous duplicate/lost-response requests preserve job ID');
assert.throws(()=>auth(actors[0],`select public.enqueue_document_operation(${lit(orgs[0])},${lit(firstId)},${lit('b'.repeat(64))},100,1);`));checks++;console.log('PASS: conflicting operation bytes rejected');
const claimed=await Promise.all([0,1].map(()=>sqlAsync(`set role averomira_worker;${fn('operation_claim',[randomUUID(),'parallel'])}`))).then(x=>x.map(y=>JSON.parse(y||'null')));
equal(new Set(claimed.map(j=>j.id)).size,2,'parallel workers own different jobs');
equal(new Set(claimed.map(j=>j.organization_id)).size,2,'fairness allows two tenants');
equal(claim(),null,'global concurrency limit prevents third claim');
for(const j of claimed)invoke('operation_finish',j,['retry_wait','network',1]);
sql("update private.operation_jobs set available_at=now() where state='retry_wait';update private.operation_limits set daily_micro_usd=150,monthly_micro_usd=150 where scope_id='00000000-0000-0000-0000-000000000000';");
const budgetJobs=[claim(),claim()];
const reservations=await Promise.allSettled(budgetJobs.map(j=>sqlAsync(`set role averomira_worker;${fn('operation_reserve_ai',[j.id,j.generation,j.lease_token,'synthetic-model','fixture-prices',100])}`)));
equal(reservations.filter(x=>x.status==='fulfilled').length,1,'parallel budget reservations cannot exceed global daily/monthly limit');
equal(Number(sql("select sum(reserved_micro_usd) from private.ai_usage_ledger where state='reserved'")),100,'only accepted reservation is recorded');
for(const j of budgetJobs)invoke('operation_finish',j,['retry_wait','budget',1]);
equal(sql("select state from private.ai_usage_ledger limit 1"),'billed_unknown','uncertain reservation remains charged, not free');
sql("update private.operation_limits set daily_micro_usd=1000000,monthly_micro_usd=1000000;update private.operation_jobs set available_at=now(),attempt_count=0 where state='retry_wait';");
const stale=claim();invoke('operation_reserve_ai',stale,['m','fixture-v1',100]);
const checkpoint={extraction:{document_type:stale.type==='po_pdf_process'?'purchase_order':'rfq',customer_name:'Synthetic buyer',reference:'Synthetic',overall_confidence:90,warnings:[],lines:[{customer_sku:'SYNTHETIC',description:'Synthetic line',quantity:1,unit:'pcs',confidence:90,source_page:1}]},model:'m',responseId:'synthetic',usage:{input_tokens:1,output_tokens:1},billing:{microUsd:2}};
invoke('operation_checkpoint',stale,[checkpoint]);
sql(`update private.operation_jobs set lease_until=now()-interval '1 second' where id=${lit(stale.id)};`);worker('select private.operation_monitor(false);');
assert.throws(()=>invoke('operation_publish_document',stale));checks++;console.log('PASS: old generation cannot publish after lease recovery');
equal(sql(`select stage from private.operation_jobs where id=${lit(stale.id)}`),'extraction_persisted','checkpoint survives worker termination');
sql(`update private.operation_jobs set available_at=now()-interval '1 day' where id=${lit(stale.id)};`);
const resumed=claim();equal(resumed.id,stale.id,'recovered job is claimed again');assert.ok(resumed.generation>stale.generation);checks++;
equal(invoke('operation_publish_document',resumed),resumed.id,'checkpoint publishes stable business entity');
equal(invoke('operation_publish_document',resumed),resumed.id,'second publication does not duplicate RFQ or PO');
if(resumed.type==='rfq_pdf_process')invoke('operation_complete_document',resumed);else invoke('operation_commit_po_reconciliation',resumed,[[],{},[]]);
invoke('operation_finish',resumed,['succeeded',null,0]);
equal(Number(sql(`select count(*) from public.activity_events where event_type='operation_document_published' and entity_id=${lit(resumed.id)}`)),1,'publication has one audit event');
const revoked=claim();sql(`delete from public.organization_members where organization_id=${lit(revoked.organization_id)} and user_id=${lit(revoked.actor_id)};`);
assert.throws(()=>invoke('operation_heartbeat',revoked));checks++;console.log('PASS: execution rechecks current membership');
invoke('operation_finish',revoked,['blocked','permission',0]);equal(sql(`select state from private.operation_jobs where id=${lit(revoked.id)}`),'blocked','revoked work remains blocked');
sql(`insert into public.organization_members(organization_id,user_id,role) values (${lit(revoked.organization_id)},${lit(revoked.actor_id)},'owner');update private.operation_jobs set state='queued',available_at=now(),attempt_count=0 where id=${lit(revoked.id)};`);
equal(JSON.parse(auth(actors[0],`select public.operation_status(${lit(orgs[0])},${lit(jobIds[1])});`)),[],'status never reveals another tenant job');
assert.throws(()=>auth(actors[0],`select public.operation_status(${lit(orgs[1])},null);`));checks++;
for(const [role,table,privilege] of [['averomira_worker','private.operation_jobs','UPDATE'],['authenticated','private.operation_jobs','SELECT'],['averomira_worker','public.rfqs','INSERT']])equal(sql(`select has_table_privilege(${lit(role)},${lit(table)},${lit(privilege)})`),'f',`${role} has no direct ${privilege} on ${table}`);
equal(sql("select has_function_privilege('authenticated','private.operation_claim(uuid,text)','EXECUTE')"),'f','browser cannot invoke worker claim');
equal(sql("select has_function_privilege('averomira_worker','private.operation_storage_access(text,boolean)','EXECUTE')"),'f','migration replay does not grant browser helper to worker');
// Run every accepted synthetic PDF operation through both document publication paths.
let completed=1;
while(completed<100){const j=claim();assert.ok(j,'expected queued job');invoke('operation_reserve_ai',j,['m','fixture-v1',100]);const payload=structuredClone(checkpoint);payload.extraction.document_type=j.type==='po_pdf_process'?'purchase_order':'rfq';invoke('operation_checkpoint',j,[payload]);invoke('operation_publish_document',j);if(j.type==='rfq_pdf_process')invoke('operation_complete_document',j);else invoke('operation_commit_po_reconciliation',j,[[],{},[]]);invoke('operation_finish',j,['succeeded',null,0]);completed++;}
equal(Number(sql("select count(*) from private.operation_jobs where state='succeeded'")),100,'all 100 PDF operations complete');
equal(Number(sql('select (select count(*) from public.rfqs)+(select count(*) from public.purchase_orders)')),100,'100 operations publish exactly 100 domain entities');
equal(Number(sql("select count(*) from public.rfq_lines where review_status='confirmed'")),0,'matching does not confirm customer product choices');
equal(Number(sql("select count(*) from public.purchase_orders where status='approved'")),0,'PO processing does not approve commercial transactions');
// Outbox and support record share the same transaction, even when the provider is down.
const ticket=randomUUID(),message=randomUUID();sql(`insert into public.support_tickets(id,organization_id,created_by,requester_email,category,subject) values(${lit(ticket)},${lit(orgs[0])},${lit(actors[0])},'synthetic@example.invalid','other','Synthetic ticket');insert into public.support_messages(id,ticket_id,organization_id,author_type,body) values(${lit(message)},${lit(ticket)},${lit(orgs[0])},'user','Synthetic message');`);
equal(Number(sql(`select count(*) from private.operation_jobs where operation_key=${lit(message)}`)),1,'support message creates exactly one transactional notification');
const rolled=randomUUID();sql(`begin;insert into public.support_messages(id,ticket_id,organization_id,author_type,body) values(${lit(rolled)},${lit(ticket)},${lit(orgs[0])},'user','Rollback');rollback;`);equal(Number(sql(`select count(*) from private.operation_jobs where operation_key=${lit(rolled)}`)),0,'rolled-back support message has no outbox job');
const support=claim();const frozen={from:'synthetic@example.invalid',to:['synthetic@example.invalid'],subject:'Synthetic',text:'Synthetic'};equal(JSON.parse(invoke('operation_notification_started',support,[frozen])),frozen,'notification payload is durable');equal(JSON.parse(invoke('operation_notification_started',support,[{...frozen,text:'changed'}])),frozen,'retry preserves exact provider idempotency body');invoke('operation_notification_accepted',support,['synthetic-provider-id']);invoke('operation_finish',support,['succeeded',null,0]);
worker('select private.operation_monitor(true);');worker('select private.operation_monitor(true);');equal(Number(sql('select count(*) from private.operation_incidents')),0,'normal recovered errors do not notify founder');
console.log(`Operations native PostgreSQL: ${checks} assertions, 100 document publications, concurrent claims/reservations: PASS`);
