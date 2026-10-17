// Phase 5.1E: navigation is derived only from a validated source and a
// deterministic finding ID. Never accept a model-supplied path or fragment.
import type { ContextSource } from "./copilot-context/types.ts";

const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const LINE_FINDING=/^RFQ_(?:LINE_UNMATCHED|EXTRACTION_UNCERTAIN|LINE_UNCONFIRMED):([1-9][0-9]{0,4})$/;

export function verifiedFindingLink(source: ContextSource, findingId: string):
  {href:string;lineNumber:number|null} {
  const trustedCase="/app/orders/case/"+source.kind+"/"+source.recordId;
  if (!UUID.test(source.recordId) ||
    source.sourceId !== source.kind+":"+source.recordId ||
    source.href !== trustedCase) return {href:"",lineNumber:null};
  const match=source.kind==="rfq" ? LINE_FINDING.exec(findingId) : null;
  if (!match) return {href:source.href,lineNumber:null};
  const lineNumber=Number(match[1]);
  // The line anchor exists on the authenticated RFQ detail page.
  if (!Number.isSafeInteger(lineNumber) || lineNumber>10000)
    return {href:source.href,lineNumber:null};
  return {
    href:"/app/rfq/"+source.recordId+"#rfq-line-"+lineNumber,
    lineNumber,
  };
}
