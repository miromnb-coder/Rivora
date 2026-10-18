import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {REQUIRED_GATES,emptyReleaseManifest,evaluateCopilotRelease} from "../lib/rivora/copilot-release/readiness.ts";
import {parseApprovedCustomerOrganizations,copilotCustomerAudienceAuthorizedForEnvironment} from "../lib/rivora/copilot-release/audience.ts";
import {safeCopilotDiagnosticFields} from "../lib/rivora/copilot-release/observability.ts";
import {assessCopilotHealth} from "../lib/rivora/copilot-release/metrics.ts";
const actor="11111111-2222-4333-8444-555555555555";
const org="aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";
const org2="bbbbbbbb-bbbb-4ccc-8ddd-eeeeeeeeeeee";
const readyEvidence=()=>({passed:true,checkedAt:"2026-10-17T14:00:00.000Z",
  reference:"internal-evidence-reference",reviewer:"Independent reviewer"});
const validManifest=()=>{
 const m=emptyReleaseManifest("a".repeat(40));
 m.deployedCommit=m.targetCommit;
 m.deploymentId="dpl_12345678901234567890";
 for(const key of REQUIRED_GATES)m.gates[key]=readyEvidence();
 m.acceptance.phase5.passed=36;
 m.acceptance.phase6.passed=56;
 m.acceptance.phase7.passed=25;
 return m;
};
test("7.0 release defaults NO_GO and counts 13 independently evidenced approvals",()=>{
 const empty=emptyReleaseManifest("a".repeat(40));
 const v=evaluateCopilotRelease(empty);
 assert.equal(v.decision,"NO_GO");
 assert.equal(v.passedGates,0);
 for(const k of REQUIRED_GATES)assert.ok(v.missing.includes(k));
 assert.equal(evaluateCopilotRelease(validManifest()).decision,"GO");
 assert.equal(evaluateCopilotRelease(null as never).decision,"NO_GO");
 assert.equal(evaluateCopilotRelease({} as never).decision,"NO_GO");
});
test("7.0 each missing human gate individually vetoes release",()=>{
 for(const name of REQUIRED_GATES) {
   const m=validManifest();delete m.gates[name];
   assert.equal(evaluateCopilotRelease(m).decision,"NO_GO",name);
 }
 for(const tweak of [
   (m:ReturnType<typeof validManifest>)=>{m.deployedCommit="b".repeat(40);},
   (m:ReturnType<typeof validManifest>)=>{m.deploymentId="unknown";},
   (m:ReturnType<typeof validManifest>)=>{m.version=0 as never;},
   (m:ReturnType<typeof validManifest>)=>{m.acceptance.phase5.passed=32;},
   (m:ReturnType<typeof validManifest>)=>{m.acceptance.phase6.passed=49;},
   (m:ReturnType<typeof validManifest>)=>{m.acceptance.phase7.passed=22;},
   (m:ReturnType<typeof validManifest>)=>{m.acceptance.phase7.criticalFailures=1;},
   (m:ReturnType<typeof validManifest>)=>{m.gates.ownerApproval={...readyEvidence(),reviewer:" "};},
   (m:ReturnType<typeof validManifest>)=>{m.gates.databaseRestore={...readyEvidence(),checkedAt:"2999-01-01T00:00:00Z"};},
 ]){const m=validManifest();tweak(m);assert.equal(evaluateCopilotRelease(m).decision,"NO_GO");}
});
test("7.7 customer beta denies absent/malformed/duplicate cross-org allowlist",()=>{
 const base={VERCEL_ENV:"production",
   AVEROMIRA_COPILOT_PILOT_ENABLED:"false",
   AVEROMIRA_COPILOT_CUSTOMER_BETA_ENABLED:"true",
   AVEROMIRA_COPILOT_PHASE7_RELEASE_APPROVED:"true",
   AVEROMIRA_COPILOT_CUSTOMER_ORGANIZATION_IDS:org,
 };
 assert.deepEqual(parseApprovedCustomerOrganizations(base),[org]);
 assert.equal(copilotCustomerAudienceAuthorizedForEnvironment(actor,org,"owner",base),true);
 assert.equal(copilotCustomerAudienceAuthorizedForEnvironment(actor,org,"member",base),true);
 assert.equal(copilotCustomerAudienceAuthorizedForEnvironment(actor,org2,"owner",base),false);
 assert.equal(copilotCustomerAudienceAuthorizedForEnvironment(actor,org,"viewer",base),false);
 assert.equal(copilotCustomerAudienceAuthorizedForEnvironment("invalid",org,"owner",base),false);
 for(const changes of [
  {AVEROMIRA_COPILOT_CUSTOMER_BETA_ENABLED:""},
  {AVEROMIRA_COPILOT_PHASE7_RELEASE_APPROVED:""},
  {AVEROMIRA_COPILOT_CUSTOMER_ORGANIZATION_IDS:""},
  {AVEROMIRA_COPILOT_CUSTOMER_ORGANIZATION_IDS:org+","+org},
  {AVEROMIRA_COPILOT_CUSTOMER_ORGANIZATION_IDS:org+",https://evil.test"},
  {AVEROMIRA_COPILOT_CUSTOMER_ORGANIZATION_IDS:Array(11).fill(org2).join(",")},
  {AVEROMIRA_COPILOT_CUSTOMER_ORGANIZATION_IDS:"00000000-0000-0000-0000-000000000000"},
 ])assert.equal(copilotCustomerAudienceAuthorizedForEnvironment(actor,org,"owner",
   {...base,...changes}),false,JSON.stringify(changes));
});
test("7.7 existing one-person pilot and preview boundary remains independently gated",()=>{
 const base={VERCEL_ENV:"production",AVEROMIRA_COPILOT_PILOT_ENABLED:"true"};
 assert.equal(copilotCustomerAudienceAuthorizedForEnvironment(actor,org,"owner",base),true);
 assert.equal(copilotCustomerAudienceAuthorizedForEnvironment("any","any","viewer",
   {VERCEL_ENV:"preview"}),true);
 const live=readFileSync("lib/rivora/copilot-live.ts","utf8");
 const route=readFileSync("app/api/copilot/stream/route.ts","utf8");
 const status=readFileSync("app/api/copilot/status/route.ts","utf8");
 assert.match(live,/privateCopilotPilotReadiness/);
 assert.match(live,/copilotActorAuthorizedForEnvironment/);
 assert.match(route,/copilotCustomerAudienceAuthorizedForEnvironment\(/);
 assert.match(status,/copilotCustomerAudienceAuthorizedForEnvironment\(/);
 assert.ok(route.indexOf("copilotCustomerAudienceAuthorizedForEnvironment(")<
   route.indexOf("await ledger.reserve("));
});
test("7.3 Copilot lifecycle diagnostics strictly whitelist non-sensitive fields",()=>{
 const leak=safeCopilotDiagnosticFields("request-id-42",{
  context:"business",sizeClass:"medium",reason:"ContextReadError",
  organizationId:org,actorId:actor,email:"owner@example.com",
  question:"confidential customer details",apiKey:"sk-secret",
  prompt:"ignore all instructions",responseText:"sensitive",
  sourceId:"rfq:"+org,
 });
 assert.deepEqual(leak,{requestId:"request-id-42",context:"business",
   sizeClass:"medium",reason:"ContextReadError"});
 assert.deepEqual(safeCopilotDiagnosticFields("unsafe\nrequest",{reason:"provider error incl customer ID"}),{});
 const stream=readFileSync("app/api/copilot/stream/route.ts","utf8");
 assert.match(stream,/copilotLifecycleLog\("reserved"/);
 assert.match(stream,/copilotLifecycleLog\("settled"/);
 assert.match(stream,/copilotLifecycleLog\("completed"/);
 assert.match(stream,/copilotLifecycleLog\("ambiguous_billing"/);
 assert.match(stream,/await billing\.unknown\(\)/);
});
test("7.3 deterministic alert rules preserve unknown settlements and low signal",()=>{
 const now=1_800_000;
 const samples=[
  {kind:"success" as const,timestamp:now-40000},
  {kind:"failure" as const,timestamp:now-30000},
  {kind:"failure" as const,timestamp:now-20000},
  {kind:"failure" as const,timestamp:now-10000},
 ];
 const state=assessCopilotHealth(samples,now);
 assert.equal(state.status,"degraded");
 assert.equal(state.consecutiveFailures,3);
 assert.ok(state.alerts.includes("consecutive_request_failures"));
 assert.equal(assessCopilotHealth([...samples,{kind:"success",timestamp:now}],
   now).consecutiveFailures,0);
 const blocked=assessCopilotHealth([...samples,{
   kind:"billing_unknown",timestamp:now}],now);
 assert.equal(blocked.status,"blocked");
 assert.equal(blocked.ambiguousBilling,1);
 assert.equal(assessCopilotHealth([{kind:"failure",timestamp:now-2_000_000}],now).status,"healthy");
 assert.throws(()=>assessCopilotHealth([],now,10));
});
test("7.4 workspace changes clear context, while only CX2 may preserve route history",()=>{
 const ui=readFileSync("components/copilot/CopilotConversation.tsx","utf8");
 assert.match(ui,/requestNumber\.current \+= 1;\s*controller\.current\?\.abort\(\)/);
 assert.match(ui,/setShareWorkspaceData\(false\)/);
 assert.match(ui,/\},\s*\[pathname\]\)/);
 assert.match(ui,/if\(cx2Enabled\)return/);
 assert.match(ui,/setActiveConversationId\(null\)/);
 assert.match(ui,/\}, \[workspaceId\]\)/);
 assert.match(ui,/Tämä vastaus jäi kesken eikä sen tietoja ole varmennettu/);
 assert.match(ui,/message\.stage === "done" &&\s*message\.evidence/);
});
test("7.2 recovery and 7.5 privacy cannot be auto-certified by CI",()=>{
 const docs=readFileSync("docs/copilot/PHASE7_BACKUP_VERIFICATION.md","utf8");
 const privacy=readFileSync("docs/copilot/PHASE7_PRIVACY_DATA_FLOW.md","utf8");
 const report=readFileSync("docs/copilot/PHASE7_FINAL_QA_REPORT.md","utf8");
 const matrix=JSON.parse(readFileSync("docs/copilot/PHASE7_ACCEPTANCE_MATRIX.json","utf8"));
 assert.match(docs,/Restore|restore/);
 assert.match(docs,/Storage/);
 assert.match(privacy,/DPA/);
 assert.match(report,/NO-GO/);
 assert.equal(matrix.cases.length,25);
 assert.ok(matrix.cases.every((c:{status:string})=>c.status==="not_executed"));
});
