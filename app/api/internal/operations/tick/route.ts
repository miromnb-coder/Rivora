import { randomUUID } from "node:crypto";
import { internalAuthorized } from "@/lib/rivora/operations/internal-auth";
import { operationsEnabled } from "@/lib/rivora/operations/policy";
import { workerCall } from "@/lib/rivora/operations/database";
import { executeOperation,type OperationJob } from "@/lib/rivora/operations/worker";
import { workerAdapters } from "@/lib/rivora/operations/adapters";
export const runtime="nodejs";
export const dynamic="force-dynamic";
// Conservative budget; do not assume 240 seconds or activate a cron in this PR.
export const maxDuration=60;
const headers={"Cache-Control":"private, no-store"};
export async function GET(request:Request) {
 if(!operationsEnabled() || !internalAuthorized(request,process.env.CRON_SECRET)) return Response.json({error:"Not available."},{status:404,headers});
 const run=randomUUID(),deadline=Date.now()+50_000;
 try {
  const shadow=process.env.AVEROMIRA_OPERATIONS_MODE!=="active";
  await workerCall("operation_monitor",[shadow]);
  let claimed=0;
  if(!shadow) for(let i=0;i<2 && deadline-Date.now()>40_000;i++) {
   const job=await workerCall<OperationJob|null>("operation_claim",[run,"phase2a-v1"]);if(!job) break;
   claimed++;
   const controller=new AbortController();
   const timeout=setTimeout(()=>controller.abort(),Math.min(35_000,deadline-Date.now()-5000));
   let heartbeatInFlight=false;
   const heartbeat=setInterval(()=>{if(heartbeatInFlight)return;heartbeatInFlight=true;workerCall("operation_heartbeat",[job.id,job.generation,job.lease_token]).catch(()=>controller.abort()).finally(()=>{heartbeatInFlight=false;});},20_000);
   try {await executeOperation(job,workerAdapters(controller.signal));} finally {clearInterval(heartbeat);clearTimeout(timeout);}
  }
  await workerCall("operation_worker_finish",[run,"succeeded"]);
  return Response.json({ok:true,shadow,claimed},{headers});
 }catch {
  try{await workerCall("operation_worker_finish",[run,"failed"]);}catch{}
  return Response.json({error:"Worker unavailable."},{status:503,headers});
 }
}
