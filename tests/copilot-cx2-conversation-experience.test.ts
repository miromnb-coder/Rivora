import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {normalizeCopilotInput} from "../lib/rivora/copilot-protocol.ts";
import {buildCopilotHistory} from "../lib/rivora/copilot-stream.ts";
const uuid="aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const good={question:"Mitä tarjouspyynnölle kuuluu?",history:[],area:"rfq",locale:"fi",
  useWorkspaceData:false,workspaceId:null,activeRecord:null};
test("CX2 protocol keeps legacy clients and accepts bounded IDs",()=>{
 assert.equal(normalizeCopilotInput(good).ok,true);
 const withIDs=normalizeCopilotInput({...good,conversationId:uuid,clientRequestId:uuid});
 assert.equal(withIDs.ok,true);
 if(withIDs.ok){
  assert.equal(withIDs.input.conversationId,uuid);
  assert.equal(withIDs.input.clientRequestId,uuid);
 }
 for(const bad of [
  {conversationId:"../../private"}, {clientRequestId:"some-key"},
  {conversationId:123}, {clientRequestId:[]},
 ]) assert.equal(normalizeCopilotInput({...good,...bad}).ok,false);
});
test("CX2 only completed assistant pairs feed next response",()=>{
 const texts=buildCopilotHistory([
  {role:"user",text:"A"},
  {role:"assistant",text:"B",stage:"done"},
  {role:"user",text:"C"},
  {role:"assistant",text:"Bad answer",stage:"error"},
 ]);
 assert.deepEqual(texts,[{role:"user",text:"A"},{role:"assistant",text:"B"}]);
});
test("CX2 private tables have read-only browser grants and same-user tenant RLS",()=>{
 const sql=readFileSync("supabase/migrations/20261018120000_copilot_conversation_experience_2.sql","utf8");
 for(const name of ["copilot_user_preferences","copilot_conversations","copilot_messages"]){
  assert.match(sql,new RegExp("alter table public\\."+name+" enable row level security"));
  assert.match(sql,new RegExp("owner_user_id|user_id"));
 }
 assert.match(sql,/revoke all on public\.copilot_user_preferences/);
 assert.match(sql,/grant select on public\.copilot_user_preferences/);
 assert.match(sql,/foreign key\(conversation_id,organization_id,owner_user_id\)/);
 assert.match(sql,/unique\(conversation_id,request_id,role\)/);
});
test("CX2 routes forbid cross-origin mutations and server rechecks consent",()=>{
 const api=readFileSync("app/api/copilot/stream/route.ts","utf8");
 const route=readFileSync("app/api/copilot/conversations/route.ts","utf8");
 const pref=readFileSync("app/api/copilot/preferences/route.ts","utf8");
 const item=readFileSync("app/api/copilot/conversations/[id]/route.ts","utf8");
 assert.match(api,/loadCx2Preferences/);
 assert.match(api,/loadCx2History/);
 assert.match(api,/COPILOT_DUPLICATE_REQUEST/);
 assert.ok(api.indexOf("beginCx2Turn(")<api.indexOf("await ledger.reserve("));
 assert.ok(api.indexOf("await billing.complete(")<api.indexOf("await finishCx2Turn("));
 for(const body of [route,pref,item])assert.match(body,/validWriteOrigin\(/);
 assert.match(route,/verifyActiveRecordAccess/);
 assert.match(item,/findCx2Conversation/);
});
test("CX2 no auto-production activation, no automatic retention claims",()=>{
 const status=readFileSync("app/api/copilot/status/route.ts","utf8");
 const auth=readFileSync("lib/rivora/copilot-conversations/auth.ts","utf8");
 const repo=readFileSync("lib/rivora/copilot-conversations/repository.ts","utf8");
 const ui=readFileSync("components/copilot/CopilotConversation.tsx","utf8");
 assert.match(auth,/AVEROMIRA_COPILOT_CX2_ENABLED==="true"/);
 assert.match(auth,/AVEROMIRA_COPILOT_HISTORY_ENABLED==="true"/);
 assert.match(auth,/AVEROMIRA_COPILOT_PERSISTENT_CONSENT_ENABLED==="true"/);
 assert.match(status,/cx2Enabled/);
 assert.match(repo,/\.eq\("organization_id",c.workspace.id\)/);
 assert.match(repo,/\.eq\("owner_user_id",c.claims.sub\)/);
 assert.match(ui,/setActiveConversationId\(last.id\)/);
 assert.match(ui,/!cx2Enabled && contextAvailable/);
 const docs=readFileSync("docs/copilot/CX2_MIGRATION_READINESS.md","utf8");
 assert.match(docs,/Do not run against production/);
});
