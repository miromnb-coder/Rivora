import type { SupabaseClient } from "@supabase/supabase-js";

// S7: The browser may request context, but never supplies table names or SQL.
// Only these paths, tenant-scoped fixed queries and safe aggregate facts can
// reach the language model. Customer names, prices, raw errors and documents
// are intentionally excluded.
export type SupportEvidence = {
  kind: "rfq" | "quote" | "purchase_order" | "sales_order" | "business_central" | "dashboard";
  status?: string;
  facts: Record<string, string | number | boolean>;
};

const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}";
const RECORD_ROUTE = new RegExp("^/app/(rfq|quotes|purchase-orders|sales-orders)/(" + UUID + ")$", "i");
const MAX_LINES = 100; // A further line is used to expose truncation, never to fetch unbounded rows.

export type RecordTarget =
  | { kind: "rfq" | "quote" | "purchase_order" | "sales_order"; id: string }
  | { kind: "business_central" | "dashboard" };

export function supportRecordTarget(path: string): RecordTarget | null {
  const clean = path.split("?")[0].split("#")[0];
  const caseRoute = new RegExp("^/app/orders/case/(rfq|quote|po|sales)/(" + UUID + ")$", "i").exec(clean);
  if (caseRoute) {
    const kinds = { rfq: "rfq", quote: "quote", po: "purchase_order", sales: "sales_order" } as const;
    return {
      kind: kinds[caseRoute[1].toLowerCase() as keyof typeof kinds],
      id: caseRoute[2].toLowerCase(),
    };
  }
  const record = RECORD_ROUTE.exec(clean);
  if (record) {
    const kind = ({ rfq: "rfq", quotes: "quote", "purchase-orders": "purchase_order", "sales-orders": "sales_order" } as const)[record[1].toLowerCase() as "rfq" | "quotes" | "purchase-orders" | "sales-orders"];
    return { kind, id: record[2].toLowerCase() };
  }
  if (clean === "/app/settings/business-central") return { kind: "business_central" };
  if (clean === "/app") return { kind: "dashboard" };
  return null;
}

function safeStatus(value: unknown): string {
  const result = typeof value === "string" ? value : "unknown";
  return /^[a-z][a-z0-9_]{0,30}$/.test(result) ? result : "unknown";
}

function count(rows: unknown): number {
  return Array.isArray(rows) ? Math.min(rows.length, MAX_LINES) : 0;
}

function complete(rows: unknown): boolean {
  return Array.isArray(rows) && rows.length <= MAX_LINES;
}

type Reader = Pick<SupabaseClient, "from">;

