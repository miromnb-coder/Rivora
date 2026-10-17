import type { createClient } from "@/lib/supabase/server";
import { verifyContextMembership } from "./authorization";
import { getOrdersOverview } from "./orders";
import { readAuthorizedRfqSnapshot } from "./rfq-access";
import { explainRfq, serializeRfqExplanation, type RfqIntelligenceContext } from "./rfq-explanation";
import type { ActiveRecord, CopilotContextResult, ContextQuery } from "./types";

type ScopedDb=Awaited<ReturnType<typeof createClient>>;
export function chooseContextQuery(
  question: string, area: string,
  activeRecord: ActiveRecord | null = null, rfqEnabled = false,
): ContextQuery | null {
  if (typeof question!=="string" || question.length>1200) return null;
  // Only selected, authenticated RFQ pages may produce RFQ lookups.
  if (rfqEnabled && activeRecord?.kind==="rfq") {
    const lineMatch=/(?:rivi(?:lle|stä|n|ä|llä)?|line|row)\\s*#?(\\d{1,5})\\b/i.exec(question);
    const rfqIntent=/tarjouspyyn|rfq|rivi|rive|tuote|osum|match|product|explain|selit|miksi|why|tämän|tämä|tässä|tilanne|status|valmi|review|tarkist|seuraav|next|line|row/i.test(question);
    if (lineMatch || rfqIntent) {
      if (lineMatch) {
        const lineNumber=Number(lineMatch[1]);
        if (lineNumber>=1 && lineNumber<=100000)
          return {kind:"rfq_line_explanation",recordId:activeRecord.id,lineNumber,limit:10};
      }
      return {kind:"rfq_review",recordId:activeRecord.id,limit:10};
    }
  }
  // One deterministic allowed operation. No model-created queries or tool names.
  const orders=/tilau|työjon|huomiota vaativ|order|work queue|needs attention/i.test(question);
  if (!orders) return null; // Never fetch orders for unrelated questions.
  if (area==="orders" && /tarjouspyynnön rivi|rfq line|product match/i.test(question))
    return null; // Reserved for Phase 5.1, no fabricated line analysis.
  const attention=/huomi|urgent|attention|tärkeimm|seuraav|next|priorit/i.test(question);
  return { kind:"orders_overview",filter:attention?"attention":"all",limit:5 };
}
export async function resolveCopilotContext(args: {
  db:ScopedDb; actorId:string; organizationId:string;
  locale:"fi"|"en"; query:ContextQuery; abort?:AbortSignal;
}): Promise<CopilotContextResult> {
  if (args.query.kind!=="orders_overview") throw new Error("COPILOT_CONTEXT_TOOL_UNAVAILABLE");
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),5000);
  const cancel=()=>controller.abort();
  args.abort?.addEventListener("abort",cancel,{once:true});
  try {
    if (controller.signal.aborted) throw new Error("COPILOT_CONTEXT_ABORTED");
    await verifyContextMembership(args.db,args.actorId,args.organizationId,controller.signal);
    if (args.abort?.aborted) throw new Error("COPILOT_CONTEXT_ABORTED");
    return await getOrdersOverview(args.db,args.organizationId,args.locale,
      args.query.filter,args.query.limit,controller.signal);
  } finally {
    clearTimeout(timer);
    args.abort?.removeEventListener("abort",cancel);
  }
}

/** Separate resolver retains the Phase 5.0 orders return contract unchanged.
 * Uses only the allowlisted RFQ snapshot reader; no model-supplied SQL/tools.
 */
export async function resolveRfqIntelligenceContext(args: {
  db: ScopedDb; actorId: string; organizationId: string;
  query: Extract<ContextQuery, { kind: "rfq_review" | "rfq_line_explanation" }>;
  abort?: AbortSignal;
}): Promise<RfqIntelligenceContext> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5000);
  const cancel = () => controller.abort();
  args.abort?.addEventListener("abort", cancel, { once: true });
  if (args.abort?.aborted) controller.abort();
  try {
    if (controller.signal.aborted) throw new Error("COPILOT_CONTEXT_ABORTED");
    const focusLineNumber=args.query.kind==="rfq_line_explanation"
      ? args.query.lineNumber : undefined;
    const snapshot=await readAuthorizedRfqSnapshot({
      db:args.db, actorId:args.actorId, organizationId:args.organizationId,
      rfqId:args.query.recordId, focusLineNumber, signal:controller.signal,
    });
    if (controller.signal.aborted) throw new Error("COPILOT_CONTEXT_ABORTED");
    return serializeRfqExplanation(explainRfq(snapshot,focusLineNumber));
  } finally {
    clearTimeout(timer);
    args.abort?.removeEventListener("abort", cancel);
  }
}
