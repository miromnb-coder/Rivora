import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { formatCopilotAnswer } from "../lib/rivora/copilot-answer-format.ts";
import {
  explainRfq, serializeRfqExplanation, rfqReviewLabel,
  rfqStatusLabel, explainMatchMethod, rfqNextActionLabel,
} from "../lib/rivora/copilot-context/rfq-explanation.ts";
import { rfqAnswerGuidance } from "../lib/rivora/copilot-context/rfq-answer-guidance.ts";
import type { RfqDataSnapshot } from "../lib/rivora/copilot-context/rfq.ts";

const id="aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const snapshot: RfqDataSnapshot={
  kind:"rfq_snapshot",rfqId:id,reference:"QA-RFQ-TEST",status:"needs_review",
  sourceType:"csv",overallConfidence:null,extractionConfidence:null,
  extractionWarnings:[],totalLines:2,unresolvedLines:1,inspectedLines:2,
  selectedLines:2,allLinesInspected:true,quoteExists:false,truncated:false,
  retrievedAt:"2026-10-17T10:00:00.000Z",
  lines:[
    {
      id:"bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",lineNumber:1,
      customerSku:"1896-S",description:"Desk",reviewStatus:"confirmed",
      selectedProductId:"cccccccc-cccc-4ccc-8ccc-cccccccccccc",
      matchMethod:"manual",matchConfidence:99,extractionConfidence:0.9,
      candidates:[{productId:"cccccccc-cccc-4ccc-8ccc-cccccccccccc",
        sku:"1896-S",name:"ATHENS desk",confidence:99,method:"exact_sku",rank:1}],
      candidatesComplete:true,
    },
    {
      id:"dddddddd-dddd-4ddd-8ddd-dddddddddddd",lineNumber:2,
      customerSku:null,description:"Tuntematon pumppu",reviewStatus:"unmatched",
      selectedProductId:null,matchMethod:null,matchConfidence:null,
      extractionConfidence:null,candidates:[],candidatesComplete:true,
    },
  ],
};

test("5.1B.4 Finnish RFQ evidence makes confirmed vs unresolved distinct",()=>{
  const explanation=explainRfq(snapshot);
  const data=JSON.parse(serializeRfqExplanation(explanation,"fi").modelSnapshot);
  assert.equal(data.totalLines,2);
  assert.equal(data.unresolvedLines,1);
  assert.equal(data.confirmedLines,1);
  assert.equal(data.statusLabel,"Vaatii tarkistuksen");
  assert.equal(data.explanations[0].reviewStatusLabel,"Vahvistettu");
  assert.equal(data.explanations[0].humanConfirmed,true);
  assert.match(data.explanations[0].matchMethodExplanation,/valittu käsin/);
  assert.equal(data.explanations[0].candidates[0].method,"exact_sku");
  assert.equal(data.explanations[1].reviewStatusLabel,"Tuoteosuma puuttuu");
  assert.equal(data.explanations[1].humanConfirmed,false);
  assert.equal(data.explanations[1].candidateListComplete,true);
  assert.equal(data.explanations[1].nextActionLabel,"Etsi tai valitse sopiva tuote käsin");
  assert.ok(!data.explanations[0].matchMethodExplanation.includes("exact_sku"));
});

test("5.1B.4 unknown statuses do not become invented approvals",()=>{
  assert.match(rfqReviewLabel("unknown","fi"),/Tila vaatii tarkistamista/);
  assert.match(rfqStatusLabel("unknown","fi"),/Tarkista tila sovelluksesta/);
  assert.match(explainMatchMethod("unknown","fi"),/ei ole tiedossa/);
  assert.equal(rfqNextActionLabel("human_confirmation","en"),"Review and confirm the match in the application");
  const en=JSON.parse(serializeRfqExplanation(explainRfq(snapshot),"en").modelSnapshot);
  assert.equal(en.statusLabel,"Needs review");
  assert.equal(en.confirmedLines,1);
  assert.match(en.explanations[0].matchMethodExplanation,/manually/);
});

