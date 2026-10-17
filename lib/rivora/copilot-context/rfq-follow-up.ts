// Phase 5.1G: bounded, deterministic follow-ups. History is only a hint.
// Every resulting RFQ read is re-authorized using the current JWT/organization.
// Never use an AI answer, an arbitrary history record ID or a different workspace.
import type { ActiveRecord, ContextQuery } from "./types.ts";

export type FollowUpMessage = {role:"user"|"assistant";text:string};
const EXPLICIT_LINE=/(?:rivi(?:lle|stä|n|ä|llä)?|line|row)\\s*#?(\\d{1,5})\\b/i;
const FOLLOWUP=/^(?:entä (?:sen|sitä)|miksi (?:niin|sitä|se)|miten (?:sen|sitä)|onko (?:se|sitä)|mistä (?:se|tämä) tieto|what about (?:it|that)|why (?:that|it)|is it confirmed|and (?:that|it))\\??[.! ]*$/i;

export function chooseRfqFollowUp(
  question:string,history:readonly FollowUpMessage[],
  activeRecord:ActiveRecord|null,enabled:boolean,
): Extract<ContextQuery,{kind:"rfq_line_explanation"}>|null {
  if (!enabled || activeRecord?.kind!=="rfq" || typeof question!=="string" ||
      question.length>1200 || !FOLLOWUP.test(question.trim())) return null;
  // Restrict references to the immediate prior user turn. Assistant text may
  // contain fabricated references and must never choose the target line.
  const prior = [...history].reverse().find(item=>item.role==="user");
  if (!prior || typeof prior.text!=="string" || prior.text.length>1200) return null;
  const match=EXPLICIT_LINE.exec(prior.text);
  if(!match) return null;
  const lineNumber=Number(match[1]);
  if(!Number.isSafeInteger(lineNumber) || lineNumber<1 || lineNumber>100000)
    return null;
  return {kind:"rfq_line_explanation",recordId:activeRecord.id,lineNumber,limit:10};
}

export function ambiguousRfqFollowUp(
  question:string,activeRecord:ActiveRecord|null,enabled:boolean,
):boolean {
  return !!enabled && activeRecord?.kind==="rfq" && typeof question==="string" &&
    /^(?:entä toinen|entä se toinen|which one|what about the other)\\??[.! ]*$/i.test(question.trim());
}
