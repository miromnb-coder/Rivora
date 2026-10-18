import type { Cx2Auth } from "./auth";
import { createAdminClient } from "@/lib/supabase/admin";
export const CX2_CONSENT_VERSION="cx2-workspace-context-v1";
export type Cx2Preferences={
 workspaceDataConsent:boolean;historyEnabled:boolean;lastConversationId:string|null;
 consentVersion:string|null;
};
const defaultPreferences: Cx2Preferences={
 workspaceDataConsent:false,historyEnabled:true,lastConversationId:null,consentVersion:null,
};
export async function loadCx2Preferences(c:Cx2Auth):Promise<Cx2Preferences>{
 const {data,error}=await c.supabase.from("copilot_user_preferences")
  .select("workspace_data_consent,history_enabled,last_conversation_id,consent_version")
  .eq("organization_id",c.workspace.id).eq("user_id",c.claims.sub).maybeSingle();
 if(error)throw new Error("COPILOT_PREFERENCES_UNAVAILABLE");
 if(!data)return {...defaultPreferences};
 return {workspaceDataConsent:data.workspace_data_consent===true &&
   data.consent_version===CX2_CONSENT_VERSION,
  historyEnabled:data.history_enabled===true,
  lastConversationId:data.last_conversation_id??null,
  consentVersion:data.consent_version??null};
}
export async function saveCx2Preferences(c:Cx2Auth, patch:{
 workspaceDataConsent?:boolean;historyEnabled?:boolean;lastConversationId?:string|null;
}):Promise<Cx2Preferences>{
 const prev=await loadCx2Preferences(c);
 const now=new Date().toISOString();
 const allow=patch.workspaceDataConsent??prev.workspaceDataConsent;
 const history=patch.historyEnabled??prev.historyEnabled;
 const {error}=await createAdminClient().from("copilot_user_preferences").upsert({
  organization_id:c.workspace.id,user_id:c.claims.sub,
  workspace_data_consent:allow,consent_version:allow?CX2_CONSENT_VERSION:null,
  consented_at:allow?now:null,revoked_at:allow?null:now,
  history_enabled:history,
  last_conversation_id:patch.lastConversationId===undefined?prev.lastConversationId:patch.lastConversationId,
  updated_at:now,
 },{onConflict:"organization_id,user_id"});
 if(error)throw new Error("COPILOT_PREFERENCES_WRITE_FAILED");
 return loadCx2Preferences(c);
}
