import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { orderPriorityReason,analyzeRfq } from "../lib/rivora/copilot-context/analysis.ts";
import { explainRfq } from "../lib/rivora/copilot-context/rfq-explanation.ts";
import { verifiedFindingLink } from "../lib/rivora/copilot-finding-navigation.ts";
import { buildVerifiedFindingsEvent } from "../lib/rivora/copilot-context/findings-event.ts";
import { encodeCopilotEvent,decodeCopilotEvent } from "../lib/rivora/copilot-protocol.ts";
import type { ContextSource } from "../lib/rivora/copilot-context/types.ts";
import type { RfqDataSnapshot } from "../lib/rivora/copilot-context/rfq.ts";
import type { DeterministicAnalysis } from "../lib/rivora/copilot-context/analysis.ts";

const rfqId="aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const source:ContextSource={kind:"rfq",recordId:rfqId,sourceId:"rfq:"+rfqId,
  label:"QA-RFQ",href:"/app/orders/case/rfq/"+rfqId};

test("5.1E order explanations differ by verified stored stage and status",()=>{
  const failure=orderPriorityReason({stage:"erp",stageStatus:"erp_failed"},"fi");
  const partial=orderPriorityReason({stage:"erp",stageStatus:"erp_partial"},"fi");
  const po=orderPriorityReason({stage:"po",stageStatus:"needs_review"},"fi");
  const rfq=orderPriorityReason({stage:"rfq",stageStatus:"needs_review"},"fi");
  const english=orderPriorityReason({stage:"quote",stageStatus:"draft"},"en");
  assert.match(failure,/epäonnistunut/);
  assert.match(partial,/osittain/);
  assert.match(po,/Ostotilaus/);
  assert.match(rfq,/Tarjouspyyntö/);
  assert.match(english,/draft/i);
  assert.notEqual(failure,partial);
  assert.notEqual(po,rfq);
  assert.doesNotMatch(failure,/määräaikaan/);
});

function snapshot(statuses:string[],confidence:Array<number|null>):RfqDataSnapshot {
  return {
    kind:"rfq_snapshot",rfqId,reference:"QA-RFQ",status:"needs_review",
    sourceType:"pdf",overallConfidence:100,extractionConfidence:99,
    extractionWarnings:[],totalLines:statuses.length,
    unresolvedLines:statuses.filter(s=>s!=="confirmed").length,
    inspectedLines:statuses.length,selectedLines:statuses.length,
    allLinesInspected:true,quoteExists:false,truncated:false,
    retrievedAt:"2026-10-17T10:00:00Z",
    lines:statuses.map((status,i)=>({
      id:"bbbbbbbb-bbbb-4bbb-8bbb-"+(i+1).toString(16).padStart(12,"0"),
      lineNumber:i+1,customerSku:"QA-"+(i+1),description:"Test",
      reviewStatus:status,selectedProductId:null,matchMethod:null,
      matchConfidence:100,extractionConfidence:confidence[i]??null,
      candidates:[],candidatesComplete:false,
    })),
  };
}
test("5.1E production RFQ-like 1 confirmed + 1 unmatched yields only one needed match",()=>{
  const rfq=explainRfq(snapshot(["confirmed","unmatched"],[99,null]));
  const findings=analyzeRfq(rfq,"fi");
  assert.equal(rfq.totalLines,2);
  assert.equal(rfq.unresolvedLines,1);
  assert.equal(findings.findings.length,1);
  assert.equal(findings.findings[0]?.code,"RFQ_LINE_UNMATCHED");
  assert.match(findings.findings[0]?.explanation??"",/Muitakin ehdokkaita voi olla/);
  assert.equal(findings.findings[0]?.sourceId,"rfq:"+rfqId);
});
test("5.1E production RFQ-like 2 pending rows, 100 percent match confidence, still require confirmation",()=>{
  const rfq=explainRfq(snapshot(["needs_review","matched"],[99,99]));
  const analysis=analyzeRfq(rfq,"fi");
  assert.equal(rfq.unresolvedLines,2);
  assert.deepEqual(analysis.findings.map(x=>x.code),[
    "RFQ_LINE_UNCONFIRMED","RFQ_LINE_UNCONFIRMED"]);
  assert.notEqual(analysis.findings[0]?.explanation,analysis.findings[1]?.explanation);
  assert.ok(analysis.findings[0]?.suggestedAction!==analysis.findings[1]?.suggestedAction);
  assert.ok(analysis.findings.every(f=>!f.explanation.includes("vahvistettu osuma")));
});

