// Phase 7: customer rollout is separate from the existing one-owner pilot.
// Production fallback is DENY, even if a separate production capability gate
// has been marked ready. No global enablement is implemented here.
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_BETA_ORGS=10;
export function parseApprovedCustomerOrganizations(env:Record<string,string|undefined>):string[]|null {
 const value=env.AVEROMIRA_COPILOT_CUSTOMER_ORGANIZATION_IDS;
 if(typeof value!=="string" || value.length===0 || value.length>450)return null;
 const items=value.split(",").map(x=>x.trim().toLowerCase());
 if(items.length<1 || items.length>MAX_BETA_ORGS ||
   items.some(x=>!UUID.test(x)||x==="00000000-0000-0000-0000-000000000000") ||
   new Set(items).size!==items.length)return null;
 return items;
}
export function copilotCustomerAudienceAuthorizedForEnvironment(
 actorId:string, organizationId:string, role:string,
 env:Record<string,string|undefined>=process.env,
):boolean {
 // Preview remains isolated under its separate authentication/DB gate.
 if(env.VERCEL_ENV!=="production")return true;
 // Preserve the current SINGLE-actor private pilot's own verified gate.
 if(env.AVEROMIRA_COPILOT_PILOT_ENABLED==="true")return true;
 const allowlist=parseApprovedCustomerOrganizations(env);
 return env.AVEROMIRA_COPILOT_PHASE7_RELEASE_APPROVED==="true" &&
   env.AVEROMIRA_COPILOT_CUSTOMER_BETA_ENABLED==="true" &&
   UUID.test(actorId) && UUID.test(organizationId) &&
   ["owner","admin","member"].includes(role) &&
   allowlist!==null && allowlist.includes(organizationId.toLowerCase());
}
