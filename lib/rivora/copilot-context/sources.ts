import type { CaseRow } from "@/lib/rivora/order-cases";
import type { ContextSource } from "./types";
import { safeContextText } from "./sanitize";

const CASE_HREF=/^\/app\/orders\/case\/(rfq|quote|po|sales)\/([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})$/i;
export function sourceFromCase(row: CaseRow): ContextSource | null {
  const match=CASE_HREF.exec(row.href);
  if (!match) return null;
  const kind=match[1] as ContextSource["kind"];
  const recordId=match[2];
  return {
    sourceId: kind + ":" + recordId, kind, recordId,
    label: safeContextText(row.poNumber || row.quoteNumber || row.rfqReference || row.customer,100),
    href: "/app/orders/case/" + kind + "/" + recordId,
  };
}
export function validContextSource(source: unknown): source is ContextSource {
  if (!source || typeof source!=="object") return false;
  const item=source as Record<string,unknown>;
  return typeof item.sourceId==="string" &&
    typeof item.kind==="string" && ["rfq","quote","po","sales"].includes(item.kind) &&
    typeof item.recordId==="string" &&
    item.sourceId===item.kind+":"+item.recordId &&
    typeof item.href==="string" &&
    item.href==="/app/orders/case/"+item.kind+"/"+item.recordId &&
    CASE_HREF.test(item.href) &&
    typeof item.label==="string" && item.label.length<=100;
}
