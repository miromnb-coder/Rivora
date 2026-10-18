import {NextResponse} from "next/server";
import {cx2HistoryEnabled,requireCx2Actor,validWriteOrigin,validCx2Id,NO_STORE} from "@/lib/rivora/copilot-conversations/auth";
import {createCx2Conversation,listCx2Conversations} from "@/lib/rivora/copilot-conversations/repository";
import {verifyActiveRecordAccess} from "@/lib/rivora/copilot-context/active-record";
import {loadCx2Preferences} from "@/lib/rivora/copilot-conversations/preferences";
export const runtime="nodejs";export const dynamic="force-dynamic";
const reply=(value:unknown,status=200)=>NextResponse.json(value,{status,headers:NO_STORE});
export async function GET(request:Request){
 try{
  const actor=await requireCx2Actor();
  if(!actor||!cx2HistoryEnabled())return reply({error:"History unavailable"},403);
  const params=new URL(request.url).searchParams;
  const limit=Number(params.get("limit")??20);
  const before=params.get("before");
  if(!Number.isSafeInteger(limit)||limit<1||limit>20||
    (before!==null&&(before.length>60||Number.isNaN(Date.parse(before)))))
    return reply({error:"Invalid pagination"},400);
  const conversations=await listCx2Conversations(actor,limit,before??undefined);
  const preferences=await loadCx2Preferences(actor);
  return reply({conversations,lastConversationId:preferences.lastConversationId});
 }catch{return reply({error:"History unavailable"},503);}
}
export async function POST(request:Request){
 if(!validWriteOrigin(request))return reply({error:"Forbidden origin"},403);
 if(!request.headers.get("content-type")?.includes("application/json"))return reply({error:"JSON required"},415);
 try{
  const actor=await requireCx2Actor();
  if(!actor||!cx2HistoryEnabled())return reply({error:"History unavailable"},403);
  const prefs=await loadCx2Preferences(actor);
  if(!prefs.historyEnabled)return reply({error:"History disabled"},403);
  if(Number(request.headers.get("content-length")??0)>1024)return reply({error:"Too large"},413);
  const raw:unknown=await request.json();
  if(!raw||typeof raw!=="object"||Array.isArray(raw))return reply({error:"Invalid request"},400);
  const data=raw as Record<string,unknown>;
  if(Object.keys(data).some(x=>!["title","workspaceId","contextKind","contextRecordId"].includes(x)))
    return reply({error:"Invalid keys"},400);
  if(data.workspaceId!==actor.workspace.id)return reply({error:"Selected workspace changed"},409);
  if(data.title!==undefined && (typeof data.title!=="string"||data.title.length>120))
    return reply({error:"Invalid title"},400);
  const kind=data.contextKind??null,record=data.contextRecordId??null;
  const validKind=kind==="rfq"||kind==="quote"||kind==="po"||kind==="sales";
  if(kind!==null||record!==null){
   if(!validKind||!validCx2Id(record))return reply({error:"Invalid record"},400);
   await verifyActiveRecordAccess(actor.supabase,actor.workspace.id,
     {kind:kind as "rfq"|"quote"|"po"|"sales",id:record as string},new AbortController().signal);
  }
  const created=await createCx2Conversation(actor,{
   ...(data.title!==undefined?{title:data.title as string}:{}),
   ...(validKind?{contextKind:kind as string,contextRecordId:record as string}:{})
  });
  return reply(created,201);
 }catch{return reply({error:"Could not create conversation"},503);}
}
