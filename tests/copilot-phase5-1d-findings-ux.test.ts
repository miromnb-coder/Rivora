import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { buildVerifiedFindingsEvent } from "../lib/rivora/copilot-context/findings-event.ts";
import {
  encodeCopilotEvent, decodeCopilotEvent, type CopilotFindingsEvent,
} from "../lib/rivora/copilot-protocol.ts";
import { CopilotStreamParser } from "../lib/rivora/copilot-stream.ts";
import type { DeterministicAnalysis } from "../lib/rivora/copilot-context/analysis.ts";
import type { ContextSource } from "../lib/rivora/copilot-context/types.ts";

const id="aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const other="bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const source:ContextSource={
  kind:"rfq",recordId:id,sourceId:"rfq:"+id,label:"QA-RFQ-001",
  href:"/app/orders/case/rfq/"+id,
};
const analysis:DeterministicAnalysis={
  kind:"rfq_review",partial:false,inspectedCount:2,totalCount:2,
  findings:[
    {id:"RFQ_LINE_UNMATCHED:2",code:"RFQ_LINE_UNMATCHED",priority:90,
      severity:"high",sourceId:source.sourceId,
      title:"Rivi 2: tuoteosuma puuttuu",
      explanation:"Rivin 2 tallennetun tilan perusteella.",
      suggestedAction:"Valitse sopiva tuote käsin"},
    {id:"RFQ_LINE_UNCONFIRMED:3",code:"RFQ_LINE_UNCONFIRMED",priority:70,
      severity:"medium",sourceId:"rfq:"+other,
      title:"Rivi 3: vahvistus puuttuu",explanation:"Rivi 3",
      suggestedAction:"Tarkista rivi 3"},
  ],
};
test("5.1D only emits source-scoped verified findings and marks omissions partial",()=>{
  const event=buildVerifiedFindingsEvent(analysis,[source]);
  assert.ok(event);
  assert.equal(event?.type,"findings");
  assert.equal(event?.findings.length,1);
  assert.equal(event?.findings[0]?.sourceId,source.sourceId);
  assert.equal(event?.partial,true);
  assert.equal(buildVerifiedFindingsEvent(analysis,[]),null);
  assert.equal(buildVerifiedFindingsEvent(analysis,[{
    ...source,href:"https://outside.invalid/action",
  }]),null);
});
test("5.1D encode/decode roundtrips bounded findings but rejects tampering",()=>{
  const result=buildVerifiedFindingsEvent(analysis,[source])!;
  assert.deepEqual(decodeCopilotEvent(encodeCopilotEvent(result).trim()),result);
  const bad=[{
    ...result,findings:[{...result.findings[0],sourceId:"rfq:"+other+"?extra=1"}],
  },{
    ...result,findings:[{...result.findings[0],severity:"danger"}],
  },{
    ...result,findings:[{...result.findings[0],code:"EXECUTE_ACTION"}],
  },{
    ...result,findings:[{...result.findings[0],suggestedAction:"X".repeat(151)}],
  },{
    ...result,findings:Array.from({length:6},()=>result.findings[0])},
  },{
    ...result,findings:[result.findings[0],result.findings[0]]},
  ];
  for(const sample of bad)
    assert.equal(decodeCopilotEvent(encodeCopilotEvent(sample as CopilotFindingsEvent).trim()),null);
});
test("5.1D receives findings on fragmented SSE transport",()=>{
  const result=buildVerifiedFindingsEvent(analysis,[source])!;
  const stream=new CopilotStreamParser();
  const raw=new TextEncoder().encode(encodeCopilotEvent(result));
  const events=[];
  for(let i=0;i<raw.length;i+=7) events.push(...stream.push(raw.subarray(i,i+7)));
  stream.finish();
  assert.deepEqual(events,[result]);
});
test("5.1D never exposes findings before billing is settled or without flags",()=>{
  const route=readFileSync("app/api/copilot/stream/route.ts","utf8");
  const component=readFileSync("components/copilot/CopilotConversation.tsx","utf8");
  const fn=readFileSync("lib/rivora/copilot-context/findings-event.ts","utf8");
  assert.match(route,/AVEROMIRA_COPILOT_FINDINGS_UI_ENABLED === "true"/);
  assert.match(route,/AVEROMIRA_COPILOT_DETERMINISTIC_ANALYSIS_ENABLED === "true"/);
  assert.ok(route.indexOf("await billing.complete(")<route.indexOf("buildVerifiedFindingsEvent("));
  assert.ok(route.indexOf("buildVerifiedFindingsEvent(")<route.indexOf('emit({ type: "done" })'));
  assert.match(component,/message.stage === "done" &&\s+message.findings && message.sources/);
  assert.match(component,/sourceById.has\(item.sourceId\)/);
  assert.doesNotMatch(component,/dangerouslySetInnerHTML|window\.open|\.insert\(|\.update\(|\.delete\(/);
  assert.doesNotMatch(fn,/createAdminClient|\.insert\(|\.update\(|\.delete\(|new URL\(/);
});
