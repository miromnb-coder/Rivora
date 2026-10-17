// Phase 5.1B.1: bounded, read-only RFQ data snapshot. Not wired to AI output.
// Call readAuthorizedRfqSnapshot (rfq-access.ts) from server routes, never this
// low-level loader directly: the authorized wrapper checks actor/workspace.
import type { createClient } from "@/lib/supabase/server";
import { isActiveRecordUuid } from "./active-record.ts";
import { safeContextText } from "./sanitize.ts";
import { ContextReadError } from "./types.ts";

type ScopedDb = Awaited<ReturnType<typeof createClient>>;

export const RFQ_LINE_SCAN_LIMIT = 50;
export const RFQ_MODEL_LINE_LIMIT = 10;
export const RFQ_CANDIDATE_LIMIT = 3;
const RFQ_CANDIDATE_SCAN_LIMIT = RFQ_MODEL_LINE_LIMIT * RFQ_CANDIDATE_LIMIT + 1;

export type RfqCandidateSnapshot = {
  productId: string;
  sku: string | null;
  name: string | null;
  confidence: number | null;
  method: string | null;
  rank: number;
};

export type RfqLineSnapshot = {
  id: string;
  lineNumber: number;
  customerSku: string | null;
  description: string | null;
  reviewStatus: string;
  selectedProductId: string | null;
  matchMethod: string | null;
  matchConfidence: number | null;
  extractionConfidence: number | null;
  candidates: RfqCandidateSnapshot[];
  candidatesComplete: boolean;
};

export type RfqDataSnapshot = {
  kind: "rfq_snapshot";
  rfqId: string;
  reference: string | null;
  status: string;
  sourceType: string;
  overallConfidence: number | null;
  extractionConfidence: number | null;
  extractionWarnings: string[] | null;
  totalLines: number;
  unresolvedLines: number;
  inspectedLines: number;
  selectedLines: number;
  allLinesInspected: boolean;
  quoteExists: boolean;
  lines: RfqLineSnapshot[];
  truncated: boolean;
  retrievedAt: string;
};

function fail(code: string): never {
  throw new ContextReadError(code);
}
function asObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) fail("COPILOT_RFQ_INVALID_DATA");
  return value as Record<string, unknown>;
}
function asText(value: unknown, max: number): string | null {
  if (value == null) return null;
  if (typeof value !== "string") fail("COPILOT_RFQ_INVALID_DATA");
  return safeContextText(value, max) || null;
}
function asNumber(value: unknown): number | null {
  if (value == null) return null;
  if (typeof value !== "string" && typeof value !== "number") fail("COPILOT_RFQ_INVALID_DATA");
  const number = typeof value === "string" && value.trim() === "" ? NaN : Number(value);
  if (!Number.isFinite(number) || number < 0 || number > 100) fail("COPILOT_RFQ_INVALID_DATA");
  return number;
}
function asNonnegativeInt(value: unknown): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0)
    fail("COPILOT_RFQ_COUNT_UNAVAILABLE");
  return value;
}
function asWarnings(value: unknown): string[] | null {
  if (value == null) return null;
  if (!Array.isArray(value) || value.some(item => typeof item !== "string"))
    fail("COPILOT_RFQ_INVALID_DATA");
  return value.slice(0, 10).map(item => safeContextText(item, 160));
}
function asRfqLine(row: unknown): RfqLineSnapshot {
  const item = asObject(row);
  if (!isActiveRecordUuid(item.id) || !Number.isSafeInteger(item.line_number) ||
      (item.line_number as number) < 1 || typeof item.review_status !== "string")
    fail("COPILOT_RFQ_INVALID_DATA");
  const product = item.selected_product_id;
  if (product != null && !isActiveRecordUuid(product)) fail("COPILOT_RFQ_INVALID_DATA");
  return {
    id: item.id.toLowerCase(),
    lineNumber: item.line_number as number,
    customerSku: asText(item.customer_sku, 100),
    description: asText(item.raw_description, 180),
    reviewStatus: safeContextText(item.review_status, 40),
    selectedProductId: product == null ? null : (product as string).toLowerCase(),
    matchMethod: asText(item.match_method, 40),
    matchConfidence: asNumber(item.match_confidence),
    extractionConfidence: asNumber(item.extraction_confidence),
    candidates: [], candidatesComplete: false,
  };
}
function asCandidate(row: unknown): { lineId: string; value: RfqCandidateSnapshot } {
  const item = asObject(row);
  if (!isActiveRecordUuid(item.rfq_line_id) || !isActiveRecordUuid(item.product_id) ||
      !Number.isSafeInteger(item.rank) || (item.rank as number) < 1)
    fail("COPILOT_RFQ_INVALID_DATA");
  const productInput = Array.isArray(item.products) ? item.products[0] : item.products;
  const product = asObject(productInput);
  if (!isActiveRecordUuid(product.id) || product.id.toLowerCase() !== item.product_id.toLowerCase())
    fail("COPILOT_RFQ_INVALID_DATA");
  return {
    lineId: item.rfq_line_id.toLowerCase(),
    value: {
      productId: item.product_id.toLowerCase(),
      sku: asText(product.sku, 100),
      name: asText(product.name, 120),
      confidence: asNumber(item.confidence),
      method: asText(item.method, 40),
      rank: item.rank as number,
    },
  };
}

