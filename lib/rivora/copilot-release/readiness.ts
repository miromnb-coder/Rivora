// Pure Phase 7 release decision. CI may test this policy, but must NEVER
// forge human sign-offs, restore results or deployment evidence.
export type GateName =
  "exactCommit" | "productionDbConnection" | "backupIntegrity" |
  "databaseRestore" | "storageRestore" | "rollbackRehearsal" |
  "twoTenantIsolation" | "billingReconciliation" | "privacyReview" |
  "phase5Pilot" | "phase6Pilot" | "phase7Pilot" | "ownerApproval";

export type GateEvidence = {
  passed: boolean;
  checkedAt: string;
  reference: string;
  reviewer: string;
};
export type ReleaseManifest = {
  version: 1;
  targetCommit: string;
  deployedCommit: string;
  deploymentId: string;
  gates: Partial<Record<GateName, GateEvidence>>;
  acceptance: {
    phase5: {total:number;passed:number;criticalFailures:number};
    phase6: {total:number;passed:number;criticalFailures:number};
    phase7: {total:number;passed:number;criticalFailures:number};
  };
};
export const REQUIRED_GATES: readonly GateName[] = [
 "exactCommit","productionDbConnection","backupIntegrity","databaseRestore",
 "storageRestore","rollbackRehearsal","twoTenantIsolation",
 "billingReconciliation","privacyReview","phase5Pilot","phase6Pilot",
 "phase7Pilot","ownerApproval",
] as const;
const SHA=/^[0-9a-f]{40}$/i;
const DEPLOY=/^dpl_[a-zA-Z0-9]{10,40}$/;
function validEvidence(item: GateEvidence|undefined):boolean {
 if(!item || item.passed!==true || typeof item.checkedAt!=="string" ||
    Number.isNaN(Date.parse(item.checkedAt))) return false;
 const timestamp=Date.parse(item.checkedAt);
 // The sign-off must not be from a future clock timestamp.
 if(timestamp>Date.now()+60_000)return false;
 return typeof item.reference==="string" && item.reference.trim().length>=8 &&
   item.reference.length<=240 && typeof item.reviewer==="string" &&
   item.reviewer.trim().length>=2 && item.reviewer.length<=100;
}
function caseGate(value: {total:number;passed:number;criticalFailures:number}, min:number):boolean {
 return Number.isSafeInteger(value.total)&&value.total>=min &&
   Number.isSafeInteger(value.passed)&&value.passed>=0 &&
   value.passed<=value.total && Number.isSafeInteger(value.criticalFailures) &&
   value.criticalFailures===0 && value.passed/value.total>=0.9;
}
export function evaluateCopilotRelease(manifest:ReleaseManifest):{
 decision:"GO"|"NO_GO"; missing:string[]; passedGates:number;
} {
 const missing:string[]=[];
 if(!manifest || typeof manifest!=="object")return {decision:"NO_GO",missing:["invalid_manifest"],passedGates:0};
 if(!manifest.gates || typeof manifest.gates!=="object")return {decision:"NO_GO",missing:["missing_gates"],passedGates:0};
 if(manifest.version!==1) missing.push("manifest_version");
 if(!SHA.test(manifest.targetCommit) || manifest.targetCommit!==manifest.deployedCommit)
   missing.push("commit_mismatch");
 if(!DEPLOY.test(manifest.deploymentId)) missing.push("deployment_id_missing");
 for(const gate of REQUIRED_GATES)
   if(!validEvidence(manifest.gates[gate]))missing.push(gate);
 const counts=manifest.acceptance;
 if(!counts || !caseGate(counts.phase5,36))missing.push("phase5_acceptance");
 if(!counts || !caseGate(counts.phase6,56))missing.push("phase6_acceptance");
 if(!counts || !caseGate(counts.phase7,25))missing.push("phase7_acceptance");
 return {decision:missing.length?"NO_GO":"GO",
   missing,passedGates:REQUIRED_GATES.length-REQUIRED_GATES.filter(g=>missing.includes(g)).length};
}
export function emptyReleaseManifest(targetCommit:string):ReleaseManifest {
 return {version:1,targetCommit,deployedCommit:"",deploymentId:"",
   gates:{},acceptance:{
     phase5:{total:36,passed:0,criticalFailures:0},
     phase6:{total:56,passed:0,criticalFailures:0},
     phase7:{total:25,passed:0,criticalFailures:0},
   }};
}
