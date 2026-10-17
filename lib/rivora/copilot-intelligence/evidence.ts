// Source checks and serialization are server-generated and independent of AI prose.
import type { ContextSource } from "../copilot-context/types.ts";
import { validContextSource } from "../copilot-context/sources.ts";
import { EVIDENCE_CODES,EVIDENCE_LEVELS,type Phase6Evidence,type Phase6EvidenceEvent,type EvidenceFact } from "./types.ts";

// Keep reader validation and UI event filtering on the same fact rules.
// A blank/whitespace-only identifier or description cannot be trusted as evidence.
function validEvidenceFact(f:EvidenceFact, allowed:ReadonlySet<string>):boolean {
  return allowed.has(f.sourceId) && EVIDENCE_CODES.has(f.code) &&
    EVIDENCE_LEVELS.has(f.verification) &&
    f.factId.length<=96 && f.factId.trim().length>0 &&
    f.detail.length<=180 && f.detail.trim().length>0;
}
function validLimitation(value:string):boolean {
  return value.length<=140 && value.trim().length>0;
}
function factContentKey(f:EvidenceFact):string {
  return JSON.stringify([f.sourceId,f.code,f.detail,f.verification]);
}

export function verifiedEvidenceEvent(data:Phase6Evidence, sources:readonly ContextSource[]):Phase6EvidenceEvent|null {
  const allowed = new Set(sources.filter(validContextSource).map(s=>s.sourceId));
  const seenIds=new Set<string>(), seenContent=new Set<string>();
  const facts:EvidenceFact[]=[];
  for(const fact of data.facts){
    if(!validEvidenceFact(fact,allowed))continue;
    const contentKey=factContentKey(fact);
    if(seenIds.has(fact.factId)||seenContent.has(contentKey))continue;
    if(facts.length>=12)break;
    seenIds.add(fact.factId);
    seenContent.add(contentKey);
    facts.push(fact);
  }
  if(!facts.length)return null;
  const limitations=data.limitations.filter(validLimitation).slice(0,4);
  return {type:"evidence",kind:data.kind,
    partial:data.partial || facts.length!==data.facts.length ||
      limitations.length!==data.limitations.length,
    facts,limitations};
}
export function serializePhase6Evidence(data:Phase6Evidence):string {
  // The reader already validates, but fail closed if another caller bypasses it.
  if(!validatedPhase6Facts(data))throw new Error("PHASE6_EVIDENCE_INVALID");
  // Never include organization UUIDs, raw memory metadata, user email or secrets.
  const compact={
    kind:data.kind,
    retrievedAt:data.retrievedAt,
    partial:data.partial,
    facts:data.facts.slice(0,12).map(f=>({
      code:f.code,sourceId:f.sourceId,detail:f.detail,verification:f.verification,
    })),
    limitations:data.limitations.slice(0,4),
  };
  const value=JSON.stringify(compact);
  if(value.length>4200) throw new Error("PHASE6_EVIDENCE_TOO_LARGE");
  return value;
}
export function validatedPhase6Facts(data:Phase6Evidence):boolean {
  if(data.sources.length>8 || data.facts.length>12 || data.limitations.length>4)return false;
  const allowed=new Set(data.sources.map(s=>s.sourceId));
  if(allowed.size!==data.sources.length || !data.sources.every(validContextSource))return false;
  const seenIds=new Set<string>(), seenContent=new Set<string>();
  for(const fact of data.facts){
    const contentKey=factContentKey(fact);
    if(!validEvidenceFact(fact,allowed) ||
      seenIds.has(fact.factId) || seenContent.has(contentKey))return false;
    seenIds.add(fact.factId);
    seenContent.add(contentKey);
  }
  return data.limitations.every(validLimitation);
}
