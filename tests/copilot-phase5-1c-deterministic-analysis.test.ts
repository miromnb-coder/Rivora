import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  analyzeRfq,orderPriorityRule,prioritizeOrderCases,serializeAnalysis,
} from "../lib/rivora/copilot-context/analysis.ts";
import { explainRfq } from "../lib/rivora/copilot-context/rfq-explanation.ts";
import type { RfqDataSnapshot } from "../lib/rivora/copilot-context/rfq.ts";
import type { CaseRow } from "../lib/rivora/order-cases.ts";

const rfq="aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const make=(n:number,stage:CaseRow["stage"],status:string,date:string):CaseRow=>({
  key:"case-"+n,customer:"Test customer",rfqReference:"RFQ-"+n,
  quoteNumber:null,poNumber:null,stage,stageStatus:status,
  stageLabel:"Localized display label",nextAction:"Open item",
  attention:stage!=="done",href:"/app/orders/case/"+(
    stage==="erp"||stage==="done"?"sales":stage)+"/"+"bbbbbbbb-bbbb-4bbb-8bbb-"+n.toString(16).padStart(12,"0"),
  updatedAt:date,
});

test("5.1C ranking uses recorded statuses, not translated text or random urgency",()=>{
  const cases=[
    make(1,"rfq","needs_review","2026-10-16T10:00:00Z"),
    make(2,"erp","erp_failed","2026-10-17T10:00:00Z"),
    make(3,"po","matched","2026-10-15T10:00:00Z"),
    make(4,"done","erp_created","2026-10-17T11:00:00Z"),
    make(5,"quote","draft","2026-10-14T10:00:00Z"),
    make(6,"erp","erp_partial","2026-10-15T10:00:00Z"),
    make(7,"po","needs_review","2026-10-16T10:00:00Z"),
  ];
  const {chosen,analysis}=prioritizeOrderCases(cases,"fi",5,false);
  assert.deepEqual(chosen.map(x=>x.key),["case-6","case-2","case-7","case-1","case-5"]);
  assert.deepEqual(analysis.findings.map(x=>x.priority),[100,100,85,80,65]);
  assert.equal(analysis.partial,true);
  assert.equal(analysis.totalCount,null);
  assert.equal(analysis.inspectedCount,7);
  assert.equal(analysis.findings[0]?.code,"ORDER_ERP_FAILURE");
  assert.ok(analysis.findings.every(x=>x.sourceId.includes(":")));
  assert.equal(orderPriorityRule({stage:"erp",stageStatus:"unknown"}),null);
  assert.equal(orderPriorityRule({stage:"done",stageStatus:"erp_created"}),null);
});
test("5.1C stable order ranking includes older item first when score ties",()=>{
  const first=make(2,"erp","erp_failed","2026-10-17T10:00:00Z");
  const older=make(1,"erp","erp_failed","2026-10-15T10:00:00Z");
  const p=prioritizeOrderCases([first,older],"en",5,false);
  assert.deepEqual(p.chosen.map(x=>x.key),["case-1","case-2"]);
  assert.equal(p.analysis.partial,false);
  assert.equal(p.analysis.findings.length,2);
  const bound=prioritizeOrderCases([first,older],"en",5,true);
  assert.equal(bound.analysis.partial,true);
});
test("5.1C unsupported statuses and completed orders never produce invented actions",()=>{
  const list=[make(1,"erp","erp_created","bad"),make(2,"quote","sent","bad"),
    make(3,"rfq","unknown","bad")];
  const v=prioritizeOrderCases(list,"fi",5,false);
  assert.equal(v.chosen.length,0);
  assert.equal(v.analysis.inspectedCount,3);
  assert.equal(v.analysis.totalCount,null);
  assert.throws(()=>prioritizeOrderCases(list,"fi",11,false),/COPILOT_ANALYSIS_INVALID_LIMIT/);
});
const base: RfqDataSnapshot={
  kind:"rfq_snapshot",rfqId:rfq,reference:"RFQ-TEST",status:"needs_review",
  sourceType:"csv",overallConfidence:null,extractionConfidence:null,extractionWarnings:[],
  totalLines:2,unresolvedLines:1,inspectedLines:2,selectedLines:2,
  allLinesInspected:true,quoteExists:false,truncated:false,
  retrievedAt:"2026-10-17T10:00:00Z",
  lines:[
    {id:"bbbbbbbb-bbbb-4bbb-8bbb-000000000001",lineNumber:1,
      customerSku:"1896-S",description:"Desk",reviewStatus:"confirmed",selectedProductId:null,
      matchMethod:"manual",matchConfidence:99,extractionConfidence:null,
      candidates:[],candidatesComplete:true},
    {id:"bbbbbbbb-bbbb-4bbb-8bbb-000000000002",lineNumber:2,
      customerSku:"PO-2",description:"Pump",reviewStatus:"unmatched",selectedProductId:null,
      matchMethod:null,matchConfidence:null,extractionConfidence:0.32,
      candidates:[],candidatesComplete:false},
  ],
};
test("5.1C RFQ findings distinguish confirmed and missing products without inventing candidate absence",()=>{
  const found=analyzeRfq(explainRfq(base),"fi");
  assert.equal(found.totalCount,2);
  assert.equal(found.kind,"rfq_review");
  assert.equal(found.partial,false);
  assert.deepEqual(found.findings.map(x=>x.code),
    ["RFQ_LINE_UNMATCHED","RFQ_EXTRACTION_UNCERTAIN"]);
  assert.ok(found.findings[0]?.suggestedAction.includes("mahdolliset muut"));
  assert.ok(found.findings.every(x=>x.sourceId==="rfq:"+rfq));
  assert.ok(found.findings.every(x=>!x.title.includes("1896-S")));
});
test("5.1C RFQ sample gap remains explicit, even when exact whole-document counts exist",()=>{
  const many={...base,unresolvedLines:15,totalLines:20,
    inspectedLines:20,allLinesInspected:false,truncated:true};
  const found=analyzeRfq(explainRfq(many),"en");
  assert.equal(found.partial,true);
  assert.equal(found.totalCount,20);
  assert.equal(found.inspectedCount,2);
});
test("5.1C RFQ with all confirmed does not manufacture missing-match findings",()=>{
  const all={...base,status:"ready",unresolvedLines:0,
    lines:[{...base.lines[0],lineNumber:1}],totalLines:1,
    inspectedLines:1,selectedLines:1};
  const found=analyzeRfq(explainRfq(all),"fi");
  assert.equal(found.findings.length,1);
  assert.equal(found.findings[0]?.code,"RFQ_READY_FOR_QUOTE");
  assert.ok(found.findings[0]?.suggestedAction.includes("Tarkista"));
});
test("5.1C findings are bounded verified fields and never accepted as user-provided SQL",()=>{
  const cases=Array.from({length:10},(_,idx)=>
    make(idx+1,"erp","erp_failed","2026-10-16T10:00:00Z"));
  const result=prioritizeOrderCases(cases,"fi",5,false);
  const data=serializeAnalysis(result.analysis);
  assert.ok(data.length<=1800);
  const parsed=JSON.parse(data) as {partial:boolean;findings:Array<{sourceId:string}>;totalCount:null;scopeNote:string};
  assert.equal(parsed.totalCount,null);
  assert.equal(parsed.findings.length,5);
  assert.match(parsed.scopeNote,/not a global ranking/);
});
test("5.1C release is independently disabled without server-side opt-in",()=>{
  const route=readFileSync("app/api/copilot/stream/route.ts","utf8");
  const resolver=readFileSync("lib/rivora/copilot-context/resolver.ts","utf8");
  const priority=readFileSync("lib/rivora/copilot-context/order-priority.ts","utf8");
  assert.match(route,/AVEROMIRA_COPILOT_DETERMINISTIC_ANALYSIS_ENABLED === "true"/);
  assert.match(route,/const analysisEnabled = useWorkspaceData/);
  assert.match(route,/serializeAnalysis\(analysis\)/);
  assert.match(resolver,/getOrdersPriority\(/);
  assert.match(resolver,/verifyContextMembership\(/);
  assert.match(priority,/strict:true,detectTruncation:true/);
  assert.doesNotMatch(priority,/createAdminClient|service_role|\.insert\(|\.update\(|\.delete\(/);
  assert.ok(route.indexOf("await resolveCopilotContext(") <
    route.indexOf("await ledger.reserve("));
});
