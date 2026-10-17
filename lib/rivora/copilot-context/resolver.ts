import type { createClient } from "@/lib/supabase/server";
import { verifyContextMembership } from "./authorization";
import { getOrdersOverview } from "./orders";
import { getOrdersPriority } from "./order-priority";
import { analyzeRfq } from "./analysis";
import { chooseRfqContextQuery } from "./rfq-intent";
import { chooseRfqFollowUp, type FollowUpMessage } from "./rfq-follow-up";
import { readAuthorizedRfqSnapshot } from "./rfq-access";
import { explainRfq, serializeRfqExplanation, type RfqIntelligenceContext } from "./rfq-explanation";
import type { ActiveRecord, CopilotContextResult, ContextQuery } from "./types";

type ScopedDb=Awaited<ReturnType<typeof createClient>>;
export function chooseContextQuery(
  question: string, area: string,
  activeRecord: ActiveRecord | null = null, rfqEnabled = false,
  analysisEnabled = false, history: readonly FollowUpMessage[] = [],
): ContextQuery | null {
  if (typeof question!=="string" || question.length>1200) return null;
  const followUp = chooseRfqFollowUp(question,history,activeRecord,rfqEnabled);
  if (followUp) return followUp;
  const rfqQuery = chooseRfqContextQuery(question,activeRecord,rfqEnabled);
  if (rfqQuery) return rfqQuery;
  // Route priority only when independently enabled and the intent is explicit.
  if (analysisEnabled && area === "orders" &&
      /priorit|tärkeimm|kiireellis|järjestyk|mihin.*(tartu|tarttua|aloit)|ensin|what.*first|priority/i.test(question))
    return { kind:"orders_priority",limit:5 };
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
  if (args.query.kind!=="orders_overview" && args.query.kind!=="orders_priority")
    throw new Error("COPILOT_CONTEXT_TOOL_UNAVAILABLE");
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),5000);
  const cancel=()=>controller.abort();
  args.abort?.addEventListener("abort",cancel,{once:true});
  try {
    if (controller.signal.aborted) throw new Error("COPILOT_CONTEXT_ABORTED");
    await verifyContextMembership(args.db,args.actorId,args.organizationId,controller.signal);
    if (args.abort?.aborted) throw new Error("COPILOT_CONTEXT_ABORTED");
    if (args.query.kind==="orders_priority")
      return await getOrdersPriority(args.db,args.organizationId,args.locale,
        args.query.limit,controller.signal);
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
  locale: "fi" | "en";
  analyze?: boolean;
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
    const explanation=explainRfq(snapshot,focusLineNumber);
    const context=serializeRfqExplanation(explanation,args.locale);
    return args.analyze ? { ...context,analysis:analyzeRfq(explanation,args.locale) } : context;
  } finally {
    clearTimeout(timer);
    args.abort?.removeEventListener("abort", cancel);
  }
}
