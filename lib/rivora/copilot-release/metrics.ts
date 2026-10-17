// Deterministic Phase 7 health assessment of caller-provided aggregate events.
// Does not read live production telemetry, model content or customer data.
export type HealthSample = {kind:"success"|"failure"|"billing_unknown"|"budget_denied"|"authorization_denied";timestamp:number};
export type HealthSummary = {status:"healthy"|"degraded"|"blocked";sampleSize:number;
  consecutiveFailures:number;ambiguousBilling:number;alerts:string[]};
export function assessCopilotHealth(samples:readonly HealthSample[],now:number,windowMs=900000):HealthSummary {
 if(!Number.isFinite(now)||!Number.isSafeInteger(windowMs)||windowMs<60000||windowMs>3600000)
   throw new Error("Invalid monitoring interval");
 const active=samples.filter(x=>Number.isFinite(x.timestamp) &&
   x.timestamp<=now && x.timestamp>=now-windowMs &&
   ["success","failure","billing_unknown","budget_denied","authorization_denied"].includes(x.kind))
   .sort((a,b)=>a.timestamp-b.timestamp).slice(-100);
 let failed=0;
 for(let i=active.length-1;i>=0;i--){
   if(active[i].kind==="failure")failed++;
   else if(active[i].kind==="success")break;
 }
 const unknown=active.filter(x=>x.kind==="billing_unknown").length;
 const auth=active.filter(x=>x.kind==="authorization_denied").length;
 const alerts:string[]=[];
 if(unknown>0)alerts.push("ambiguous_billing_requires_reconciliation");
 if(auth>0)alerts.push("authorization_denial_review");
 if(failed>=3)alerts.push("consecutive_request_failures");
 return {status:unknown>0?"blocked":alerts.length?"degraded":"healthy",
   sampleSize:active.length,consecutiveFailures:failed,ambiguousBilling:unknown,alerts};
}
