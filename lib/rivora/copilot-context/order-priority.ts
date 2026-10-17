// Phase 5.1C read-only queue ordering. Never fetch outside the current JWT/RLS workspace.
import type { createClient } from "@/lib/supabase/server";
import { loadOrderCases } from "@/lib/rivora/order-cases";
import { prioritizeOrderCases } from "./analysis";
import { sourceFromCase } from "./sources";
import { safeContextDate, safeContextText } from "./sanitize";
import type { CopilotContextResult, OrderContextItem } from "./types";

type ScopedDb=Awaited<ReturnType<typeof createClient>>;
export async function getOrdersPriority(
  db:ScopedDb, organizationId:string, locale:"fi"|"en",
  limit:number, signal:AbortSignal,
): Promise<CopilotContextResult> {
  const {cases,truncated:sourceTruncated}=await loadOrderCases(
    db,organizationId,locale==="fi",
    {strict:true,detectTruncation:true,signal},
  );
  const {chosen,analysis}=prioritizeOrderCases(cases,locale,limit,sourceTruncated);
  const sources=chosen.map(sourceFromCase);
  if(sources.some(source=>source===null))
    throw new Error("COPILOT_CONTEXT_INVALID_SOURCE");
  const safeSources=sources.filter((s):s is NonNullable<typeof s>=>s!==null);
  const items:OrderContextItem[]=chosen.map((row,index)=>{
    const source=safeSources[index];
    if(!source) throw new Error("COPILOT_CONTEXT_INVALID_SOURCE");
    return {
      source:source.kind,recordId:source.recordId,
      reference:safeContextText(row.poNumber||row.quoteNumber||row.rfqReference,100)||null,
      customerName:safeContextText(row.customer,100)||null,
      stage:row.stage,status:safeContextText(row.stageLabel,80),
      attentionRequired:row.attention,nextAction:safeContextText(row.nextAction,120),
      updatedAt:safeContextDate(row.updatedAt),href:source.href,
    };
  });
  return {
    status:items.length===0?"empty":analysis.partial?"partial":"ok",
    retrievedAt:new Date().toISOString(),
    items,sources:safeSources,truncated:analysis.partial,analysis,
  };
}
