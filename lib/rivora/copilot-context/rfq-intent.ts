// Pure RFQ query selector: no DB access, no model-selected actions.
// The route separately verifies membership, active record and feature gates.
import type { ActiveRecord, ContextQuery } from "./types.ts";

export function chooseRfqContextQuery(
  question: string, activeRecord: ActiveRecord | null, enabled: boolean,
): Extract<ContextQuery, {kind:"rfq_review"|"rfq_line_explanation"}> | null {
  if (!enabled || activeRecord?.kind !== "rfq" ||
      typeof question !== "string" || question.length > 1200) return null;
  const lineMatch=/(?:rivi(?:lle|stä|n|ä|llä)?|line|row)\s*#?(\d{1,5})\b/i.exec(question);
  const rfqIntent=/tarjouspyyn|rfq|rivi|rive|tuote|osum|match|product|explain|selit|miksi|why|tämän|tämä|tässä|tilanne|status|valmi|review|tarkist|seuraav|next|line|row/i.test(question);
  if (lineMatch) {
    const lineNumber=Number(lineMatch[1]);
    if (!Number.isSafeInteger(lineNumber) || lineNumber<1 || lineNumber>100000)
      return null;
    return {kind:"rfq_line_explanation",recordId:activeRecord.id,lineNumber,limit:10};
  }
  if (!rfqIntent) return null;
  return {kind:"rfq_review",recordId:activeRecord.id,limit:10};
}
