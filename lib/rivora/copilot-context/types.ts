// Typed boundaries for Phase 5: no arbitrary SQL or model-selected database tools.
export type ActiveRecord = {
  kind: "rfq" | "quote" | "po" | "sales";
  id: string;
};
export type ContextSource = {
  sourceId: string;
  kind: "rfq" | "quote" | "po" | "sales";
  recordId: string;
  label: string;
  href: string;
};
export type ContextStatus = "ok" | "empty" | "partial" | "error";
export type OrderContextItem = {
  source: ContextSource["kind"];
  recordId: string;
  reference: string | null;
  customerName: string | null;
  stage: "rfq" | "quote" | "po" | "erp" | "done";
  status: string;
  attentionRequired: boolean;
  nextAction: string;
  updatedAt: string;
  href: string;
};
export type CopilotContextResult = {
  status: ContextStatus;
  retrievedAt: string;
  items: OrderContextItem[];
  sources: ContextSource[];
  truncated: boolean;
};
export type ContextQuery =
  | { kind: "orders_overview"; filter: "attention" | "all"; limit: number }
  | { kind: "rfq_review"; recordId: string; limit: number }
  | { kind: "rfq_line_explanation"; recordId: string; lineNumber: number; limit: number };
export class ContextReadError extends Error {
  readonly code: string;
  constructor(code: string) {
    super(code);
    this.code = code;
    this.name = "ContextReadError";
  }
}
