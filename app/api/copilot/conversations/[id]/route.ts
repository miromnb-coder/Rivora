import {NextResponse} from "next/server";
import {requireCx2Actor,cx2HistoryEnabled,validWriteOrigin,validCx2Id,NO_STORE} from "@/lib/rivora/copilot-conversations/auth";
import {findCx2Conversation,loadCx2Messages,renameCx2Conversation,deleteCx2Conversation} from "@/lib/rivora/copilot-conversations/repository";
import {saveCx2Preferences,loadCx2Preferences} from "@/lib/rivora/copilot-conversations/preferences";
export const runtime="nodejs";export const dynamic="force-dynamic";
type Params={params:Promise<{id:string}>};
const reply=(value:unknown,status=200)=>NextResponse.json(value,{status,headers:NO_STORE});
export async function GET(request:Request,{params}:Params){
 try{
  const actor=await requireCx2Actor(),{id}=await params;
  if(!actor||!cx2HistoryEnabled())return reply({error:"History unavailable"},403);
  if(!validCx2Id(id))return reply({error:"Invalid conversation"},400);
  const query=new URL(request.url).searchParams;
  const limit=Number(query.get("limit")??30),before=query.get("before");
  if(!Number.isSafeInteger(limit)||limit<1||limit>30||
    (before!==null&&(before.length>60||Number.isNaN(Date.parse(before)))))
    return reply({error:"Invalid pagination"},400);
  const data=await loadCx2Messages(actor,id,limit,before??undefined);
  return data?reply(data):reply({error:"Not found"},404);
 }catch{return reply({error:"Conversation unavailable"},503);}
}
export async function PATCH(request:Request,{params}:Params){
 if(!validWriteOrigin(request))return reply({error:"Forbidden origin"},403);
 if(!request.headers.get("content-type")?.includes("application/json"))return reply({error:"JSON required"},415);
 try{
  const actor=await requireCx2Actor(),{id}=await params;
  if(!actor||!cx2HistoryEnabled())return reply({error:"History unavailable"},403);
  if(!validCx2Id(id))return reply({error:"Invalid conversation"},400);
  const data:unknown=await request.json();
  if(!data||typeof data!=="object"||Array.isArray(data))return reply({error:"Invalid request"},400);
  const input=data as Record<string,unknown>;
  const keys=Object.keys(input);
  if(!keys.length||keys.some(k=>!["title","activate"].includes(k))||
    (input.title!==undefined && (typeof input.title!=="string"||
      !input.title.trim()||input.title.length>100))||
    (input.activate!==undefined && input.activate!==true))
    return reply({error:"Invalid changes"},400);
  const found=await findCx2Conversation(actor,id);if(!found)return reply({error:"Not found"},404);
  const renamed=typeof input.title==="string"?
    await renameCx2Conversation(actor,id,input.title):null;
  if(input.activate===true){
   const prefs=await loadCx2Preferences(actor);
   if(!prefs.historyEnabled)return reply({error:"History disabled"},403);
   await saveCx2Preferences(actor,{lastConversationId:id});
  }
  return reply({conversation:renamed??found});
 }catch{return reply({error:"Could not update conversation"},503);}
}
export async function DELETE(request:Request,{params}:Params){
 if(!validWriteOrigin(request))return reply({error:"Forbidden origin"},403);
 try{
  const actor=await requireCx2Actor(),{id}=await params;
  if(!actor||!cx2HistoryEnabled())return reply({error:"History unavailable"},403);
  if(!validCx2Id(id))return reply({error:"Invalid conversation"},400);
  return await deleteCx2Conversation(actor,id)?reply({deleted:true}):reply({error:"Not found"},404);
 }catch{return reply({error:"Could not delete conversation"},503);}
}
