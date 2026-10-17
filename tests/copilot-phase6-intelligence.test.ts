import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {choosePhase6Intent,choosePhase6Line,choosePhase6FollowUpIntent} from "../lib/rivora/copilot-intelligence/intent-router.ts";
import {validatedPhase6Facts,serializePhase6Evidence,verifiedEvidenceEvent} from "../lib/rivora/copilot-intelligence/evidence.ts";
import {encodeCopilotEvent,decodeCopilotEvent} from "../lib/rivora/copilot-protocol.ts";
import type {Phase6Evidence} from "../lib/rivora/copilot-intelligence/types.ts";
const org="aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const rec={kind:"rfq" as const,id:org};
const src={kind:"rfq" as const,recordId:org,sourceId:"rfq:"+org,label:"Test RFQ",href:"/app/orders/case/rfq/"+org};
function data():Phase6Evidence {
 return {kind:"memory_provenance",retrievedAt:"2026-10-17T12:00:00Z",
   facts:[{factId:"MEMORY_USAGE_FOUND:1",code:"MEMORY_USAGE_FOUND",sourceId:src.sourceId,
     detail:"Muistivastinetta käytettiin: 2026-10-16",verification:"verified_record"}],
   sources:[src],partial:false,limitations:[]};
}
test("6.0 deterministic intent allows memory and relation questions only inside current RFQ",()=>{
 assert.equal(choosePhase6Intent("Miksi riville 1 ehdotettiin tätä tuotetta?",rec,true),"memory_provenance");
 assert.equal(choosePhase6Intent("Onko tästä tarjous ja ostotilaus?",rec,true),"business_chain");
 assert.equal(choosePhase6Intent("Vertaile tarjoukset",rec,true),"business_comparison");
 assert.equal(choosePhase6Intent("Onko tästä tarjous?",rec,false),null);
 assert.equal(choosePhase6Intent("Onko tästä tarjous?",{kind:"po",id:org},true),null);
 assert.equal(choosePhase6Intent("Hei",rec,true),null);
 assert.equal(choosePhase6Intent("A".repeat(1201),rec,true),null);
});
test("6.4 bounded follow-ups never derive business context from assistant prose",()=>{
 assert.equal(choosePhase6Line("Miksi riville 75 ehdotettiin tuotetta?",[]),75);
 assert.equal(choosePhase6Line("Miksi sitä?",[
   {role:"user",text:"Rivi 2"},{role:"assistant",text:"Rivi 999"}]),2);
 assert.equal(choosePhase6Line("Miksi sitä?",[{role:"assistant",text:"Rivi 1"}]),null);
 assert.equal(choosePhase6Line("Entä sitten?",[{role:"user",text:"Rivi 2"}]),null);
 assert.equal(choosePhase6FollowUpIntent("Vertaa niitä",[
   {role:"user",text:"Mitä tarjouksille tapahtui?"}],rec,true),"business_comparison");
 assert.equal(choosePhase6FollowUpIntent("Vertaa niitä",[
   {role:"assistant",text:"Tarjoukset"}],rec,true),null);
 assert.equal(choosePhase6FollowUpIntent("Vertaa niitä",[
   {role:"user",text:"Mitä tarjouksille tapahtui?"}],rec,false),null);
});
test("6.3 facts are source-verified, bounded, sanitized and never use model URLs",()=>{
 const a=data();assert.equal(validatedPhase6Facts(a),true);
 const payload=serializePhase6Evidence(a);
 assert.ok(payload.includes("MEMORY_USAGE_FOUND"));
 assert.ok(!payload.includes(org)); // model sees sourceId only, not leaked organization ID
 const event=verifiedEvidenceEvent(a,[src]);assert.equal(event?.facts.length,1);
 const missing=verifiedEvidenceEvent(a,[]);assert.equal(missing,null);
 assert.equal(validatedPhase6Facts({...a,sources:[]}),false);
 assert.equal(validatedPhase6Facts({...a,facts:[{...a.facts[0],sourceId:"rfq:bad"}]}),false);
 assert.equal(validatedPhase6Facts({...a,sources:[{...src,href:"https://evil.example"}]}),false);
});
test("6.5 evidence SSE schema and malicious frames are rejected",()=>{
 const e=verifiedEvidenceEvent(data(),[src]);assert.ok(e);
 assert.deepEqual(decodeCopilotEvent(encodeCopilotEvent(e!).trim()),e);
 assert.equal(decodeCopilotEvent(encodeCopilotEvent({...e!,facts:[{...e!.facts[0],sourceId:"invalid"}]}).trim()),null);
 assert.equal(decodeCopilotEvent(encodeCopilotEvent({...e!,limitations:["x".repeat(141)]}).trim()),null);
 assert.equal(decodeCopilotEvent(encodeCopilotEvent({...e!,facts:[{...e!.facts[0],code:"UNKNOWN"}]}).trim()),null);
});
test("6.1 memory provenance never calls service_role RPC or changes memory",()=>{
 const reader=readFileSync("lib/rivora/copilot-intelligence/reader.ts","utf8");
 assert.match(reader,/verifyContextMembership/);
 assert.match(reader,/verifyActiveRecordAccess/);
 assert.match(reader,/workspace_memory_usage_events/);
 assert.match(reader,/memory_target_entity_id/);
 assert.match(reader,/source_entity_type","rfq_line"/);
 assert.match(reader,/\.eq\("organization_id",organizationId\)/);
 assert.doesNotMatch(reader,/createAdminClient\(|\.rpc\(|\.insert\(|\.update\(|\.delete\(/);
});
test("6.2 relations rely on explicit RFQ and quote foreign keys, not customer names",()=>{
 const reader=readFileSync("lib/rivora/copilot-intelligence/reader.ts","utf8");
 assert.match(reader,/\.eq\("rfq_id",rfqId\)/);
 assert.match(reader,/\.in\("quote_id",ids\)/);
 assert.match(reader,/row\.customer_id!==root\.customer_id/);
 assert.match(reader,/MAX_QUOTES=3,MAX_PO=2,MAX_SALES=2/);
 assert.doesNotMatch(reader,/\.ilike\(|\.textSearch\(|similarity\(/);
});
test("6.6 feature gates, settling order, streaming and customer isolation remain fail-closed",()=>{
 const route=readFileSync("app/api/copilot/stream/route.ts","utf8");
 const u=readFileSync("components/copilot/CopilotConversation.tsx","utf8");
 assert.match(route,/AVEROMIRA_COPILOT_PHASE6_ENABLED === "true"/);
 assert.match(route,/AVEROMIRA_COPILOT_MEMORY_EVIDENCE_ENABLED === "true"/);
 assert.match(route,/AVEROMIRA_COPILOT_MULTISOURCE_ENABLED === "true"/);
 assert.match(route,/useWorkspaceData && workspaceId === organizationId/);
 assert.match(route,/await billing.complete\(completedUsage, completedResponseId\)/);
 assert.ok(route.indexOf("await billing.complete(")<route.indexOf("verifiedEvidenceEvent("));
 assert.match(route,/process\.env\.AVEROMIRA_COPILOT_DETERMINISTIC_ANALYSIS_ENABLED/);
 assert.match(route,/const limits = prepareCopilotPricing\(instructions, input\)/);
 assert.match(u,/message\.stage === "done" &&\s*message\.evidence/);
});
