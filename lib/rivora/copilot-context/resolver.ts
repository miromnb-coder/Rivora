import type { createClient } from "@/lib/supabase/server";
import { verifyContextMembership } from "./authorization";
import { getOrdersOverview } from "./orders";
import type { CopilotContextResult, ContextQuery } from "./types";

type ScopedDb=Awaited<ReturnType<typeof createClient>>;
export function chooseContextQuery(question: string, area: string): ContextQuery | null {
  if (typeof question!=="string" || question.length>1200) return null;
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
