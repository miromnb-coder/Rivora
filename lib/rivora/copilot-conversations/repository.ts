import { createAdminClient } from "@/lib/supabase/admin";
import type { Cx2Auth } from "./auth";
import { validCx2Id } from "./auth";
import { saveCx2Preferences,loadCx2Preferences } from "./preferences";
import { buildCopilotHistory } from "@/lib/rivora/copilot-stream";
export type Cx2Conversation={
 id:string;title:string;context_kind:string|null;context_record_id:string|null;
 last_activity_at:string;created_at:string;
};
export type Cx2Message={id:string;role:"user"|"assistant";content:string;
 status:"pending"|"completed"|"failed"|"cancelled";created_at:string;request_id:string};
export function titleFromQuestion(input:string):string{
 const cleaned=input.replace(/[\r\n\t]+/g," ").trim().replace(/\s+/g," ");
 return (cleaned.slice(0,96).replace(/[.?!,;:\s]+$/g,"")||"Uusi keskustelu").slice(0,100);
}
export async function listCx2Conversations(c:Cx2Auth,limit=20,before?:string){
 let q=c.supabase.from("copilot_conversations")
  .select("id,title,context_kind,context_record_id,last_activity_at,created_at")
  .eq("organization_id",c.workspace.id).eq("owner_user_id",c.claims.sub)
  .order("last_activity_at",{ascending:false}).order("id",{ascending:false}).limit(limit);
 if(before)q=q.lt("last_activity_at",before);
 const {data,error}=await q;
 if(error)throw new Error("COPILOT_CONVERSATIONS_UNAVAILABLE");
 return (data??[]) as Cx2Conversation[];
}
export async function findCx2Conversation(c:Cx2Auth,id:string):Promise<Cx2Conversation|null>{
 if(!validCx2Id(id))return null;
 const {data,error}=await c.supabase.from("copilot_conversations")
  .select("id,title,context_kind,context_record_id,last_activity_at,created_at")
  .eq("organization_id",c.workspace.id).eq("owner_user_id",c.claims.sub)
  .eq("id",id).maybeSingle();
 if(error)throw new Error("COPILOT_CONVERSATION_UNAVAILABLE");
 return data as Cx2Conversation|null;
}
export async function loadCx2Messages(c:Cx2Auth,id:string,limit=30,before?:string){
 const con=await findCx2Conversation(c,id);if(!con)return null;
 let q=c.supabase.from("copilot_messages")
  .select("id,role,content,status,created_at,request_id")
  .eq("organization_id",c.workspace.id).eq("owner_user_id",c.claims.sub)
  .eq("conversation_id",id).order("created_at",{ascending:false})
  .order("id",{ascending:false}).limit(limit);
 if(before)q=q.lt("created_at",before);
 const {data,error}=await q;
 if(error)throw new Error("COPILOT_MESSAGES_UNAVAILABLE");
 return {conversation:con,messages:((data??[]) as Cx2Message[]).reverse()};
}
export async function createCx2Conversation(c:Cx2Auth,input:{
 title?:string;contextKind?:string|null;contextRecordId?:string|null;
}):Promise<Cx2Conversation>{
 const {data,error}=await createAdminClient().from("copilot_conversations")
  .insert({organization_id:c.workspace.id,owner_user_id:c.claims.sub,
   title:typeof input.title==="string"&&input.title.trim()?titleFromQuestion(input.title):"Uusi keskustelu",
   context_kind:input.contextKind??null,context_record_id:input.contextRecordId??null})
  .select("id,title,context_kind,context_record_id,last_activity_at,created_at").single();
 if(error||!data)throw new Error("COPILOT_CONVERSATION_CREATE_FAILED");
 await saveCx2Preferences(c,{lastConversationId:data.id});
 return data as Cx2Conversation;
}
export async function renameCx2Conversation(c:Cx2Auth,id:string,title:string){
 if(!await findCx2Conversation(c,id))return null;
 const {data,error}=await createAdminClient().from("copilot_conversations")
  .update({title:titleFromQuestion(title),updated_at:new Date().toISOString()})
  .eq("id",id).eq("organization_id",c.workspace.id).eq("owner_user_id",c.claims.sub)
  .select("id,title").maybeSingle();
 if(error||!data)throw new Error("COPILOT_CONVERSATION_UPDATE_FAILED");
 return data;
}
export async function deleteCx2Conversation(c:Cx2Auth,id:string){
 if(!await findCx2Conversation(c,id))return false;
 const {error}=await createAdminClient().from("copilot_conversations")
  .delete().eq("id",id).eq("organization_id",c.workspace.id).eq("owner_user_id",c.claims.sub);
 if(error)throw new Error("COPILOT_CONVERSATION_DELETE_FAILED");
 const prefs=await loadCx2Preferences(c);
 if(prefs.lastConversationId===id)await saveCx2Preferences(c,{lastConversationId:null});
 return true;
}
export async function loadCx2History(c:Cx2Auth,convId:string){
 const loaded=await loadCx2Messages(c,convId,24);
 if(!loaded)throw new Error("COPILOT_CONVERSATION_FORBIDDEN");
 return buildCopilotHistory(loaded.messages.map(x=>({
  role:x.role,text:x.content,stage:x.status==="completed"?"done":x.status==="cancelled"?"stopped":"error",
 })));
}
export async function beginCx2Turn(c:Cx2Auth,convId:string,requestId:string,question:string){
 if(!validCx2Id(requestId) || !await findCx2Conversation(c,convId))
  throw new Error("COPILOT_CONVERSATION_FORBIDDEN");
 const admin=createAdminClient();
 const {error}=await admin.from("copilot_messages").insert({
  conversation_id:convId,organization_id:c.workspace.id,owner_user_id:c.claims.sub,
  request_id:requestId,role:"user",content:question,status:"completed",
  completed_at:new Date().toISOString(),
 });
 // Unique request_id prevents duplicate AI calls after retry, including across devices.
 if(error)throw new Error(error.code==="23505"?"COPILOT_DUPLICATE_REQUEST":"COPILOT_MESSAGE_WRITE_FAILED");
 const {error:pendingError}=await admin.from("copilot_messages").insert({
  conversation_id:convId,organization_id:c.workspace.id,owner_user_id:c.claims.sub,
  request_id:requestId,role:"assistant",content:"",status:"pending",
 });
 if(pendingError)throw new Error("COPILOT_PENDING_RESPONSE_FAILED");
 await admin.from("copilot_conversations").update({last_activity_at:new Date().toISOString()})
  .eq("organization_id",c.workspace.id).eq("owner_user_id",c.claims.sub).eq("id",convId);
}
export async function finishCx2Turn(c:Cx2Auth,convId:string,requestId:string,answer:string){
 if(!answer.trim() || answer.length>6000)throw new Error("COPILOT_RESPONSE_INVALID");
 const {data,error}=await createAdminClient().from("copilot_messages")
  .update({status:"completed",content:answer,completed_at:new Date().toISOString()})
  .eq("conversation_id",convId).eq("organization_id",c.workspace.id)
  .eq("owner_user_id",c.claims.sub).eq("request_id",requestId)
  .eq("role","assistant").eq("status","pending").select("id").maybeSingle();
 if(error||!data)throw new Error("COPILOT_RESPONSE_PERSIST_FAILED");
}
export async function failCx2Turn(c:Cx2Auth,convId:string,requestId:string,reason:"failed"|"cancelled"){
 await createAdminClient().from("copilot_messages")
  .update({status:reason}).eq("conversation_id",convId)
  .eq("organization_id",c.workspace.id).eq("owner_user_id",c.claims.sub)
  .eq("request_id",requestId).eq("role","assistant").eq("status","pending");
}
