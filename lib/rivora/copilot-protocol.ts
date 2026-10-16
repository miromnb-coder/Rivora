import type { ContextSource } from "./copilot-context/types";
export type CopilotMessage = { role: "user" | "assistant"; text: string };
export type CopilotInput = {
  question: string;
  history: CopilotMessage[];
  locale: "fi" | "en";
  area: string;
  useWorkspaceData: boolean;
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

export type CopilotEvent =
  | { type: "stage"; stage: "retrieving" | "verifying" | "connecting" | "responding" }
  | { type: "sources"; sources: ContextSource[]; truncated: boolean }
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
    if (kind === "delta" && item.type === "delta" && typeof item.text === "string")
      return { type: "delta", text: item.text };
    if (kind === "done" && item.type === "done") return { type: "done" };
    if (kind === "error" && item.type === "error" && typeof item.message === "string")
      return { type: "error", message: item.message };
  } catch { /* Ignore malformed transport frames. */ }
  return null;
}