export async function readSupportEvidence(
  db: Reader,
  organizationId: string,
  role: string,
  path: string,
): Promise<SupportEvidence | null> {
  const target = supportRecordTarget(path);
  if (!target) return null;

  if (target.kind === "rfq") {
    const { data: rfq, error } = await db.from("rfqs")
      .select("id,status").eq("id", target.id).eq("organization_id", organizationId).maybeSingle();
    if (error || !rfq) return null;
    const { data: lines, error: lineError } = await db.from("rfq_lines")
      .select("review_status,selected_product_id").eq("rfq_id", target.id).limit(MAX_LINES + 1);
    if (lineError || !lines) return null;
    return {
      kind: "rfq", status: safeStatus(rfq.status),
      facts: {
        linesInspected: count(lines),
        completeLineCount: complete(lines),
        awaitingConfirmation: lines.slice(0, MAX_LINES).filter(line => line.review_status !== "confirmed").length,
        unmatchedLines: lines.slice(0, MAX_LINES).filter(line => !line.selected_product_id).length,
      },
    };
  }
  if (target.kind === "quote") {
    const { data: quote, error } = await db.from("quotes")
      .select("id,status,delivery_status").eq("id", target.id).eq("organization_id", organizationId).maybeSingle();
    if (error || !quote) return null;
    const { data: lines, error: lineError } = await db.from("quote_lines")
      .select("pricing_required").eq("quote_id", target.id).limit(MAX_LINES + 1);
    if (lineError || !lines) return null;
    return {
      kind: "quote", status: safeStatus(quote.status),
      facts: {
        deliveryStatus: safeStatus(quote.delivery_status),
        linesInspected: count(lines), completeLineCount: complete(lines),
        pricingRequired: lines.slice(0, MAX_LINES).filter(line => line.pricing_required === true).length,
      },
    };
  }
  if (target.kind === "purchase_order") {
    const { data: po, error } = await db.from("purchase_orders")
      .select("id,status").eq("id", target.id).eq("organization_id", organizationId).maybeSingle();
    if (error || !po) return null;
    const { data: reconciliations, error: reconciliationError } = await db.from("purchase_order_reconciliations")
      .select("id,status,header_review_status")
      .eq("purchase_order_id", target.id).eq("organization_id", organizationId)
      .order("run_number", { ascending: false }).limit(1);
    if (reconciliationError) return null;
    const reconciliation = reconciliations?.[0];
    if (!reconciliation) return {
      kind: "purchase_order", status: safeStatus(po.status),
      facts: { hasReconciliation: false },
    };
    const { data: lines, error: lineError } = await db.from("purchase_order_reconciliation_lines")
      .select("review_status,exception_codes")
      .eq("reconciliation_id", reconciliation.id).eq("organization_id", organizationId).limit(MAX_LINES + 1);
    if (lineError || !lines) return null;
    return {
      kind: "purchase_order", status: safeStatus(po.status),
      facts: {
        hasReconciliation: true,
        reconciliationStatus: safeStatus(reconciliation.status),
        headerReviewStatus: safeStatus(reconciliation.header_review_status),
        linesInspected: count(lines), completeLineCount: complete(lines),
        linesWithExceptions: lines.slice(0, MAX_LINES).filter(line =>
          Array.isArray(line.exception_codes) && line.exception_codes.length > 0).length,
        unreviewedLines: lines.slice(0, MAX_LINES).filter(line =>
          line.review_status !== "confirmed" && line.review_status !== "approved").length,
      },
    };
  }
  if (target.kind === "sales_order") {
    const { data: order, error } = await db.from("sales_order_drafts")
      .select("id,status").eq("id", target.id).eq("organization_id", organizationId).maybeSingle();
    if (error || !order) return null;
    const { data: attempts, error: attemptError } = await db.from("erp_delivery_attempts")
      .select("status").eq("sales_order_draft_id", target.id).eq("organization_id", organizationId)
      .order("created_at", { ascending: false }).limit(1);
    if (attemptError) return null;
    return {
      kind: "sales_order", status: safeStatus(order.status),
      facts: { hasDeliveryAttempt: Boolean(attempts?.length), latestAttemptStatus: safeStatus(attempts?.[0]?.status) },
    };
  }
  if (target.kind === "business_central") {
    // Even counts of ERP mappings are restricted to operators with editing rights.
    if (!["owner", "admin"].includes(role)) return null;
    const { count: mappingCount, error } = await db.from("erp_entity_mappings")
      .select("id", { count: "exact", head: true }).eq("organization_id", organizationId)
      .eq("provider", "business_central");
    if (error) return null;
    return { kind: "business_central", facts: { mappingCount: Math.min(mappingCount ?? 0, 1000000) } };
  }

  // Dashboard summary is deliberately restricted to two small aggregate counts.
  const [{ count: rfqCount, error: rfqError }, { count: poCount, error: poError }] = await Promise.all([
    db.from("rfqs").select("id", { count: "exact", head: true }).eq("organization_id", organizationId).eq("status", "needs_review"),
    db.from("purchase_orders").select("id", { count: "exact", head: true }).eq("organization_id", organizationId).eq("status", "needs_review"),
  ]);
  if (rfqError || poError) return null;
  return { kind: "dashboard", facts: { rfqsNeedingReview: rfqCount ?? 0, purchaseOrdersNeedingReview: poCount ?? 0 } };
}

export function supportEvidenceExcerpt(evidence: SupportEvidence | null): string {
  if (!evidence) return "No verified record summary available. Never infer record state.";
  return JSON.stringify(evidence).slice(0, 1600);
}
