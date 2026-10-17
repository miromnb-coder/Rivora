import type { ActiveRecord, ContextSource } from "./copilot-context/types";
import { isActiveRecordUuid, normalizeActiveRecord } from "./copilot-context/active-record.ts";
export type CopilotMessage = { role: "user" | "assistant"; text: string };
export type CopilotInput = {
  question: string;
  history: CopilotMessage[];
  locale: "fi" | "en";
  area: string;
  useWorkspaceData: boolean;
  workspaceId: string | null;
  activeRecord: ActiveRecord | null;
};
const areas = new Set([
  "overview", "orders", "customers", "products", "leads", "inbox",
  "rfq", "quotes", "purchase-orders", "sales-orders", "settings", "upload", "memory",
]);
export function normalizeCopilotInput(value: unknown):
  | { ok: true; input: CopilotInput }
  | { ok: false; reason: "invalid" } {
  if (!value || typeof value !== "object" || Array.isArray(value)) return { ok: false, reason: "invalid" };
  const body = value as Record<string, unknown>;
  if (typeof body.question !== "string" || body.question.trim().length < 2 ||
      body.question.trim().length > 1200 || !Array.isArray(body.history) ||
      body.history.length > 8) return { ok: false, reason: "invalid" };
  if (body.workspaceId != null && !isActiveRecordUuid(body.workspaceId))
    return { ok: false, reason: "invalid" };
  const activeRecord = normalizeActiveRecord(body.activeRecord);
  if (body.activeRecord != null && !activeRecord)
    return { ok: false, reason: "invalid" };
  const history: CopilotMessage[] = [];
  for (const value of body.history) {
    if (!value || typeof value !== "object" || Array.isArray(value)) return { ok: false, reason: "invalid" };
    const item = value as Record<string, unknown>;
    if ((item.role !== "user" && item.role !== "assistant") ||
        typeof item.text !== "string" || !item.text.trim() ||
        item.text.length > 1800) return { ok: false, reason: "invalid" };
    history.push({ role: item.role, text: item.text.trim() });
  }
  return { ok: true, input: {
    question: body.question.trim(), history,
    locale: body.locale === "en" ? "en" : "fi",
    area: typeof body.area === "string" && areas.has(body.area) ? body.area : "overview",
    useWorkspaceData: body.useWorkspaceData === true,
    workspaceId: typeof body.workspaceId === "string" ? body.workspaceId.toLowerCase() : null,
    activeRecord,
  }};
}
// Self-contained transport validator: Node's native TS test runner must be
// able to import the protocol without Next.js alias resolution.
const CASE_HREF = /^\/app\/orders\/case\/(rfq|quote|po|sales)\/([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})$/i;
function validContextSource(value: unknown): value is ContextSource {
  if (!value || typeof value !== "object") return false;
  const s=value as Record<string,unknown>;
  return typeof s.kind === "string" &&
    ["rfq","quote","po","sales"].includes(s.kind) &&
    typeof s.recordId==="string" && typeof s.sourceId==="string" &&
    s.sourceId===s.kind+":"+s.recordId &&
    typeof s.label==="string" && s.label.length<=100 &&
    typeof s.href==="string" && CASE_HREF.test(s.href) &&
    s.href==="/app/orders/case/"+s.kind+"/"+s.recordId;
}

