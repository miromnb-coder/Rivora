import { getAuthContext } from "@/lib/rivora/workspace";
import { copilotActivationReadiness,copilotActorAuthorizedForEnvironment } from "@/lib/rivora/copilot-live";
import { copilotCustomerAudienceAuthorizedForEnvironment } from "@/lib/rivora/copilot-release/audience";
export function cx2Enabled() {return process.env.AVEROMIRA_COPILOT_CX2_ENABLED==="true";}
export function cx2HistoryEnabled(){return cx2Enabled()&&process.env.AVEROMIRA_COPILOT_HISTORY_ENABLED==="true";}
export function cx2ConsentEnabled(){return cx2Enabled()&&process.env.AVEROMIRA_COPILOT_PERSISTENT_CONSENT_ENABLED==="true";}
export type Cx2Auth = Awaited<ReturnType<typeof getAuthContext>> & {
  claims:{sub:string};workspace:{id:string;role:string};
};
export async function requireCx2Actor():Promise<Cx2Auth|null> {
 if(!cx2Enabled()||!copilotActivationReadiness().ready)return null;
 const c=await getAuthContext();
 if(!c.claims?.sub||!c.workspace)return null;
 if(!copilotActorAuthorizedForEnvironment(c.claims.sub,c.workspace.id,c.workspace.role) ||
  !copilotCustomerAudienceAuthorizedForEnvironment(c.claims.sub,c.workspace.id,c.workspace.role))
  return null;
 return c as Cx2Auth;
}
export function validCx2Id(value:unknown):value is string {
 return typeof value==="string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}
export function validWriteOrigin(request:Request):boolean{
 if(request.headers.get("sec-fetch-site")==="cross-site")return false;
 const origin=request.headers.get("origin");
 if(!origin)return true;
 try{return new URL(origin).origin===new URL(request.url).origin;}catch{return false;}
}
export const NO_STORE={"Cache-Control":"private, no-store"};
