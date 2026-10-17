import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { loadRfqSnapshot } from "../lib/rivora/copilot-context/rfq.ts";

const ORG_A="11111111-1111-4111-8111-111111111111";
const ORG_B="22222222-2222-4222-8222-222222222222";
const RFQ="aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const mkId=(n:number)=>"bbbbbbbb-bbbb-4bbb-8bbb-"+n.toString(16).padStart(12,"0");
const productId=mkId(998);
type Obj=Record<string,unknown>;
type Table="rfqs"|"rfq_lines"|"quotes"|"product_match_candidates";
type Scenario={
  rows:Record<Table,Obj[]>;
  fail?:string;
  nullCount?:boolean;
  calls?:Array<{table:string,selected:string,filters:Record<string,unknown>,limit:number|null}>;
};
function setup(opts?:{n?:number,fail?:string,nullCount?:boolean,candidates?:number}):Scenario {
  const n=opts?.n??3;
  const rfq:Obj={id:RFQ,organization_id:ORG_A,reference:"REF-24<script>test</script>",
    status:"needs_review",source_type:"pdf",overall_confidence:87,
    extraction_confidence:null,extraction_warnings:["Warning <b>one</b>"]};
  const lines:Obj[]=Array.from({length:n},(_,i)=>({
    id:mkId(i+1),rfq_id:RFQ,organization_id:ORG_A,line_number:i+1,
    customer_sku:i===0?"ABC-1":null,raw_description:i===0?"Untrusted <script>text</script>":null,
    selected_product_id:null,match_method:i===0?"exact_sku":null,
    match_confidence:i===0?97:null,extraction_confidence:i===0?0.7:null,
    review_status:i===0?"needs_review":i===1?"unmatched":"confirmed",
  }));
  const candidates=Array.from({length:opts?.candidates??1},(_,i)=>({
    organization_id:ORG_A,rfq_line_id:mkId(i===0?1:2),product_id:productId,
    confidence:99,method:"exact_sku",rank:i+1,products:{id:productId,sku:"P-1",name:"Part A"},
  }));
  return {rows:{
    rfqs:[rfq,{...rfq,id:mkId(501),organization_id:ORG_B,reference:"SECRET OTHER TENANT"}],
    rfq_lines:[...lines,{id:mkId(555),rfq_id:mkId(501),organization_id:ORG_B,line_number:1,review_status:"unmatched"}],
    quotes:[{id:mkId(650),organization_id:ORG_A,rfq_id:RFQ}],
    product_match_candidates:[...candidates,{
      organization_id:ORG_B,rfq_line_id:mkId(555),product_id:mkId(650),rank:1,
      confidence:22,method:"fuzzy",products:{id:mkId(650),sku:"TENANT_B_SECRET",name:"Secret"},
    }],
  },fail:opts?.fail,nullCount:opts?.nullCount,calls:[]};
}
function fakeDb(s:Scenario) {
  return {
    from(table:Table) {
      const f:Record<string,unknown>={};
      let selected="", head=false, count=false, max:number|null=null;
      let order:Array<{field:string,asc:boolean}>=[];
      function get() {
        let rows=s.rows[table].filter(row=>Object.entries(f).every(([field,val])=>{
          if (field.startsWith("neq:")) return row[field.slice(4)]!==val;
          if (field.startsWith("in:")) return (val as unknown[]).includes(row[field.slice(3)]);
          return row[field]===val;
        }));
        for(const col of order.slice().reverse()){
          rows=rows.slice().sort((a,b)=>{
            const v=a[col.field], w=b[col.field];
            const z=String(v).localeCompare(String(w),undefined,{numeric:true});
            return col.asc?z:-z;
          });
        }
        const total=rows.length;
        if(max!=null)rows=rows.slice(0,max);
        s.calls?.push({table,selected,filters:{...f},limit:max});
        const shouldFail=s.fail===table || s.fail===(count?"counts":"none");
        if(shouldFail) return {data:null,error:{code:"TEST_DB_ERROR"},count:null};
        if(head) return {data:null,error:null,count:s.nullCount?null:total};
        return {data:rows,error:null,count:null};
      }
      const q={
        select(value:string,opts?:{count?:string;head?:boolean}) {
          selected=value;head=opts?.head===true;count=opts?.count==="exact";return q;
        },
        eq(key:string,value:unknown){f[key]=value;return q;},
        neq(key:string,value:unknown){f["neq:"+key]=value;return q;},
        in(key:string,value:unknown[]){f["in:"+key]=value;return q;},
        order(field:string,opts?:{ascending?:boolean}) {
          order.push({field,asc:opts?.ascending!==false});return q;
        },
        limit(value:number){max=value;return q;},
        abortSignal(signal:AbortSignal){assert.equal(signal.aborted,false);return q;},
        maybeSingle() {
          const result=get();
          return Promise.resolve({...result,data:Array.isArray(result.data)?result.data[0]??null:null});
        },
        then<T1=unknown,T2=never>(resolve?:(value:ReturnType<typeof get>)=>T1|PromiseLike<T1>,
          reject?:(error:unknown)=>T2|PromiseLike<T2>) {
          return Promise.resolve(get()).then(resolve,reject);
        },
      };
      return q;
    },
  };
}