// Snapshot is an internal data-layer primitive, NOT a public route or an AI tool.
// The caller must use a JWT/RLS-scoped client and an org validated by the wrapper.
export async function loadRfqSnapshot(
  db: ScopedDb, organizationId: string, rfqId: string, signal: AbortSignal,
  focusLineNumber?: number,
): Promise<RfqDataSnapshot> {
  if (!isActiveRecordUuid(organizationId) || !isActiveRecordUuid(rfqId))
    fail("COPILOT_RFQ_INVALID_INPUT");
  if (signal.aborted) fail("COPILOT_RFQ_ABORTED");
  if (focusLineNumber !== undefined &&
      (!Number.isSafeInteger(focusLineNumber) || focusLineNumber < 1 || focusLineNumber > 100000))
    fail("COPILOT_RFQ_INVALID_INPUT");

  const { data: header, error: headerError } = await db.from("rfqs")
    .select("id,reference,status,source_type,overall_confidence,extraction_confidence,extraction_warnings")
    .eq("id", rfqId).eq("organization_id", organizationId)
    .abortSignal(signal).maybeSingle();
  if (headerError || !header) fail("COPILOT_RFQ_UNAVAILABLE");
  const rfq = asObject(header);
  if (!isActiveRecordUuid(rfq.id) || rfq.id.toLowerCase() !== rfqId.toLowerCase() ||
      typeof rfq.status !== "string" || typeof rfq.source_type !== "string")
    fail("COPILOT_RFQ_INVALID_DATA");

  const { count: totalCount, error: totalError } = await db.from("rfq_lines")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", organizationId).eq("rfq_id", rfqId)
    .abortSignal(signal);
  if (totalError) fail("COPILOT_RFQ_COUNT_UNAVAILABLE");
  const totalLines = asNonnegativeInt(totalCount);

  const { count: unresolvedCount, error: unresolvedError } = await db.from("rfq_lines")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", organizationId).eq("rfq_id", rfqId)
    .neq("review_status", "confirmed").abortSignal(signal);
  if (unresolvedError) fail("COPILOT_RFQ_COUNT_UNAVAILABLE");
  const unresolvedLines = asNonnegativeInt(unresolvedCount);
  if (unresolvedLines > totalLines) fail("COPILOT_RFQ_COUNT_UNAVAILABLE");

  const { data: rows, error: linesError } = await db.from("rfq_lines")
    .select("id,line_number,customer_sku,raw_description,selected_product_id,match_method,match_confidence,extraction_confidence,review_status")
    .eq("organization_id", organizationId).eq("rfq_id", rfqId)
    .order("line_number", { ascending: true }).order("id", { ascending: true })
    .limit(RFQ_LINE_SCAN_LIMIT + 1).abortSignal(signal);
  if (linesError || !Array.isArray(rows)) fail("COPILOT_RFQ_LINES_UNAVAILABLE");
  const inspected = rows.slice(0, RFQ_LINE_SCAN_LIMIT).map(asRfqLine);
  if (new Set(inspected.map(line => line.id)).size !== inspected.length ||
      inspected.some(line => line.lineNumber < 1) ||
      (totalLines === 0 && rows.length > 0))
    fail("COPILOT_RFQ_INVALID_DATA");

  // A specific permitted line can be outside the first 50 lines. Fetch it with
  // exact RFQ/organization scope; never lift the global scan or model limits.
  let focusedExtra: RfqLineSnapshot | null = null;
  if (focusLineNumber !== undefined &&
      !inspected.some(line => line.lineNumber === focusLineNumber)) {
    const { data: focusedRows, error: focusedError } = await db.from("rfq_lines")
      .select("id,line_number,customer_sku,raw_description,selected_product_id,match_method,match_confidence,extraction_confidence,review_status")
      .eq("organization_id", organizationId).eq("rfq_id", rfqId)
      .eq("line_number", focusLineNumber)
      .limit(2).abortSignal(signal);
    if (focusedError || !Array.isArray(focusedRows))
      fail("COPILOT_RFQ_LINES_UNAVAILABLE");
    if (focusedRows.length !== 1) fail("COPILOT_RFQ_LINE_UNAVAILABLE");
    focusedExtra = asRfqLine(focusedRows[0]);
    if (focusedExtra.lineNumber !== focusLineNumber ||
        inspected.some(line => line.id === focusedExtra?.id))
      fail("COPILOT_RFQ_INVALID_DATA");
  }
  const { data: quotes, error: quoteError } = await db.from("quotes")
    .select("id").eq("organization_id", organizationId).eq("rfq_id", rfqId)
    .limit(1).abortSignal(signal);
  if (quoteError || !Array.isArray(quotes)) fail("COPILOT_RFQ_QUOTE_UNAVAILABLE");
  const quoteExists = quotes.length > 0;

  const severity = (line: RfqLineSnapshot): number => {
    const weights: Record<string, number> = {
      unmatched: 0, needs_review: 1, pending: 2, matched: 3, confirmed: 5,
    };
    return weights[line.reviewStatus] ?? 4;
  };
  const focused = focusLineNumber === undefined ? null :
    (inspected.find(line => line.lineNumber === focusLineNumber) ?? focusedExtra);
  if (focusLineNumber !== undefined && !focused)
    fail("COPILOT_RFQ_LINE_UNAVAILABLE");
  const selected = focused ? [focused] :
    [...inspected].sort((a, b) =>
      severity(a) - severity(b) || a.lineNumber - b.lineNumber ||
      a.id.localeCompare(b.id)).slice(0, RFQ_MODEL_LINE_LIMIT);
  let candidatesComplete = true;
  if (selected.length) {
    const ids = selected.map(item => item.id);
    let candidateQuery = db.from("product_match_candidates")
      .select("rfq_line_id,product_id,confidence,method,rank,products(id,sku,name)")
      .eq("organization_id", organizationId);
    // A focused lookup reads only the chosen line and an existence sentinel.
    // General overview retains its conservative global-candidate limit.
    candidateQuery = focused
      ? candidateQuery.eq("rfq_line_id", focused.id)
      : candidateQuery.in("rfq_line_id", ids);
    const candidateScanLimit = focused ? RFQ_CANDIDATE_LIMIT + 1 : RFQ_CANDIDATE_SCAN_LIMIT;
    const { data: candidateRows, error: candidatesError } = await candidateQuery
      .order("rank", { ascending: true }).order("product_id", { ascending: true })
      .limit(candidateScanLimit).abortSignal(signal);
    if (candidatesError || !Array.isArray(candidateRows))
      fail("COPILOT_RFQ_CANDIDATES_UNAVAILABLE");
    candidatesComplete = candidateRows.length < candidateScanLimit;
    const allowed = new Set(ids);
    const perLineCounts = new Map<string, number>();
    for (const candidate of candidateRows.slice(0, candidateScanLimit - 1)) {
      const item = asCandidate(candidate);
      if (!allowed.has(item.lineId)) fail("COPILOT_RFQ_INVALID_DATA");
      const target = selected.find(row => row.id === item.lineId);
      if (!target) fail("COPILOT_RFQ_INVALID_DATA");
      perLineCounts.set(item.lineId, (perLineCounts.get(item.lineId) ?? 0) + 1);
      if (target.candidates.length < RFQ_CANDIDATE_LIMIT) target.candidates.push(item.value);
    }
    for (const line of selected)
      line.candidatesComplete = candidatesComplete &&
        (perLineCounts.get(line.id) ?? 0) <= RFQ_CANDIDATE_LIMIT;
  }
  if (signal.aborted) fail("COPILOT_RFQ_ABORTED");
  const allLinesInspected = totalLines === inspected.length && rows.length <= RFQ_LINE_SCAN_LIMIT;
  const truncated = !allLinesInspected ||
    inspected.length > selected.length || !candidatesComplete ||
    selected.some(line => !line.candidatesComplete);

  return {
    kind: "rfq_snapshot", rfqId: rfq.id.toLowerCase(),
    reference: asText(rfq.reference, 100),
    status: safeContextText(rfq.status, 40),
    sourceType: safeContextText(rfq.source_type, 40),
    overallConfidence: asNumber(rfq.overall_confidence),
    extractionConfidence: asNumber(rfq.extraction_confidence),
    extractionWarnings: asWarnings(rfq.extraction_warnings),
    totalLines, unresolvedLines,
    inspectedLines: inspected.length + (focusedExtra ? 1 : 0),
    selectedLines: selected.length, allLinesInspected,
    quoteExists, lines: selected, truncated,
    retrievedAt: new Date().toISOString(),
  };
}