test("5.1B.4 answer guidance enforces scope, language and honest confidence",()=>{
  const fi=rfqAnswerGuidance("fi",false).join(" ");
  const focused=rfqAnswerGuidance("fi",true).join(" ");
  const en=rfqAnswerGuidance("en",false).join(" ");
  assert.match(fi,/confirmedLines/);
  assert.match(fi,/candidateListComplete/);
  assert.match(fi,/Rivit/);
  assert.match(fi,/Seuraavaksi/);
  assert.match(focused,/manuaalinen valinta|manuaalinen/i);
  assert.match(en,/Next step/);
  assert.match(fi,/never|Never/);
  const route=readFileSync("app/api/copilot/stream/route.ts","utf8");
  assert.match(route,/rfqAnswerGuidance\(locale/);
  assert.match(route,/contextQuery\?\.kind === "rfq_line_explanation"/);
  assert.ok(route.indexOf("rfqAnswerGuidance(locale")>route.indexOf("const instructions"));
  assert.ok(route.indexOf("await resolveRfqIntelligenceContext(")<route.indexOf("await ledger.reserve("));
  assert.match(readFileSync("lib/rivora/copilot-context/resolver.ts","utf8"),
    /serializeRfqExplanation\(explanation,args.locale\)/);
  assert.match(readFileSync("lib/rivora/copilot-context/resolver.ts","utf8"),
    /const explanation=explainRfq\(snapshot,focusLineNumber\)/);
});

test("5.1B.4 readable answer parser groups paragraphs, headings and bullets",()=>{
  const raw="Tarjouspyyntö vaatii vielä tarkistusta.\n\nRivit\n- Rivi 1: vahvistettu\n- Rivi 2: ei osumaa\n\nSeuraavaksi\nValitse sopiva tuote.";
  assert.deepEqual(formatCopilotAnswer(raw),[
    {kind:"paragraph",text:"Tarjouspyyntö vaatii vielä tarkistusta."},
    {kind:"heading",text:"Rivit"},
    {kind:"list",items:["Rivi 1: vahvistettu","Rivi 2: ei osumaa"]},
    {kind:"heading",text:"Seuraavaksi"},
    {kind:"paragraph",text:"Valitse sopiva tuote."},
  ]);
  assert.deepEqual(formatCopilotAnswer("Miksi juuri tämä?"),[{kind:"paragraph",text:"Miksi juuri tämä?"}]);
});

test("5.1B.4 answer rendering leaves untrusted HTML/link text inert",()=>{
  const text="<script>alert('test')</script>\n**Rivit**\n- <a href='https://evil.invalid'>Rivi 1</a>\n";
  const blocks=formatCopilotAnswer(text);
  assert.equal(blocks[0].kind,"paragraph");
  assert.equal(blocks[0].text,"<script>alert('test')</script>");
  assert.deepEqual(blocks[1],{kind:"heading",text:"Rivit"});
  assert.deepEqual(blocks[2],{kind:"list",items:["<a href='https://evil.invalid'>Rivi 1</a>"]});
  const jsx=readFileSync("components/copilot/CopilotConversation.tsx","utf8");
  assert.doesNotMatch(jsx,/dangerouslySetInnerHTML|<iframe/);
  assert.match(jsx,/<CopilotAnswerText text=\{message.text\}/);
  assert.match(readFileSync("app/app/copilot-conversation.css","utf8"),/\.ml-copilot-answer-list/);
});

test("5.1B.4 model-side context truncation stays bounded",()=>{
  const many={...snapshot,lines:Array.from({length:10},(_,index)=>({
    ...snapshot.lines[0],lineNumber:index+1,
    candidates:Array.from({length:3},()=>({
      productId:"cccccccc-cccc-4ccc-8ccc-cccccccccccc",
      sku:"ABC".repeat(25),name:"Product ".repeat(15),
      confidence:99,method:"exact_sku",rank:1,
    })),
  })),selectedLines:10,truncated:true,totalLines:50,unresolvedLines:40};
  const evidence=serializeRfqExplanation(explainRfq(many),"fi");
  assert.ok(evidence.modelSnapshot.length<=6000);
  assert.equal(evidence.truncated,true);
  assert.ok(JSON.parse(evidence.modelSnapshot).truncated);
});
