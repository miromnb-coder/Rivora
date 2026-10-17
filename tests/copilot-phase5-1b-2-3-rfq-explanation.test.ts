import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  explainMatchMethod, explainRfq, rfqExplanationSource, serializeRfqExplanation,
} from "../lib/rivora/copilot-context/rfq-explanation.ts";
import type { RfqDataSnapshot, RfqLineSnapshot } from "../lib/rivora/copilot-context/rfq.ts";
import { chooseRfqContextQuery } from "../lib/rivora/copilot-context/rfq-intent.ts";

const RFQ="aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const product="bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const line=(n:number,method:string|null="product_memory"):RfqLineSnapshot=>({
  id:"cccccccc-cccc-4ccc-8ccc-"+n.toString(16).padStart(12,"0"),
  lineNumber:n,customerSku:"EX-"+n,description:"Untrusted <b>raw</b>",
  reviewStatus:n===2?"confirmed":"needs_review",
  selectedProductId:product,matchMethod:method,matchConfidence:97,
  extractionConfidence:0.35,
  candidates:[{productId:product,sku:"ABC-"+n,name:"Part "+n,
    confidence:99,method:"exact_sku",rank:1}],candidatesComplete:true,
});
const snapshot=(lines=[line(1),line(2)]):RfqDataSnapshot=>({
  kind:"rfq_snapshot",rfqId:RFQ,reference:"RFQ-TEST",status:"needs_review",
  sourceType:"pdf",overallConfidence:88,extractionConfidence:0.7,
  extractionWarnings:["Check OCR"],totalLines:lines.length,
  unresolvedLines:Math.max(0,lines.length-1),inspectedLines:lines.length,
  selectedLines:lines.length,allLinesInspected:true,
  quoteExists:false,lines,truncated:false,
  retrievedAt:"2026-10-17T09:00:00.000Z",
});

test("5.1B.2 separates method from approval and confidence",()=>{
  const result=explainRfq(snapshot());
  assert.equal(result.totalLines,2);
  assert.equal(result.unresolvedLines,1);
  assert.equal(result.extractionConfidencePercent,70);
  assert.equal(result.explanations[0]?.confirmedByHuman,false);
  assert.equal(result.explanations[0]?.matchConfidence,97);
  assert.equal(result.explanations[0]?.extractionConfidencePercent,35);
  assert.equal(result.explanations[0]?.nextReview,"check_extraction");
  assert.match(result.explanations[0]?.methodMeaning??"",/no history or prior approver/);
  assert.equal(result.explanations[1]?.confirmedByHuman,true);
  assert.equal(result.explanations[1]?.nextReview,"none");
  const serialized=serializeRfqExplanation(result);
  assert.ok(serialized.modelSnapshot.includes('"humanConfirmed":false'));
  assert.ok(!serialized.modelSnapshot.includes("Untrusted <b>"));
  assert.ok(!serialized.modelSnapshot.includes("verified_at"));
  assert.equal(serialized.sources[0]?.href,"/app/orders/case/rfq/"+RFQ);
  assert.equal(serialized.sources[0]?.sourceId,"rfq:"+RFQ);
});

test("5.1B.2 uses known methods and does not invent unavailable provenance",()=>{
  const names=["exact_sku","exact_mpn","product_memory","customer_memory","fuzzy","manual","catalogue","ai_suggestion"];
  for(const method of names){
    const meaning=explainMatchMethod(method);
    assert.ok(meaning.length>10);
  }
  assert.equal(explainMatchMethod("invented"),explainMatchMethod(null));
  const one=explainRfq(snapshot([line(9,"fuzzy")]),9);
  assert.equal(one.explanations.length,1);
  assert.equal(one.explanations[0]?.lineNumber,9);
  assert.throws(()=>explainRfq(snapshot(),40),/COPILOT_RFQ_LINE_NOT_INSPECTED/);
  assert.equal(rfqExplanationSource(one).recordId,RFQ);
});

test("5.1B.2 bounded model snapshot remains valid JSON with partial flag",()=>{
  const large=Array.from({length:10},(_,idx)=>{
    const l=line(idx+1,"product_memory");
    l.candidates=Array.from({length:3},(_,n)=>({
      productId:product,sku:"S".repeat(95),name:"N".repeat(118),
      confidence:99,method:"product_memory",rank:n+1,
    }));
    return l;
  });
  const sample=snapshot(large);
  const encoded=serializeRfqExplanation(explainRfq(sample));
  const object=JSON.parse(encoded.modelSnapshot) as {
    truncated:boolean;explanations:unknown[];totalLines:number;unresolvedLines:number;
  };
  assert.ok(encoded.modelSnapshot.length<=6000);
  assert.equal(encoded.truncated,true);
  assert.ok(object.explanations.length<10);
  assert.equal(object.totalLines,10);
  assert.equal(object.truncated,true);
});

test("5.1B.3 stays consentful, read-only, and independently gated",()=>{
  const src=(p:string)=>readFileSync(p,"utf8");
  const route=src("app/api/copilot/stream/route.ts");
  const resolver=src("lib/rivora/copilot-context/resolver.ts");
  const authorized=src("lib/rivora/copilot-context/rfq-access.ts");
  const reader=src("lib/rivora/copilot-context/rfq.ts");
  const status=src("app/api/copilot/status/route.ts");
  const protocol=src("lib/rivora/copilot-protocol.ts");
  assert.match(route,/AVEROMIRA_COPILOT_RFQ_INTELLIGENCE_ENABLED === "true"/);
  assert.match(route,/workspaceId === organizationId/);
  assert.match(route,/useWorkspaceData && workspaceId === organizationId/);
  assert.match(route,/await resolveRfqIntelligenceContext\(/);
  assert.match(route,/await billing.complete\(/);
  assert.ok(route.indexOf("await resolveRfqIntelligenceContext(")<route.indexOf("await ledger.reserve("));
  assert.match(resolver,/readAuthorizedRfqSnapshot\(/);
  assert.match(authorized,/await verifyContextMembership\(/);
  assert.match(authorized,/await verifyActiveRecordAccess\(/);
  assert.doesNotMatch(route+authorized+reader,/createAdminClient\(|refresh_rfq_matches_with_memory_server|get_rfq_product_memory_explanations_server|\.insert\(|\.update\(|\.delete\(/);
  assert.match(status,/rfqIntelligenceAvailable = activeRecordAvailable/);
  assert.match(protocol,/CASE_HREF/);
});

test("5.1B.3 RFQ query intent is deterministic, focused and feature gated",()=>{
  const record={kind:"rfq" as const,id:RFQ};
  assert.deepEqual(chooseRfqContextQuery("Miksi riville 4 ehdotettiin tuotetta?",record,true),
    {kind:"rfq_line_explanation",recordId:RFQ,lineNumber:4,limit:10});
  assert.deepEqual(chooseRfqContextQuery("Why did line 9 get this match?",record,true),
    {kind:"rfq_line_explanation",recordId:RFQ,lineNumber:9,limit:10});
  assert.deepEqual(chooseRfqContextQuery("Mikä tämän tarjouspyynnön tilanne on?",record,true),
    {kind:"rfq_review",recordId:RFQ,limit:10});
  assert.equal(chooseRfqContextQuery("Mikä tämän tarjouspyynnön tilanne on?",record,false),null);
  assert.equal(chooseRfqContextQuery("RFQ review",{kind:"po",id:RFQ},true),null);
  assert.equal(chooseRfqContextQuery("Hei",record,true),null);
  assert.equal(chooseRfqContextQuery("Rivi 0",record,true),null);
});