test("5.1B.1 reads exact tenant-scoped counts and no cross-workspace data",async()=>{
  const scenario=setup();
  const value=await loadRfqSnapshot(fakeDb(scenario) as never,ORG_A,RFQ,new AbortController().signal);
  assert.equal(value.totalLines,3);
  assert.equal(value.unresolvedLines,2);
  assert.equal(value.inspectedLines,3);
  assert.equal(value.selectedLines,3);
  assert.equal(value.quoteExists,true);
  assert.equal(value.allLinesInspected,true);
  assert.equal(value.truncated,false);
  assert.equal(value.extractionConfidence,null);
  const lineOne=value.lines.find(item=>item.lineNumber===1);
  const lineTwo=value.lines.find(item=>item.lineNumber===2);
  assert.equal(lineOne?.matchConfidence,97);
  assert.equal(lineOne?.extractionConfidence,0.7);
  assert.equal(lineOne?.reviewStatus,"needs_review");
  assert.equal(lineTwo?.reviewStatus,"unmatched");
  assert.equal(lineOne?.candidates[0]?.sku,"P-1");
  assert.equal(lineOne?.candidatesComplete,true);
  assert.equal(value.reference?.includes("<"),false);
  assert.equal(lineOne?.description?.includes("<"),false);
  assert.equal(value.extractionWarnings?.[0]?.includes("<"),false);
  assert.equal(JSON.stringify(value).includes("TENANT_B_SECRET"),false);
  assert.equal(JSON.stringify(value).includes("SECRET OTHER TENANT"),false);
  for (const call of scenario.calls??[]) {
    assert.equal(call.filters.organization_id,ORG_A);
    if(call.table!=="rfqs")assert.equal(call.filters.rfq_id??RFQ,RFQ);
  }
  assert.ok(scenario.calls?.some(x=>x.table==="rfq_lines"&&x.limit===51));
  assert.ok(scenario.calls?.some(x=>x.table==="product_match_candidates"&&x.limit===31));
});

test("5.1B.1 60-line RFQ is partial; counts remain exact; only ten rows selected",async()=>{
  const scenario=setup({n:60,candidates:0});
  const value=await loadRfqSnapshot(fakeDb(scenario) as never,ORG_A,RFQ,new AbortController().signal);
  assert.equal(value.totalLines,60);
  assert.equal(value.unresolvedLines,2);
  assert.equal(value.inspectedLines,50);
  assert.equal(value.selectedLines,10);
  assert.equal(value.allLinesInspected,false);
  assert.equal(value.truncated,true);
  // Unmatched lines are intentionally ranked ahead of needs_review lines.
  assert.deepEqual(value.lines.slice(0,2).map(x=>x.lineNumber),[2,1]);
});

