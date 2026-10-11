import { internalAuthorized } from "@/lib/rivora/operations/internal-auth";
import { operationsEnabled } from "@/lib/rivora/operations/policy";
import { workerCall } from "@/lib/rivora/operations/database";
export const runtime="nodejs";export const dynamic="force-dynamic";
export async function GET(request:Request) {
 const headers={"Cache-Control":"private, no-store"};
 if(!operationsEnabled() || !internalAuthorized(request,process.env.AVEROMIRA_OPERATIONS_MONITOR_SECRET)) return Response.json({error:"Not available."},{status:404,headers});
 try {
 const data=await workerCall<{lastSuccess:string|null;schemaVersion:number;enabled:boolean}>("operation_worker_status");
 const healthy=Boolean(data.lastSuccess)&&Date.now()-Date.parse(data.lastSuccess!)<15*60_000;
 return Response.json({healthy,lastSuccess:data.lastSuccess,schemaVersion:data.schemaVersion},{status:healthy?200:503,headers});
 }catch{return Response.json({healthy:false},{status:503,headers});}
}
