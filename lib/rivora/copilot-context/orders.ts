import type { createClient } from "@/lib/supabase/server";
import { loadOrderCases } from "@/lib/rivora/order-cases";
import { safeContextDate, safeContextText } from "./sanitize";
import { sourceFromCase } from "./sources";
import type { CopilotContextResult, OrderContextItem } from "./types";

type ScopedDb = Awaited<ReturnType<typeof createClient>>;
export async function getOrdersOverview(
  db: ScopedDb, orgId: string, locale: "fi" | "en",
  filter: "attention" | "all", limit: number, signal: AbortSignal,
): Promise<CopilotContextResult> {
  if (!Number.isInteger(limit) || limit<1 || limit>10) throw new Error("COPILOT_CONTEXT_INVALID_LIMIT");
  const { cases, truncated: sourceTruncated } = await loadOrderCases(
    db, orgId, locale==="fi", { strict:true, detectTruncation:true, signal },
  );
  const filtered=filter==="attention"?cases.filter(c=>c.attention):cases;
  const chosen=filtered.slice(0,limit);
  const sources=chosen.map(sourceFromCase);
  const items: OrderContextItem[]=chosen.map((row,index)=>{
    const source=sources[index];
    if (!source) throw new Error("COPILOT_CONTEXT_INVALID_SOURCE");
    return {
      source:source.kind, recordId:source.recordId,
      reference:safeContextText(row.poNumber||row.quoteNumber||row.rfqReference,100)||null,
      customerName:safeContextText(row.customer,100)||null,
      stage:row.stage,status:safeContextText(row.stageLabel,80),
      attentionRequired:row.attention,nextAction:safeContextText(row.nextAction,120),
      updatedAt:safeContextDate(row.updatedAt),href:source.href,
    };
  });
  const truncated=sourceTruncated||filtered.length>limit;
  return {
    status:items.length===0?"empty":truncated?"partial":"ok",
    retrievedAt:new Date().toISOString(),items,
    sources:sources.filter((s):s is NonNullable<typeof s>=>s!==null),truncated,
  };
}