test("5.1B.1 candidates do not claim completeness when sentinel exceeds cap",async()=>{
  const scenario=setup({n:4,candidates:31});
  const value=await loadRfqSnapshot(fakeDb(scenario) as never,ORG_A,RFQ,new AbortController().signal);
  assert.equal(value.truncated,true);
  assert.equal(value.lines.every(x=>x.candidatesComplete===false),true);
  assert.ok(value.lines.every(x=>x.candidates.length<=3));
});

test("5.1B.1 zero lines are distinguished from unknown counts",async()=>{
  const scenario=setup({n:0,candidates:0});
  const value=await loadRfqSnapshot(fakeDb(scenario) as never,ORG_A,RFQ,new AbortController().signal);
  assert.equal(value.totalLines,0);
  assert.equal(value.unresolvedLines,0);
  assert.equal(value.allLinesInspected,true);
  assert.deepEqual(value.lines,[]);
  await assert.rejects(loadRfqSnapshot(fakeDb(setup({nullCount:true})) as never,ORG_A,RFQ,
    new AbortController().signal),/COPILOT_RFQ_COUNT_UNAVAILABLE/);
});

test("5.1B.1 errors, missing tenants and aborts fail closed",async()=>{
  for(const table of ["rfqs","rfq_lines","quotes","product_match_candidates","counts"]){
    await assert.rejects(loadRfqSnapshot(fakeDb(setup({fail:table})) as never,
      ORG_A,RFQ,new AbortController().signal),/COPILOT_RFQ_(UNAVAILABLE|LINES_UNAVAILABLE|QUOTE_UNAVAILABLE|CANDIDATES_UNAVAILABLE|COUNT_UNAVAILABLE)/);
  }
  await assert.rejects(loadRfqSnapshot(fakeDb(setup()) as never,
    ORG_B,RFQ,new AbortController().signal),/COPILOT_RFQ_UNAVAILABLE/);
  await assert.rejects(loadRfqSnapshot(fakeDb(setup()) as never,
    "invalid",RFQ,new AbortController().signal),/COPILOT_RFQ_INVALID_INPUT/);
  const canceled=new AbortController();canceled.abort();
  await assert.rejects(loadRfqSnapshot(fakeDb(setup()) as never,
    ORG_A,RFQ,canceled.signal),/COPILOT_RFQ_ABORTED/);
});

test("5.1B.1 is an isolated read-only reader and wrapper verifies membership",()=>{
  const load=(path:string)=>readFileSync(path,"utf8");
  const reader=load("lib/rivora/copilot-context/rfq.ts");
  const wrapper=load("lib/rivora/copilot-context/rfq-access.ts");
  const route=load("app/api/copilot/stream/route.ts");
  assert.doesNotMatch(reader+wrapper,/createAdminClient|service_role|\.insert\(|\.update\(|\.delete\(|\.rpc\(/);
  assert.match(wrapper,/await verifyContextMembership\(/);
  assert.match(wrapper,/await verifyActiveRecordAccess\(/);
  assert.match(wrapper,/return loadRfqSnapshot\(/);
  assert.equal(route.includes("loadRfqSnapshot("),false);
  assert.equal(route.includes("readAuthorizedRfqSnapshot("),false);
});


test("5.1B.2 focused RFQ line included ahead of review prioritization",async()=>{
  const scenario=setup({n:40,candidates:0});
  const value=await loadRfqSnapshot(fakeDb(scenario) as never,
    ORG_A,RFQ,new AbortController().signal,40);
  assert.equal(value.lines[0]?.lineNumber,40);
  assert.equal(value.selectedLines,1);
  await assert.rejects(loadRfqSnapshot(fakeDb(scenario) as never,
    ORG_A,RFQ,new AbortController().signal,999),
    /COPILOT_RFQ_LINE_UNAVAILABLE/);
});

test("5.1B.2 candidate completeness is false on more than three candidates per line",async()=>{
  const scenario=setup({n:4,candidates:5});
  const value=await loadRfqSnapshot(fakeDb(scenario) as never,
    ORG_A,RFQ,new AbortController().signal);
  assert.equal(value.truncated,true);
  assert.ok(value.lines.some(item=>item.candidatesComplete===false));
  assert.ok(value.lines.every(item=>item.candidates.length<=3));
});
