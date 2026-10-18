import {NextResponse} from "next/server";
import {cx2Enabled,requireCx2Actor,validWriteOrigin,NO_STORE} from "@/lib/rivora/copilot-conversations/auth";
import {loadCx2Preferences,saveCx2Preferences} from "@/lib/rivora/copilot-conversations/preferences";
export const runtime="nodejs";export const dynamic="force-dynamic";
const reply=(value:unknown,status=200)=>NextResponse.json(value,{status,headers:NO_STORE});
export async function GET(){
 try{
  const actor=await requireCx2Actor();if(!actor||!cx2Enabled())return reply({error:"Unavailable"},403);
  return reply(await loadCx2Preferences(actor));
 }catch{return reply({error:"Preferences unavailable"},503);}
}
export async function PATCH(request:Request){
 if(!validWriteOrigin(request))return reply({error:"Forbidden origin"},403);
 if(!request.headers.get("content-type")?.includes("application/json"))return reply({error:"JSON required"},415);
 try{
  const actor=await requireCx2Actor();if(!actor)return reply({error:"Unavailable"},403);
  if(Number(request.headers.get("content-length")??0)>1024)return reply({error:"Too large"},413);
  const value:unknown=await request.json();if(!value||typeof value!=="object"||Array.isArray(value))return reply({error:"Invalid request"},400);
  const input=value as Record<string,unknown>;
  const keys=Object.keys(input);
  if(!keys.length||keys.length>2||keys.some(x=>!["workspaceDataConsent","historyEnabled"].includes(x))||
    keys.some(x=>typeof input[x]!=="boolean"))return reply({error:"Invalid settings"},400);
  const result=await saveCx2Preferences(actor,{
   ...(typeof input.workspaceDataConsent==="boolean"?{workspaceDataConsent:input.workspaceDataConsent}:{}),
   ...(typeof input.historyEnabled==="boolean"?{historyEnabled:input.historyEnabled}:{}),
  });
  return reply(result);
 }catch{return reply({error:"Could not update preferences"},503);}
}
