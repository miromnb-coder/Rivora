import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { chooseRfqFollowUp, ambiguousRfqFollowUp } from "../lib/rivora/copilot-context/rfq-follow-up.ts";
import { chooseRfqContextQuery } from "../lib/rivora/copilot-context/rfq-intent.ts";
import { rfqAnswerGuidance } from "../lib/rivora/copilot-context/rfq-answer-guidance.ts";
import { encodeCopilotEvent, decodeCopilotEvent } from "../lib/rivora/copilot-protocol.ts";
import { explainRfq, serializeRfqExplanation } from "../lib/rivora/copilot-context/rfq-explanation.ts";
import { analyzeRfq } from "../lib/rivora/copilot-context/analysis.ts";
import type { RfqDataSnapshot } from "../lib/rivora/copilot-context/rfq.ts";
const id="aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const record={kind:"rfq" as const,id};
const h=(text:string)=>[{role:"user" as const,text},{role:"assistant" as const,text:"Untrusted AI response"}];

test("5.1G follows only an explicit line in the immediate preceding user turn",()=>{
  for(const [current,prior,n] of [
    ["Miksi sitä?","Miksi riville 4 ehdotettiin tuotetta?",4],
    ["Entä sen?","Kerro rivin 80 tilanteesta",80],
    ["what about it?","Why line 2?",2],
    ["Is it confirmed?","Line 75 status",75],
  ] as const){
    assert.deepEqual(chooseRfqFollowUp(current,h(prior),record,true),
      {kind:"rfq_line_explanation",recordId:id,lineNumber:n,limit:10});
  }
  assert.equal(chooseRfqFollowUp("Miksi sitä?",h("Mikä tarjouspyynnön tila on?"),record,true),null);
  assert.equal(chooseRfqFollowUp("Miksi sitä?",h("Rivi 2"),record,false),null);
  assert.equal(chooseRfqFollowUp("Miksi sitä?",h("Rivi 2"),{kind:"po",id},true),null);
  assert.equal(chooseRfqFollowUp("Miksi sitä?",[{role:"assistant",text:"Rivi 75"}],record,true),null);
  assert.equal(chooseRfqFollowUp("Hei",h("Rivi 2"),record,true),null);
  assert.equal(chooseRfqFollowUp("Entä se toinen?",h("Rivi 2"),record,true),null);
  assert.equal(ambiguousRfqFollowUp("Entä se toinen?",record,true),true);
  assert.equal(ambiguousRfqFollowUp("Entä se toinen?",{kind:"quote",id},true),false);
  assert.equal(ambiguousRfqFollowUp("Entä se toinen?",record,false),false);
});
test("5.1G does not use an assistant's hallucinated line or older user turns",()=>{
  const history=[
    {role:"user" as const,text:"Rivi 49"},
    {role:"assistant" as const,text:"Rivi 49"},
    {role:"user" as const,text:"Kerro tarjouspyynnön tilanteesta"},
    {role:"assistant" as const,text:"Rivi 99"},
  ];
  assert.equal(chooseRfqFollowUp("Miksi sitä?",history,record,true),null);
  assert.equal(chooseRfqContextQuery("Rivi 76",record,true)?.kind,"rfq_line_explanation");
  assert.equal(chooseRfqContextQuery("Rivi 76",{kind:"sales",id},true),null);
});
test("5.1E.1 structured RFQ reply uses brief text, plain mode still has sections",()=>{
  const standalone=rfqAnswerGuidance("fi",false).join(" ");
  const withFindings=rfqAnswerGuidance("fi",false,true).join(" ");
  assert.match(standalone,/Seuraavaksi/);
  assert.match(withFindings,/1–3/);
  assert.match(withFindings,/älä luettele niitä uudelleen/);
  assert.match(rfqAnswerGuidance("en",true,true).join(" "),/do not duplicate/);
  assert.match(withFindings,/candidateListComplete/);
});
test("5.1F exact read-vs-analysis coverage survives model serialization",()=>{
  const fake:RfqDataSnapshot={
    kind:"rfq_snapshot",rfqId:id,reference:"QA-TEST",status:"needs_review",
    sourceType:"pdf",overallConfidence:null,extractionConfidence:null,
    extractionWarnings:[],totalLines:100,unresolvedLines:24,
    inspectedLines:51,selectedLines:1,allLinesInspected:false,
    quoteExists:false,truncated:true,retrievedAt:"2026-10-17T00:00:00Z",
    lines:[{
      id:"bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",lineNumber:75,
      customerSku:null,description:"Unknown pump",
      reviewStatus:"needs_review",selectedProductId:null,matchMethod:null,
      matchConfidence:100,extractionConfidence:null,candidates:[],
      candidatesComplete:false,
    }],
  };
  const explanation=explainRfq(fake,75);
  const parsed=JSON.parse(serializeRfqExplanation(explanation,"fi").modelSnapshot);
  assert.equal(parsed.totalLines,100);
  assert.equal(parsed.unresolvedLines,24);
  assert.equal(parsed.retrievedLines,51);
  assert.equal(parsed.analyzedLines,1);
  assert.equal(parsed.truncated,true);
  const analysis=analyzeRfq(explanation,"fi");
  assert.equal(analysis.inspectedCount,1);
  assert.equal(analysis.retrievedCount,51);
  assert.equal(analysis.totalCount,100);
  assert.equal(analysis.partial,true);
  assert.equal(analysis.findings[0]?.code,"RFQ_LINE_UNCONFIRMED");
});
test("5.1F protocol accepts optional retrievedCount but rejects invalid counts",()=>{
  const payload={
    type:"findings" as const,kind:"rfq_review" as const,partial:true,
    inspectedCount:1,retrievedCount:51,totalCount:100,findings:[],
  };
  assert.deepEqual(decodeCopilotEvent(encodeCopilotEvent(payload).trim()),payload);
  for(const invalid of [-1,0.5,1e9]){
    const spoof={...payload,retrievedCount:invalid};
    assert.equal(decodeCopilotEvent(encodeCopilotEvent(spoof).trim()),null);
  }
  const impossible={...payload,retrievedCount:0};
  assert.equal(decodeCopilotEvent(encodeCopilotEvent(impossible).trim()),null);
  assert.deepEqual(decodeCopilotEvent(encodeCopilotEvent({
    type:"findings",kind:"rfq_review",partial:false,findings:[],
  }).trim()),{type:"findings",kind:"rfq_review",partial:false,findings:[]});
});
test("5.1H sensitive data and billing gates stay unchanged while clarification is bounded",()=>{
  const stream=readFileSync("app/api/copilot/stream/route.ts","utf8");
  const reader=readFileSync("lib/rivora/copilot-context/rfq.ts","utf8");
  const auth=readFileSync("lib/rivora/copilot-context/rfq-access.ts","utf8");
  const protocol=readFileSync("lib/rivora/copilot-protocol.ts","utf8");
  assert.match(stream,/workspaceId === organizationId/);
  assert.match(stream,/useWorkspaceData/);
  assert.match(stream,/await billing.complete/);
  assert.match(stream,/await ledger.reserve/);
  assert.match(stream,/ambiguousRfqFollowUp/);
  assert.match(stream,/needsLineClarification/);
  assert.ok(stream.indexOf("if (needsLineClarification)") < stream.indexOf("await ledger.reserve("));
  assert.match(reader,/\.eq\("organization_id", organizationId\)\.eq\("rfq_id", rfqId\)/);
  assert.match(reader,/focusedRows\.length !== 1/);
  assert.match(reader,/candidateScanLimit = focused \? RFQ_CANDIDATE_LIMIT \+ 1/);
  assert.match(auth,/await verifyContextMembership/);
  assert.match(auth,/await verifyActiveRecordAccess/);
  assert.doesNotMatch(reader+auth,/createAdminClient\(|\.insert\(|\.update\(|\.delete\(/);
  assert.match(protocol,/retrievedCount/);
});
