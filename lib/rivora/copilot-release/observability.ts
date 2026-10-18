// Phase 7: intentionally bounded diagnostics. No prompts, RFQ descriptions,
// tenant IDs, access tokens, response IDs, provider errors or credentials.
import { operationalLog } from "../observability.ts";
export type CopilotLifecycleEvent =
 "reserved"|"settled"|"completed"|"failed"|"cancelled"|
 "ambiguous_billing"|"evidence_unavailable"|"budget_denied";
const EVENT_NAME:Record<CopilotLifecycleEvent,string>={
 reserved:"copilot_ai_reserved",settled:"copilot_ai_settled",
 completed:"copilot_response_completed",failed:"copilot_response_failed",
 cancelled:"copilot_request_cancelled",
 ambiguous_billing:"copilot_usage_ambiguous",
 evidence_unavailable:"copilot_evidence_unavailable",
 budget_denied:"copilot_budget_denied",
};
const SAFE_REASON=new Set(["Error","TypeError","ContextReadError","AbortError","unknown"]);
const SAFE_REQUEST=/^[A-Za-z0-9._:-]{1,120}$/;
export function safeCopilotDiagnosticFields(
  requestId:unknown, details:Record<string,unknown>={},
):Record<string,string> {
 const fields:Record<string,string>={};
 if(typeof requestId==="string" && SAFE_REQUEST.test(requestId))fields.requestId=requestId;
 if(details.context==="business"||details.context==="none")fields.context=details.context;
 if(details.sizeClass==="short"||details.sizeClass==="medium"||details.sizeClass==="long")
   fields.sizeClass=details.sizeClass;
 if(typeof details.reason==="string" && SAFE_REASON.has(details.reason))
   fields.reason=details.reason;
 return fields;
}
export function copilotLifecycleLog(
 event:CopilotLifecycleEvent,requestId:string,details:Record<string,unknown>={},
):void {
 const fields=safeCopilotDiagnosticFields(requestId,details);
 operationalLog(
   event==="failed"||event==="ambiguous_billing"||event==="evidence_unavailable"?"error":
   event==="budget_denied"?"warn":"info",
   EVENT_NAME[event],fields,
 );
}