export type CopilotFinding = {
  id: string;
  code: string;
  severity: "critical" | "high" | "medium" | "info";
  title: string;
  explanation: string;
  suggestedAction: string;
  sourceId: string;
};
export type CopilotFindingsEvent = {
  type: "findings";
  kind: "orders_priority" | "rfq_review";
  partial: boolean;
  /** Counts are measured on the server, never inferred from list length. */
  inspectedCount?: number;
  retrievedCount?: number;
  totalCount?: number | null;
  findings: CopilotFinding[];
};
const FINDING_CODES = new Set([
  "ORDER_ERP_FAILURE", "ORDER_PO_REVIEW", "ORDER_RFQ_REVIEW",
  "ORDER_QUOTE_ACTION", "ORDER_ERP_READY",
  "RFQ_PROCESSING_FAILED", "RFQ_LINE_UNMATCHED", "RFQ_EXTRACTION_UNCERTAIN",
  "RFQ_LINE_UNCONFIRMED", "RFQ_REVIEW_REMAINING", "RFQ_READY_FOR_QUOTE",
]);
const SOURCE_ID = /^(rfq|quote|po|sales):[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function validFinding(value: unknown): value is CopilotFinding {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const item = value as Record<string, unknown>;
  return typeof item.id === "string" && item.id.length > 0 && item.id.length <= 100 &&
    typeof item.code === "string" && FINDING_CODES.has(item.code) &&
    typeof item.severity === "string" &&
      ["critical", "high", "medium", "info"].includes(item.severity) &&
    typeof item.title === "string" && item.title.trim().length > 0 &&
      item.title.length <= 100 &&
    typeof item.explanation === "string" && item.explanation.length <= 200 &&
    typeof item.suggestedAction === "string" &&
      item.suggestedAction.trim().length > 0 && item.suggestedAction.length <= 150 &&
    typeof item.sourceId === "string" && SOURCE_ID.test(item.sourceId);
}
export type CopilotEvent =
  | { type: "stage"; stage: "retrieving" | "verifying" | "connecting" | "responding" }
  | { type: "sources"; sources: ContextSource[]; truncated: boolean }
  | CopilotFindingsEvent
  | { type: "delta"; text: string }
  | { type: "done" }
  | { type: "error"; message: string };
export function encodeCopilotEvent(event: CopilotEvent) {
  return "event: " + event.type + "\ndata: " + JSON.stringify(event) + "\n\n";
}
export function decodeCopilotEvent(frame: string): CopilotEvent | null {
  const lines = frame.split("\n");
  const kind = lines.find(line => line.startsWith("event: "))?.slice(7).trim();
  const data = lines.filter(line => line.startsWith("data: ")).map(line => line.slice(6)).join("\n");
  if (!kind || !data) return null;
  try {
    const value: unknown = JSON.parse(data);
    if (!value || typeof value !== "object") return null;
    const item = value as Record<string, unknown>;
    if (kind === "stage" && item.type === "stage" &&
        (item.stage === "connecting" || item.stage === "responding" ||
         item.stage === "retrieving" || item.stage === "verifying"))
      return { type: "stage", stage: item.stage };
    if (kind === "sources" && item.type === "sources" &&
      Array.isArray(item.sources) && item.sources.length<=10 &&
      typeof item.truncated==="boolean" &&
      item.sources.every(validContextSource))
      return { type:"sources",sources:item.sources,truncated:item.truncated };
    if (kind === "findings" && item.type === "findings" &&
      (item.kind === "orders_priority" || item.kind === "rfq_review") &&
      typeof item.partial === "boolean" &&
      (item.inspectedCount === undefined ||
        (Number.isSafeInteger(item.inspectedCount) && (item.inspectedCount as number) >= 0 &&
         (item.inspectedCount as number) <= 10000)) &&
      (item.retrievedCount === undefined ||
        (Number.isSafeInteger(item.retrievedCount) && (item.retrievedCount as number) >= 0 &&
         (item.retrievedCount as number) <= 10000 &&
         (item.inspectedCount === undefined ||
          (item.retrievedCount as number) >= (item.inspectedCount as number)))) &&
      (item.totalCount === undefined || item.totalCount === null ||
        (Number.isSafeInteger(item.totalCount) && (item.totalCount as number) >= 0 &&
         (item.totalCount as number) <= 100000)) &&
      Array.isArray(item.findings) && item.findings.length <= 5 &&
      item.findings.every(validFinding) &&
      new Set((item.findings as CopilotFinding[]).map(f => f.id)).size === item.findings.length)
      return { type:"findings", kind:item.kind, partial:item.partial,
        ...(item.inspectedCount !== undefined ? {inspectedCount:item.inspectedCount as number} : {}),
        ...(item.retrievedCount !== undefined ? {retrievedCount:item.retrievedCount as number} : {}),
        ...(item.totalCount !== undefined ? {totalCount:item.totalCount as number | null} : {}),
        findings:item.findings as CopilotFinding[] };
    if (kind === "delta" && item.type === "delta" && typeof item.text === "string")
      return { type: "delta", text: item.text };
    if (kind === "done" && item.type === "done") return { type: "done" };
    if (kind === "error" && item.type === "error" && typeof item.message === "string")
      return { type: "error", message: item.message };
  } catch { /* Ignore malformed transport frames. */ }
  return null;
}
