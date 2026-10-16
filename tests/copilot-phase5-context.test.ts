import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { combineOrderCases, loadOrderCases } from "../lib/rivora/order-cases.ts";
import { normalizeCopilotInput, encodeCopilotEvent, decodeCopilotEvent } from "../lib/rivora/copilot-protocol.ts";

const file=(p:string)=>readFileSync(p,"utf8");
const orgA="11111111-1111-4111-8111-111111111111";
const orgB="22222222-2222-4222-8222-222222222222";
const rfqA="aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const rfqB="bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

test("Shared deterministic case projection keeps RFQ-to-quote link, stage and attention",()=>{
  const cases=combineOrderCases({
    rfqs:[{id:rfqA,reference:"R-1",status:"needs_review",received_at:"2026-10-15T10:00:00Z",customers:{name:"Same name"}},
      {id:rfqB,reference:"R-2",status:"ready",received_at:"2026-10-14T10:00:00Z",customers:{name:"Same name"}}],
    quotes:[{id:"cccccccc-cccc-4ccc-8ccc-cccccccccccc",quote_number:"Q-1",status:"ready",
      updated_at:"2026-10-16T12:00:00Z",customers:{name:"Same name"},rfqs:{id:rfqA,reference:"R-1"}}],
    purchaseOrders:[],salesOrders:[],
  },true);
  assert.equal(cases.length,2);
  const quote=cases.find(x=>x.quoteNumber==="Q-1");
  assert.equal(quote?.stage,"quote");
  assert.equal(quote?.attention,true);
  assert.equal(quote?.href,"/app/orders/case/quote/cccccccc-cccc-4ccc-8ccc-cccccccccccc");
  assert.equal(cases.find(x=>x.rfqReference==="R-2")?.stage,"rfq");
});

test("Every table query uses exact server-scoped organization and never admin credentials",async()=>{
  const observed:Array<{table:string,field:string,value:string,limit:number}>=[];
  const db={
    from(table:string) {
      const state={table,field:"",value:"",limit:0};
      return {
        select(_fields:string) { return this; },
        eq(field:string,value:string) { state.field=field;state.value=value;return this; },
        order(_field:string,_opts:unknown) { return this; },
        limit(limit:number){state.limit=limit;return this;},
        abortSignal(_s:AbortSignal){
          observed.push({...state});
          const data=table==="rfqs" ? [{
            id:rfqA,status:"needs_review",reference:"A-ONLY",
            received_at:"2026-10-15T12:00:00Z",customers:{name:"A customer"},
          }] : [];
          return Promise.resolve({data,error:null});
        },
      };
    },
  };
  const output=await loadOrderCases(db as never,orgA,true,{strict:true,detectTruncation:true,signal:new AbortController().signal});
  assert.equal(observed.length,4);
  assert.ok(observed.every(x=>x.field==="organization_id" && x.value===orgA && x.limit===201));
  assert.equal(output.cases.length,1);
  assert.ok(!JSON.stringify(output).includes(orgB));
  assert.doesNotMatch(file("lib/rivora/copilot-context/orders.ts"),/createAdminClient|service_role/);
  assert.doesNotMatch(file("lib/rivora/copilot-context/resolver.ts"),/\.insert\(|\.update\(|\.delete\(/);
});

test("A failed scope query fails closed and is never interpreted as an empty organization", async()=>{
 const db={from(table:string){return {select(){return this;},eq(){return this;},order(){return this;},limit(){return this;},
 abortSignal(){return Promise.resolve({data:[],error:table==="quotes"?{message:"denied"}:null});}};}};
 await assert.rejects(()=>loadOrderCases(db as never,orgA,true,{strict:true}),/COPILOT_CONTEXT_READ_FAILED/);
});

test("Context is explicitly opt-in and rejects malformed source links",()=>{
 const base={question:"Which orders need attention?",history:[],area:"orders"};
 assert.equal(normalizeCopilotInput(base).ok,true);
 const parsed=normalizeCopilotInput({...base,useWorkspaceData:true});
 assert.equal(parsed.ok && parsed.input.useWorkspaceData,true);
 const defaultParsed=normalizeCopilotInput(base);
 assert.equal(defaultParsed.ok && defaultParsed.input.useWorkspaceData,false);
 const source={sourceId:"rfq:"+rfqA,kind:"rfq" as const,recordId:rfqA,label:"R-1",href:"/app/orders/case/rfq/"+rfqA};
 const frame=encodeCopilotEvent({type:"sources",sources:[source],truncated:true}).trim();
 assert.deepEqual(decodeCopilotEvent(frame),{type:"sources",sources:[source],truncated:true});
 assert.equal(decodeCopilotEvent(encodeCopilotEvent({type:"sources",sources:[{...source,href:"https://evil.example.com"}],truncated:false}).trim()),null);
 assert.deepEqual(decodeCopilotEvent('event: stage\ndata: {"type":"stage","stage":"retrieving"}'),{type:"stage",stage:"retrieving"});
});

test("Context boundaries are before provider calls and preserve pricing guard",()=>{
 const route=file("app/api/copilot/stream/route.ts");
 const contextPos=route.indexOf("await resolveCopilotContext(");
 const reservationPos=route.indexOf("await ledger.reserve(");
 const modelPos=route.indexOf("await ai.responses.create(");
 assert.ok(contextPos>0 && reservationPos>contextPos && modelPos>reservationPos);
 assert.match(route,/AVEROMIRA_COPILOT_CONTEXT_ENABLED === "true"/);
 assert.match(route,/useWorkspaceData/);
 assert.match(route,/serializeContextForModel/);
 assert.match(route,/await billing.complete/);
 assert.match(file("lib/rivora/copilot-context/authorization.ts"),/organization_members/);
 assert.match(file("lib/rivora/copilot-context/authorization.ts"),/averomira-active-organization-id/);
 assert.match(file("components/copilot/CopilotConversation.tsx"),/shareWorkspaceData/);
 assert.match(file("components/copilot/CopilotConversation.tsx"),/ml-copilot-context-sources/);
});
