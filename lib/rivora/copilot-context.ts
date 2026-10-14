import type { SupabaseClient } from "@supabase/supabase-js";

export type CopilotTarget = { type: "general" | "dashboard" | "rfq" | "quote" | "product"; id?: string; lineId?: string };
export type CopilotSource = { type: "rfq" | "quote" | "product"; recordId: string; lineId?: string; lineNumber?: number; label: string };
export type CopilotContext = { target: CopilotTarget; label: string; status?: string; facts: Record<string, unknown>; sources: CopilotSource[]; incomplete: boolean };
export class CopilotContextError extends Error {
  status: 400 | 403 | 404 | 503;
  constructor(status: 400 | 403 | 404 | 503) { super("Copilot context unavailable"); this.status = status; }
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_LINES = 250;
const MAX_CANDIDATES = 3;
const snippet = (value: unknown, limit = 160) => typeof value === "string" ? value.slice(0, limit) : null;
const number = (value: unknown) => value === null || value === undefined || value === "" ? null : Number.isFinite(Number(value)) ? Number(value) : null;
const safeRows = <T>(data: T[] | null, error: unknown) => {
  if (error || !data) throw new CopilotContextError(503);
  return data;
};

export function parseCopilotTarget(value: unknown): CopilotTarget {
  if (!value || typeof value !== "object") throw new CopilotContextError(400);
  const item = value as Record<string, unknown>;
  if (!["general", "dashboard", "rfq", "quote", "product"].includes(String(item.type))) throw new CopilotContextError(400);
  const type = item.type as CopilotTarget["type"];
  if (type === "general" || type === "dashboard") {
    if (item.id || item.lineId) throw new CopilotContextError(400);
    return { type };
  }
  if (typeof item.id !== "string" || !UUID.test(item.id)) throw new CopilotContextError(400);
  if (item.lineId !== undefined && (type === "product" || typeof item.lineId !== "string" || !UUID.test(item.lineId))) throw new CopilotContextError(400);
  return { type, id: item.id.toLowerCase(), ...(item.lineId ? { lineId: String(item.lineId).toLowerCase() } : {}) };
}

export function sourceIsValid(context: CopilotContext, candidate: unknown): candidate is CopilotSource {
  if (!candidate || typeof candidate !== "object") return false;
  const source = candidate as CopilotSource;
  return context.sources.some((allowed) => allowed.type === source.type && allowed.recordId === source.recordId && allowed.lineId === source.lineId);
}

export function validatedSources(context: CopilotContext, candidates: unknown): CopilotSource[] {
  if (!Array.isArray(candidates)) return [];
  const seen = new Set<string>();
  return candidates.filter((candidate) => {
    if (!sourceIsValid(context, candidate)) return false;
    const key = `${candidate.recordId}:${candidate.lineId ?? ""}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, 8).map((candidate) => context.sources.find((source) => source.type === candidate.type && source.recordId === candidate.recordId && source.lineId === candidate.lineId)!);
}

export function quoteTotals(lines: Array<{ line_total: unknown; pricing_required: unknown }>, taxRate: unknown) {
  const subtotal = lines.reduce((sum, line) => sum + (number(line.line_total) ?? 0), 0);
  const missingPrices = lines.filter((line) => line.pricing_required === true).length;
  const tax = number(taxRate) ?? 0;
  const round = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;
  return { subtotal: round(subtotal), taxRate: tax, taxTotal: round(subtotal * tax / 100), total: round(subtotal * (1 + tax / 100)), missingPrices, complete: missingPrices === 0 };
}

export async function readCopilotHeader(db: Pick<SupabaseClient, "from">, organizationId: string, role: string, target: CopilotTarget) {
  if (!["owner", "admin", "member", "reviewer"].includes(role)) throw new CopilotContextError(403);
  if (target.type === "general" || target.type === "dashboard") return { target, label: target.type === "dashboard" ? "Dashboard" : "Averomira" };
  const table = { rfq: "rfqs", quote: "quotes", product: "products" }[target.type];
  const fields = { rfq: "id,reference,status", quote: "id,quote_number,status", product: "id,sku,active" }[target.type];
  const { data, error } = await db.from(table).select(fields).eq("id", target.id!).eq("organization_id", organizationId).maybeSingle();
  if (error) throw new CopilotContextError(503);
  if (!data) throw new CopilotContextError(404);
  const row = data as unknown as Record<string, unknown>;
  return { target, label: String(row.reference || row.quote_number || row.sku || target.id!.slice(0, 8)).slice(0, 80), status: typeof row.status === "string" ? row.status : undefined };
}

// All reads use the caller's RLS-scoped client and an explicit organization predicate.
// The accepted role comes from the server-side membership lookup, never the browser.
export async function readCopilotContext(db: Pick<SupabaseClient, "from">, organizationId: string, role: string, target: CopilotTarget, actorId?: string): Promise<CopilotContext> {
  if (!["owner", "admin", "member", "reviewer"].includes(role)) throw new CopilotContextError(403);
  if (target.type === "general") return { target, label: "Averomira", facts: {}, sources: [], incomplete: false };
  if (target.type === "dashboard") {
    const [rfqs, quotes] = await Promise.all([
      db.from("rfqs").select("id", { count: "exact", head: true }).eq("organization_id", organizationId).eq("status", "needs_review"),
      db.from("quotes").select("id", { count: "exact", head: true }).eq("organization_id", organizationId).eq("status", "draft"),
    ]);
    if (rfqs.error || quotes.error) throw new CopilotContextError(503);
    return { target, label: "Dashboard", facts: { rfqsNeedingReview: rfqs.count ?? 0, draftQuotes: quotes.count ?? 0 }, sources: [], incomplete: false };
  }
  if (target.type === "product") {
    const { data, error } = await db.from("products").select("id,sku,name,manufacturer,manufacturer_part_number,unit,unit_price,stock_quantity,active")
      .eq("id", target.id!).eq("organization_id", organizationId).maybeSingle();
    if (error) throw new CopilotContextError(503);
    if (!data) throw new CopilotContextError(404);
    const product = { id: data.id, sku: snippet(data.sku, 80), name: snippet(data.name), manufacturer: snippet(data.manufacturer), manufacturerPartNumber: snippet(data.manufacturer_part_number, 80), unit: data.unit, unitPrice: number(data.unit_price), stockQuantity: number(data.stock_quantity), active: data.active };
    return { target, label: String(data.sku), facts: { product, technicalCompatibilityVerified: false }, sources: [{ type: "product", recordId: data.id, label: String(data.sku) }], incomplete: false };
  }
  if (target.type === "rfq") {
    const { data: rfq, error } = await db.from("rfqs").select("id,reference,status,source_type,overall_confidence,extraction_confidence,extraction_warnings")
      .eq("id", target.id!).eq("organization_id", organizationId).maybeSingle();
    if (error) throw new CopilotContextError(503);
    if (!rfq) throw new CopilotContextError(404);
    const result = await db.from("rfq_lines").select("id,line_number,customer_sku,raw_description,quantity,unit,selected_product_id,match_confidence,match_method,review_status,extraction_confidence,source_page,extraction_notes")
      .eq("rfq_id", rfq.id).eq("organization_id", organizationId).order("line_number").limit(MAX_LINES + 1);
    const all = safeRows(result.data, result.error);
    const incomplete = all.length > MAX_LINES;
    const lines = all.slice(0, MAX_LINES);
    if (target.lineId && !lines.some((line) => line.id === target.lineId)) throw new CopilotContextError(404);
    const ids = lines.map((line) => line.id);
    const candidateResult = ids.length ? await awaitCandidates(db, organizationId, ids) : null;
    const candidates = candidateResult ? safeRows(candidateResult[0], candidateResult[1]) : [];
    const selectedIds = [...new Set(lines.map((line) => line.selected_product_id).filter((id): id is string => typeof id === "string"))];
    const selectedResult = selectedIds.length ? await db.from("products").select("id,sku,name,manufacturer,manufacturer_part_number,unit")
      .eq("organization_id", organizationId).in("id", selectedIds) : null;
    const selectedProducts = selectedResult ? safeRows(selectedResult.data, selectedResult.error) : [];
    const productById = new Map(selectedProducts.map((product) => [product.id, { id: product.id, sku: snippet(product.sku, 80), name: snippet(product.name), manufacturer: snippet(product.manufacturer, 80), manufacturerPartNumber: snippet(product.manufacturer_part_number, 80), unit: snippet(product.unit, 30) }]));
    const candidateMap = new Map<string, typeof candidates>();
    for (const candidate of candidates) {
      const current = candidateMap.get(candidate.rfq_line_id) ?? [];
      if (current.length < MAX_CANDIDATES) current.push(candidate);
      candidateMap.set(candidate.rfq_line_id, current);
    }
    const facts = lines.map((line) => ({
      id: line.id, number: line.line_number, customerSku: snippet(line.customer_sku, 80), description: snippet(line.raw_description), quantity: number(line.quantity), unit: snippet(line.unit, 30),
      selectedProductId: line.selected_product_id, selectedProduct: line.selected_product_id ? productById.get(line.selected_product_id) ?? null : null, matchConfidence: number(line.match_confidence), matchMethod: line.match_method, reviewStatus: line.review_status,
      extractionConfidence: number(line.extraction_confidence), sourcePage: line.source_page, extractionNotes: snippet(line.extraction_notes),
      candidates: (candidateMap.get(line.id) ?? []).map((candidate) => {
        const product = Array.isArray(candidate.products) ? candidate.products[0] : candidate.products;
        return { productId: candidate.product_id, confidence: number(candidate.confidence), method: candidate.method, rank: candidate.rank,
          product: product ? { id: product.id, sku: snippet(product.sku, 80), name: snippet(product.name), manufacturer: snippet(product.manufacturer, 80), manufacturerPartNumber: snippet(product.manufacturer_part_number, 80), unit: snippet(product.unit, 30) } : null };
      }),
    }));
    // The existing provenance RPC verifies membership itself and is only called
    // after the parent RFQ passed the RLS and organization checks above.
    let memoryExplanations: Array<{ rfq_line_id: string; source_value: string; verification_state: string; memory_source: string; target_product_id: string }> = [];
    if (actorId && (process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY)) {
      try {
        const { createAdminClient } = await import("@/lib/supabase/admin");
        const { data, error: memoryError } = await createAdminClient().rpc("get_rfq_product_memory_explanations_server", { target_rfq_id: rfq.id, target_actor_id: actorId });
        if (!memoryError && Array.isArray(data)) memoryExplanations = data;
      } catch { /* Existing match method and candidates remain available. */ }
    }
    const memoryByLine = new Map(memoryExplanations.map((item) => [item.rfq_line_id, item]));
    for (const line of facts) {
      const memory = memoryByLine.get(line.id);
      if (memory) Object.assign(line, { memory: { sourceValue: snippet(memory.source_value, 80), verificationState: memory.verification_state, source: memory.memory_source, productId: memory.target_product_id } });
    }
    return { target, label: snippet(rfq.reference, 80) || rfq.id.slice(0, 8), status: rfq.status,
      facts: { reference: snippet(rfq.reference, 80), status: rfq.status, sourceType: rfq.source_type, documentExtractionConfidence: number(rfq.extraction_confidence), documentWarnings: Array.isArray(rfq.extraction_warnings) ? rfq.extraction_warnings.slice(0, 5).map((warning: unknown) => snippet(warning, 120)) : [], lines: facts,
        inspectedLines: lines.length, truncated: incomplete, unconfirmed: lines.filter((line) => line.review_status !== "confirmed").length, unconfirmedLineNumbers: lines.filter((line) => line.review_status !== "confirmed").map((line) => line.line_number), unmatched: lines.filter((line) => !line.selected_product_id).length, unmatchedLineNumbers: lines.filter((line) => !line.selected_product_id).map((line) => line.line_number),
        readyForQuote: !incomplete && lines.length > 0 && lines.every((line) => line.review_status === "confirmed" && Boolean(line.selected_product_id)) && rfq.status === "ready", technicalCompatibilityVerified: false },
      sources: [{ type: "rfq", recordId: rfq.id, label: "RFQ" }, ...lines.map((line) => ({ type: "rfq" as const, recordId: rfq.id, lineId: line.id, lineNumber: line.line_number, label: `RFQ line ${line.line_number}` }))], incomplete };
  }
  const { data: quote, error } = await db.from("quotes").select("id,quote_number,status,currency,tax_rate,approved_at,delivery_status")
    .eq("id", target.id!).eq("organization_id", organizationId).maybeSingle();
  if (error) throw new CopilotContextError(503);
  if (!quote) throw new CopilotContextError(404);
  const result = await db.from("quote_lines").select("id,line_number,sku_snapshot,description_snapshot,quantity,unit,unit_price,pricing_required,discount_percent,line_total")
    .eq("quote_id", quote.id).eq("organization_id", organizationId).order("line_number").limit(MAX_LINES + 1);
  const all = safeRows(result.data, result.error);
  const incomplete = all.length > MAX_LINES;
  const lines = all.slice(0, MAX_LINES);
  if (target.lineId && !lines.some((line) => line.id === target.lineId)) throw new CopilotContextError(404);
  const totals = quoteTotals(lines, quote.tax_rate);
  return { target, label: quote.quote_number || quote.id.slice(0, 8), status: quote.status,
    facts: { quoteNumber: quote.quote_number, status: quote.status, approvalStatus: quote.approved_at ? "approved" : "not_approved", deliveryStatus: quote.delivery_status, currency: quote.currency,
      lines: lines.map((line) => ({ id: line.id, number: line.line_number, sku: snippet(line.sku_snapshot, 80), name: snippet(line.description_snapshot), quantity: number(line.quantity), unit: line.unit, unitPrice: line.pricing_required ? null : number(line.unit_price), pricingRequired: line.pricing_required, discountPercent: number(line.discount_percent), lineTotal: line.pricing_required ? null : number(line.line_total) })),
      totals: { ...totals, complete: totals.complete && !incomplete }, inspectedLines: lines.length, truncated: incomplete, missingPriceLineNumbers: lines.filter((line) => line.pricing_required).map((line) => line.line_number), discountedLineNumbers: lines.filter((line) => Number(line.discount_percent) > 0).map((line) => line.line_number) },
    sources: [{ type: "quote", recordId: quote.id, label: "Quote" }, ...lines.map((line) => ({ type: "quote" as const, recordId: quote.id, lineId: line.id, lineNumber: line.line_number, label: `Quote line ${line.line_number}` }))], incomplete };
}

async function awaitCandidates(db: Pick<SupabaseClient, "from">, organizationId: string, ids: string[]) {
  const result = await db.from("product_match_candidates").select("rfq_line_id,product_id,confidence,method,rank,products(id,sku,name,manufacturer,manufacturer_part_number,unit)")
    .eq("organization_id", organizationId).in("rfq_line_id", ids).lte("rank", MAX_CANDIDATES).order("rank").limit(MAX_LINES * MAX_CANDIDATES);
  return [result.data, result.error] as const;
}
