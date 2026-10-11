import { classifyFailure, failurePolicy, OperationError } from "./policy.ts";
export type OperationJob = { id:string; organization_id:string; type:string; generation:number; lease_token:string; attempt_count:number; unknown_calls:number; stage:string; input_ref:string; input_hash:string; metadata:Record<string,unknown>; checkpoint: Record<string,unknown>|null; entity_id:string|null };
export type WorkerDependencies = {
  call: <T=unknown>(name:string,parameters?:unknown[])=>Promise<T>;
  read: (job:OperationJob)=>Promise<File>;
  extract:(job:OperationJob,file:File)=>Promise<Record<string,unknown>>;
  pricing:(type:string)=>{model:string;version:string;reservationMicroUsd:number};
  bill:(result:Record<string,unknown>,type:string)=>number;
  reconcile:(context:unknown)=>{header:unknown[];summary:unknown;lines:unknown[]};
  notification:(job:OperationJob,payload:Record<string,unknown>)=>Promise<Record<string,unknown>>;
  send:(job:OperationJob,payload:Record<string,unknown>)=>Promise<string>;
};
export async function executeOperation(job:OperationJob,deps:WorkerDependencies) {
  const fence=[job.id,job.generation,job.lease_token];
  let providerStarted=false,unknown=job.unknown_calls;
  try {
    await deps.call("operation_heartbeat",fence);
    if (job.type==="email_reconcile") await deps.call("operation_email_reconcile",fence);
    else if(job.type==="support_notification" || job.type==="incident_notification") {
      if(job.stage!=="notification_accepted") {
        const source=await deps.call<Record<string,unknown>>("operation_notification_payload",fence);
        const proposed=job.checkpoint ?? await deps.notification(job,source);
        const payload=await deps.call<Record<string,unknown>>("operation_notification_started",[...fence,proposed]);
        const id=await deps.send(job,payload);
        await deps.call("operation_notification_accepted",[...fence,id]);
      }
    } else if(job.type==="rfq_pdf_process" || job.type==="po_pdf_process") {
      if(!job.checkpoint) {
        // Validate immutable input before reserving/provider invocation.
        const file=await deps.read(job);
        const pricing=deps.pricing(job.type);
        await deps.call("operation_reserve_ai",[...fence,pricing.model,pricing.version,pricing.reservationMicroUsd]);
        providerStarted=true;
        const result=await deps.extract(job,file);
        const cost=deps.bill(result,job.type);
        // Extraction and successful usage are checkpointed atomically.
        await deps.call("operation_checkpoint",[...fence,{...result,billing:{microUsd:cost}}]);
        providerStarted=false;
      }
      await deps.call("operation_heartbeat",fence);
      await deps.call("operation_publish_document",fence);
      if(job.type==="rfq_pdf_process") await deps.call("operation_complete_document",fence);
      else {
        const context=await deps.call("operation_po_context",fence);
        const result=context ? deps.reconcile(context) : {header:[],summary:{},lines:[]};
        await deps.call("operation_commit_po_reconciliation",[...fence,result.header,result.summary,result.lines]);
      }
    } else throw new OperationError("config");
    await deps.call("operation_finish",[...fence,"succeeded",null,0]);
    return "succeeded";
  } catch(error) {
    const code=classifyFailure(error);
    if(code==="stale_lease") return "stale_lease";
    if(providerStarted) {
      unknown++;
      try { await deps.call("operation_settle_ai",[...fence,null,null,null,null,true]); } catch { /* expired/revoked worker cannot write; recovery conservatively retains reservation */ }
    }
    const policy=failurePolicy(code,job.type,job.attempt_count,unknown);
    if(policy.state) await deps.call("operation_finish",[...fence,policy.state,code,policy.delay]);
    return policy.state ?? "stale_lease";
  }
}
