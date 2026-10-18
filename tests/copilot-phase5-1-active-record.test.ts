import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  isActiveRecordUuid, normalizeActiveRecord, parseActiveRecordPath, verifyActiveRecordAccess,
} from "../lib/rivora/copilot-context/active-record.ts";
import { normalizeCopilotInput } from "../lib/rivora/copilot-protocol.ts";

const rfqId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const orgA = "11111111-1111-4111-8111-111111111111";
const orgB = "22222222-2222-4222-8222-222222222222";
const kinds = {
  rfq: "rfqs", quote: "quotes", po: "purchase_orders", sales: "sales_order_drafts",
} as const;

test("5.1A recognizes only exact allowlisted direct and case routes", () => {
  for (const [kind, path] of Object.entries({
    rfq: "/app/rfq/", quote: "/app/quotes/",
    po: "/app/purchase-orders/", sales: "/app/sales-orders/",
  })) assert.deepEqual(parseActiveRecordPath(path + rfqId), {kind,id:rfqId});
  for (const kind of Object.keys(kinds))
    assert.deepEqual(parseActiveRecordPath("/app/orders/case/" + kind + "/" + rfqId), {kind,id:rfqId});
  for (const path of [
    "/app/orders", "/app/rfq/not-a-uuid", "/app/customers/" + rfqId,
    "/app/orders/case/invoice/" + rfqId, "/app/rfq/" + rfqId + "/edit",
    "//evil.invalid/app/rfq/" + rfqId, "/app/rfq/" + rfqId + "?source=evil",
  ]) assert.equal(parseActiveRecordPath(path),null);
  assert.equal(isActiveRecordUuid("invalid"),false);
  assert.equal(normalizeActiveRecord({kind:"rfq",id:rfqId,href:"https://evil.invalid"}),null);
});

test("5.1A protocol validates workspace and optional active record hints",()=>{
  const base={question:"Review this RFQ",history:[],area:"rfq",useWorkspaceData:true,workspaceId:orgA};
  const parsed=normalizeCopilotInput({...base,activeRecord:{kind:"rfq",id:rfqId}});
  assert.equal(parsed.ok,true);
  if (parsed.ok) {
    assert.deepEqual(parsed.input.activeRecord,{kind:"rfq",id:rfqId});
    assert.equal(parsed.input.workspaceId,orgA);
  }
  for (const bad of [
    {kind:"rfq",id:"invalid"},
    {kind:"product",id:rfqId},
    {kind:"rfq",id:rfqId,extra:"not allowed"}, "hello",
  ]) assert.equal(normalizeCopilotInput({...base,activeRecord:bad}).ok,false);
  assert.equal(normalizeCopilotInput({...base,workspaceId:"not-uuid"}).ok,false);
  const legacy=normalizeCopilotInput({question:"What is an RFQ?",history:[],area:"overview"});
  assert.equal(legacy.ok,true);
  if (legacy.ok) assert.equal(legacy.input.activeRecord,null);
});

test("5.1A JWT scoped record verification requires exact table, record and org",async()=>{
  for (const [kind,table] of Object.entries(kinds)) {
    const observed: Array<{table:string,filters:Record<string,string>}> = [];
    const db={
      from(name:string) {
        const filters:Record<string,string>={};
        return {
          select(fields:string){assert.equal(fields,"id");return this;},
          eq(field:string,value:string){filters[field]=value;return this;},
          abortSignal(signal:AbortSignal){assert.equal(signal.aborted,false);return this;},
          async maybeSingle(){
            observed.push({table:name,filters:{...filters}});
            return {data:filters.organization_id===orgA?{id:rfqId}:null,error:null};
          },
        };
      },
    };
    const record={kind:kind as keyof typeof kinds,id:rfqId};
    await verifyActiveRecordAccess(db as never,orgA,record,new AbortController().signal);
    assert.deepEqual(observed,[{table,filters:{organization_id:orgA,id:rfqId}}]);
    await assert.rejects(
      verifyActiveRecordAccess(db as never,orgB,record,new AbortController().signal),
      /CONTEXT_RECORD_UNAVAILABLE/,
    );
  }
  const failed={from(){return {select(){return this;},eq(){return this;},
    abortSignal(){return this;},async maybeSingle(){return {data:null,error:{code:"PGRST"}};}}}};
  await assert.rejects(verifyActiveRecordAccess(failed as never,orgA,
    {kind:"rfq",id:rfqId},new AbortController().signal),/CONTEXT_RECORD_UNAVAILABLE/);
  const aborted=new AbortController();aborted.abort();
  await assert.rejects(verifyActiveRecordAccess(failed as never,orgA,
    {kind:"rfq",id:rfqId},aborted.signal),/CONTEXT_RECORD_UNAVAILABLE/);
  assert.notEqual(orgA,orgB);
});

test("5.1A is default OFF and cannot inject record IDs into model input",()=>{
  const read=(path:string)=>readFileSync(path,"utf8");
  const route=read("app/api/copilot/stream/route.ts");
  const active=read("lib/rivora/copilot-context/active-record.ts");
  const frame=read("components/workspace/WorkspaceFrame.tsx");
  assert.match(route,/AVEROMIRA_COPILOT_ACTIVE_RECORD_ENABLED === "true"/);
  assert.match(route,/AVEROMIRA_COPILOT_CONTEXT_ENABLED === "true"/);
  assert.match(route,/await verifyActiveRecordAccess\(/);
  assert.ok(route.indexOf("await verifyActiveRecordAccess(")<route.indexOf("await ledger.reserve("));
  assert.doesNotMatch(active,/createAdminClient|\.insert\(|\.update\(|\.delete\(/);
  // Conversation identity is workspace scoped; the legacy component itself
  // still clears on route changes while CX2 persists and resumes.
  assert.match(frame,/key=\{workspaceId \?\? ""\}/);
  assert.match(read("components/copilot/CopilotConversation.tsx"),/if\(cx2Enabled\)return/);
  assert.match(read("components/copilot/CopilotConversation.tsx"),/parseActiveRecordPath\(pathname\)/);
  assert.match(read("app/api/copilot/status/route.ts"),/activeRecordAvailable/);
  assert.match(read("app/app/layout.tsx"),/workspaceId=\{workspace.id\}/);
  assert.match(route,/workspaceId !== organizationId/);
  assert.doesNotMatch(route,/serializeContextForModel\(activeRecord\)/);
});