test("5.1E low-confidence extraction has a factual percentage but never an invented compatibility claim",()=>{
  const rfq=explainRfq(snapshot(["needs_review"],[0.35]));
  const analysis=analyzeRfq(rfq,"fi");
  const extraction=analysis.findings.find(f=>f.code==="RFQ_EXTRACTION_UNCERTAIN");
  assert.match(extraction?.explanation??"",/35 %/);
  assert.ok(analysis.findings.every(f=>!f.explanation.includes("yhteensopiva")));
});

test("5.1E scoped row links are built only from trusted record IDs and deterministic line IDs",()=>{
  const direct=verifiedFindingLink(source,"RFQ_LINE_UNCONFIRMED:2");
  assert.deepEqual(direct,{href:"/app/rfq/"+rfqId+"#rfq-line-2",lineNumber:2});
  assert.equal(verifiedFindingLink(source,"RFQ_EXTRACTION_UNCERTAIN:1").lineNumber,1);
  assert.deepEqual(verifiedFindingLink(source,"RFQ_REVIEW_REMAINING:rfq"),
    {href:source.href,lineNumber:null});
  assert.equal(verifiedFindingLink(source,"RFQ_LINE_UNMATCHED:0").lineNumber,null);
  assert.equal(verifiedFindingLink(source,"RFQ_LINE_UNMATCHED:10001").lineNumber,null);
  assert.equal(verifiedFindingLink(source,"RFQ_LINE_UNMATCHED:1#x").lineNumber,null);
  assert.deepEqual(verifiedFindingLink({...source,href:"https://example.com/other"},"RFQ_LINE_UNMATCHED:1"),
    {href:"",lineNumber:null});
  assert.deepEqual(verifiedFindingLink({...source,recordId:"../foo"},"RFQ_LINE_UNMATCHED:1"),
    {href:"",lineNumber:null});
});
test("5.1E findings keep numeric coverage and still reject invalid counts",()=>{
  const analysis:DeterministicAnalysis={
    kind:"rfq_review",inspectedCount:2,totalCount:5,partial:true,findings:[{
      id:"RFQ_LINE_UNMATCHED:2",code:"RFQ_LINE_UNMATCHED",
      title:"Rivi 2: osuma puuttuu",explanation:"Vahvistus puuttuu",suggestedAction:"Tarkista",
      priority:90,severity:"high",sourceId:"rfq:"+rfqId,
    }],
  };
  const event=buildVerifiedFindingsEvent(analysis,[source]);
  assert.equal(event?.inspectedCount,2);
  assert.equal(event?.totalCount,5);
  assert.deepEqual(decodeCopilotEvent(encodeCopilotEvent(event!).trim()),event);
  for(const invalid of [-1,10001,1.5,NaN]){
    const spoof={...event,inspectedCount:invalid};
    assert.equal(decodeCopilotEvent(encodeCopilotEvent(spoof!).trim()),null);
  }
  const broken={...event,totalCount:-1};
  assert.equal(decodeCopilotEvent(encodeCopilotEvent(broken!).trim()),null);
});

test("5.1E preview remains read-only and summary copy is conditional on verified structured findings",()=>{
  const route=readFileSync("app/api/copilot/stream/route.ts","utf8");
  const screen=readFileSync("components/copilot/CopilotConversation.tsx","utf8");
  const page=readFileSync("app/app/rfq/[id]/page.tsx","utf8");
  assert.match(route,/const structuredFindingsVisible = analysis !== null/);
  assert.match(route,/AVEROMIRA_COPILOT_FINDINGS_UI_ENABLED === "true"/);
  assert.match(route,/do not repeat the full findings list/);
  assert.match(screen,/verifiedFindingLink\(source,item.id\)/);
  assert.match(screen,/ml-copilot-findings-coverage/);
  assert.match(page,/id=\{`rfq-line-\$\{line.line_number\}`\}/);
  assert.doesNotMatch(route,/createAdminClient|\.insert\(|\.update\(|\.delete\(/);
});
