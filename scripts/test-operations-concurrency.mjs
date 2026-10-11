// Native SQL assertions are added as the worker interfaces stabilize.
// Never accepts a hosted URL; all access is to the fixed local test container.
import {execFileSync} from 'node:child_process';
import assert from 'node:assert/strict';
const sql=(query)=>execFileSync('docker',['--host=unix:///var/run/docker.sock','exec','-i','averomira-catalogue-test','psql','-U','postgres','-d','averomira_test','-At','-v','ON_ERROR_STOP=1'],{input:query,encoding:'utf8',env:{PATH:process.env.PATH}}).trim();
assert.equal(sql("select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='private' and proname='operation_claim'"),'1');
assert.equal(sql("select has_table_privilege('averomira_worker','private.operation_jobs','UPDATE')"),'f');
assert.equal(sql("select has_function_privilege('authenticated','private.operation_claim(uuid,text)','EXECUTE')"),'f');
assert.equal(sql("select has_function_privilege('averomira_worker','private.operation_storage_access(text,boolean)','EXECUTE')"),'f');
console.log('Operations native SQL: 4 security assertions passed');
