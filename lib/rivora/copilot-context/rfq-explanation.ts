// Phase 5.1B.2: deterministically derived explanation; no AI-generated facts.
// Only the authorized snapshot contains business data; do not call service-role RPC.
import { extractionConfidencePercent } from "../confidence.ts";
import type { ContextSource } from "./types.ts";
import { ContextReadError } from "./types.ts";
import type { RfqDataSnapshot, RfqLineSnapshot } from "./rfq.ts";

export type MatchExplanation = {
  lineId: string;
  lineNumber: number;
  reviewStatus: string;
  confirmedByHuman: boolean;
  method: string | null;
  methodMeaning: string;
  matchConfidence: number | null;
  extractionConfidencePercent: number | null;
  selectedProductId: string | null;
  candidates: Array<{
    sku: string | null;
    name: string | null;
    confidence: number | null;
    method: string | null;
  }>;
  candidateListComplete: boolean;
  nextReview: "human_confirmation" | "check_extraction" | "inspect_candidates" | "none";
};

export type RfqExplanation = {
  rfqId: string;
  reference: string | null;
  rfqStatus: string;
  totalLines: number;
  unresolvedLines: number;
  inspectedLines: number;
  allLinesInspected: boolean;
  quoteExists: boolean;
  extractionConfidencePercent: number | null;
  extractionWarnings: string[] | null;
  explanations: MatchExplanation[];
  truncated: boolean;
  retrievedAt: string;
};

const METHODS: Record<string, string> = {
  exact_sku: "Matched by recorded SKU lookup; this does not prove technical compatibility.",
  exact_mpn: "Matched by recorded manufacturer part number; verify technical compatibility.",
  product_memory: "Matched using Product Memory; no history or prior approver was retrieved.",
  customer_memory: "Matched using customer memory; no historical verification details were retrieved.",
  fuzzy: "Suggested by similarity, not a verified exact match.",
  manual: "Product was selected manually; confirmation state is evaluated separately.",
  catalogue: "Suggested from the catalogue; no more detailed match provenance was retrieved.",
  ai_suggestion: "AI-suggested candidate; not a human approval.",
};
export function explainMatchMethod(method: string | null): string {
  return (method && METHODS[method]) || "Matching method is not known from the retrieved record.";
}
export function explainRfq(snapshot: RfqDataSnapshot, focusedLineNumber?: number): RfqExplanation {
  let chosen: RfqLineSnapshot[] = snapshot.lines;
  if (focusedLineNumber !== undefined) {
    const line = snapshot.lines.find(item => item.lineNumber === focusedLineNumber);
    if (!line) throw new ContextReadError("COPILOT_RFQ_LINE_NOT_INSPECTED");
    chosen = [line];
  }
  const explanations = chosen.map((line): MatchExplanation => ({
    lineId: line.id,
    lineNumber: line.lineNumber,
    reviewStatus: line.reviewStatus,
    confirmedByHuman: line.reviewStatus === "confirmed",
    method: line.matchMethod,
    methodMeaning: explainMatchMethod(line.matchMethod),
    matchConfidence: line.matchConfidence,
    extractionConfidencePercent: extractionConfidencePercent(line.extractionConfidence),
    selectedProductId: line.selectedProductId,
    candidates: line.candidates.slice(0, 3).map(candidate => ({
      sku: candidate.sku, name: candidate.name,
      confidence: candidate.confidence, method: candidate.method,
    })),
    candidateListComplete: line.candidatesComplete,
    nextReview: line.reviewStatus === "confirmed" ? "none" :
      (extractionConfidencePercent(line.extractionConfidence) ?? 100) < 60
        ? "check_extraction" :
      line.reviewStatus === "unmatched" ? "inspect_candidates" : "human_confirmation",
  }));
  return {
    rfqId: snapshot.rfqId, reference: snapshot.reference,
    rfqStatus: snapshot.status,
    totalLines: snapshot.totalLines, unresolvedLines: snapshot.unresolvedLines,
    inspectedLines: snapshot.inspectedLines, allLinesInspected: snapshot.allLinesInspected,
    quoteExists: snapshot.quoteExists,
    extractionConfidencePercent: extractionConfidencePercent(snapshot.extractionConfidence),
    extractionWarnings: snapshot.extractionWarnings,
    explanations, truncated: snapshot.truncated || snapshot.lines.length > chosen.length,
    retrievedAt: snapshot.retrievedAt,
  };
}

export type RfqIntelligenceContext = {
  modelSnapshot: string;
  sources: ContextSource[];
  truncated: boolean;
};

/** An allowlisted, verified case link, not a model-selected URL. */
export function rfqExplanationSource(explanation: RfqExplanation): ContextSource {
  const id = explanation.rfqId;
  return {
    kind: "rfq", recordId: id, sourceId: "rfq:" + id,
    label: explanation.reference?.slice(0, 100) || "RFQ",
    href: "/app/orders/case/rfq/" + id,
  };
}

/** Reduce detail, never truncate JSON arbitrarily or fabricate full coverage. */
export function serializeRfqExplanation(explanation: RfqExplanation): RfqIntelligenceContext {
  const lines = explanation.explanations.map(line => ({
    lineNumber: line.lineNumber, reviewStatus: line.reviewStatus,
    humanConfirmed: line.confirmedByHuman, matchMethod: line.method,
    methodMeaning: line.methodMeaning,
    matchConfidence: line.matchConfidence,
    extractionConfidencePercent: line.extractionConfidencePercent,
    candidates: line.candidates.map(item=>({
      sku:item.sku,name:item.name,confidence:item.confidence,method:item.method,
    })),
    candidateListComplete: line.candidateListComplete,
    nextReview: line.nextReview,
  }));
  let truncated = explanation.truncated;
  const payload = {
    type: "rfq_read_only_evidence", rfqId: explanation.rfqId,
    reference: explanation.reference, status: explanation.rfqStatus,
    totalLines: explanation.totalLines, unresolvedLines: explanation.unresolvedLines,
    inspectedLines: explanation.inspectedLines, allLinesInspected: explanation.allLinesInspected,
    quoteExists: explanation.quoteExists,
    extractionConfidencePercent: explanation.extractionConfidencePercent,
    extractionWarnings: explanation.extractionWarnings,
    truncated, explanations: lines,
  };
  let encoded = JSON.stringify(payload);
  while (encoded.length > 6000 && lines.length > 1) {
    lines.pop();
    truncated = true;
    payload.truncated = true;
    encoded = JSON.stringify(payload);
  }
  if (encoded.length > 6000) throw new ContextReadError("COPILOT_RFQ_CONTEXT_TOO_LARGE");
  return { modelSnapshot: encoded,
    sources: [rfqExplanationSource(explanation)], truncated };
}
