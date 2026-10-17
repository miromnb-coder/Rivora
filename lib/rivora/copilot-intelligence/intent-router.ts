// Deterministic, narrow Phase 6 router, never chosen by the model.
import type { ActiveRecord } from "../copilot-context/types.ts";
import type { Phase6Intent } from "./types.ts";
export function choosePhase6Intent(question:string, record:ActiveRecord|null, enabled:boolean):Phase6Intent|null {
  if(!enabled || record?.kind!=="rfq" || typeof question!=="string" ||
     question.length>1200) return null;
  if(/muisti|muistivastin|memory|alkuper|provenien|why.*(?:match|suggest)|miksi.*(?:ehdot|tuote|osum)/i.test(question))
    return "memory_provenance";
  if(/vertaa|vertail|compare|versus|vs\.?/i.test(question) &&
     /tarjou|ostotilau|myyntitilau|tilausketj|quote|purchase|sales|order/i.test(question))
    return "business_comparison";
  if(/tarjou|ostotilau|myyntitilau|tilausketj|tapahtun|liittyv|ketju|quote|purchase|sales order|business chain|what happened/i.test(question))
    return "business_chain";
  return null;
}
// Only exact numbers from the present user turn or the immediately previous
// user turn; assistant prose must not choose the subject.
export function choosePhase6Line(
  question:string, history:readonly {role:"user"|"assistant";text:string}[],
):number|null {
  const line=/(?:rivi(?:lle|stä|n|ä|llä)?|line|row)\s*#?(\d{1,5})\b/i;
  const m=line.exec(question);
  const prior=[...history].reverse().find(x=>x.role==="user");
  const hint=!m && /^(?:miksi sitä|miksi näin|why that|what about it|onko se oikein)\??[.! ]*$/i.test(question.trim())
    ? prior && line.exec(prior.text) : null;
  const n=Number((m??hint)?.[1]);
  return Number.isSafeInteger(n)&&n>0&&n<=100000?n:null;
}

// References used for follow-up routing must originate in the most recent
// USER turn, never assistant prose or a customer-controlled model answer.
export function choosePhase6FollowUpIntent(
 question:string,history:readonly {role:"user"|"assistant";text:string}[],
 record:ActiveRecord|null,enabled:boolean,
):Phase6Intent|null {
 if(!enabled||record?.kind!=="rfq"||typeof question!=="string"||question.length>1200)
   return null;
 const prior=[...history].reverse().find(x=>x.role==="user");
 if(!prior || typeof prior.text!=="string" || prior.text.length>1200)return null;
 if(!/^(?:vertaa niitä|miten ne liittyvät|entä sen jälkeen|compare them|how are they related|and then)\??[.! ]*$/i.test(question.trim()))
   return null;
 const priorIntent=choosePhase6Intent(prior.text,record,true);
 return priorIntent==="business_chain" || priorIntent==="business_comparison"
   ? (/(vertaa|compare)/i.test(question)?"business_comparison":"business_chain")
   : null;
}
