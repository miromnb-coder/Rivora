import {randomUUID} from 'node:crypto';
import {operationsEnabled,OperationError} from './policy.ts';
import {operationPricing,usageMicroUsd,type Pricing} from './usage.ts';
// Existing synchronous AI paths share the same ledger, with activation separate from jobs.
// No input text/document content is stored in the cost ledger.
export async function trackedAiCall<T extends {id?:string;model?:string;usage?:unknown}>(
 scope:{type:'catalogue_mapping'|'support_ai'|'public_ai';organizationId?:string;actorId?:string},
 invoke:(pricing:Pricing|null)=>Promise<T>,
):Promise<T> {
 if(!operationsEnabled() || process.env.AVEROMIRA_AI_LEDGER_ENABLED!=='true')return invoke(null);
 const pricing=operationPricing(scope.type);
 const {createAdminClient}=await import('@/lib/supabase/admin');
 const db=createAdminClient();
 const {data:id,error}=await db.rpc('reserve_ai_usage_server',{p_org:scope.organizationId??null,p_actor:scope.actorId??null,p_type:scope.type,p_key:randomUUID(),p_model:pricing.model,p_pricing:pricing.version,p_micro:pricing.reservationMicroUsd});
 if(error || !id)throw new OperationError('budget');
 try {
  const result=await invoke(pricing);
  const raw=result.usage as {input_tokens?:number;output_tokens?:number;prompt_tokens?:number;completion_tokens?:number}|null;
  const usage={input_tokens:raw?.input_tokens??raw?.prompt_tokens,output_tokens:raw?.output_tokens??raw?.completion_tokens};
  const cost=usageMicroUsd(usage,pricing);
  const settled=await db.rpc('settle_ai_usage_server',{p_id:id,p_actual:cost,p_input:usage.input_tokens,p_output:usage.output_tokens,p_response:result.id??null,p_unknown:false});
  if(settled.error)throw new OperationError('database');
  return result;
 }catch(e){
  // If even this write fails, the reserved cost remains held in PostgreSQL.
  try{await db.rpc('settle_ai_usage_server',{p_id:id,p_actual:null,p_input:null,p_output:null,p_response:null,p_unknown:true});}catch{}
  throw e;
 }
}
