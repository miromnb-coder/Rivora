// Source checks and serialization are server-generated and independent of AI prose.
import type { ContextSource } from "../copilot-context/types.ts";
import { validContextSource } from "../copilot-context/sources.ts";
import { EVIDENCE_CODES,EVIDENCE_LEVELS,type Phase6Evidence,type Phase6EvidenceEvent,type EvidenceFact } from "./types.ts";
export function verifiedEvidenceEvent(data:Phase6Evidence, sources:readonly ContextSource[]):Phase6EvidenceEvent|null {
  const allowed = new Set(sources.filter(validContextSource).map(s=>s.sourceId));
  const facts=data.facts.filter(f=>
    allowed.has(f.sourceId) && EVIDENCE_CODES.has(f.code) &&
    EVIDENCE_LEVELS.has(f.verification) && f.factId.length<=96 &&
    f.factId.length>0 && f.detail.length<=180 && f.detail.trim().length>0
  ).slice(0,12);
  if(!facts.length) return null;
  return {type:"evidence",kind:data.kind,
    partial:data.partial||facts.length<data.facts.length,
    facts,limitations:data.limitations.slice(0,4).map(x=>x.slice(0,140))};
}
export function serializePhase6Evidence(data:Phase6Evidence):string {
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
  return data.sources.length<=8 && data.facts.length<=12 &&
    new Set(data.sources.map(x=>x.sourceId)).size===data.sources.length &&
    data.sources.every(validContextSource) &&
    data.facts.every((f:EvidenceFact)=>data.sources.some(s=>s.sourceId===f.sourceId) &&
      EVIDENCE_CODES.has(f.code) && EVIDENCE_LEVELS.has(f.verification) &&
      f.detail.length<=180 && f.factId.length<=96) &&
    data.limitations.length<=4 && data.limitations.every(x=>x.length<=140);
}
