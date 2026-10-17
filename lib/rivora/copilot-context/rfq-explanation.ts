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
const METHODS_FI: Record<string, string> = {
  exact_sku: "Tuotetunnus (SKU) täsmäsi tallennetussa haussa. Se ei yksin todista teknistä sopivuutta.",
  exact_mpn: "Valmistajan tuotenumero täsmäsi tallennetussa haussa. Tarkista silti tuotteen sopivuus.",
  product_memory: "Tallennettu menetelmä on tuotemuisti. Aiemman hyväksyjän tai vahvistuksen historiaa ei haettu.",
  customer_memory: "Tallennettu menetelmä on asiakaskohtainen muisti. Aiemman hyväksynnän tarkempia tietoja ei haettu.",
  fuzzy: "Tuotetta ehdotettiin samankaltaisuuden perusteella, ei varmennettuna tarkkana osumana.",
  manual: "Tuote on valittu käsin. Vahvistus tarkistetaan erikseen.",
  catalogue: "Ehdotus perustuu tuotekatalogiin. Tarkempaa osumaperustetta ei haettu.",
  ai_suggestion: "Ehdotus on tekoälyn tekemä, eikä se tarkoita käyttäjän hyväksyntää.",
};
export function explainMatchMethod(method: string | null, locale: "fi" | "en" = "en"): string {
  const dictionary = locale === "fi" ? METHODS_FI : METHODS;
  return (method && dictionary[method]) || (locale === "fi"
    ? "Tallennettu osumamenetelmä ei ole tiedossa."
    : "Matching method is not known from the retrieved record.");
}
const REVIEW_FI: Record<string, string> = {
  pending: "Odottaa käsittelyä", matched: "Ehdotus odottaa vahvistusta",
  needs_review: "Vaatii tarkistuksen", confirmed: "Vahvistettu",
  unmatched: "Tuoteosuma puuttuu",
};
const REVIEW_EN: Record<string, string> = {
  pending: "Pending review", matched: "Suggested, not confirmed",
  needs_review: "Needs review", confirmed: "Confirmed",
  unmatched: "No product match",
};
const RFQ_FI: Record<string, string> = {
  needs_review: "Vaatii tarkistuksen", ready: "Valmis seuraavaan vaiheeseen",
  draft: "Luonnos", processing: "Käsittelyssä", failed: "Käsittely epäonnistui",
};
const RFQ_EN: Record<string, string> = {
  needs_review: "Needs review", ready: "Ready for next step",
  draft: "Draft", processing: "Processing", failed: "Processing failed",
};
export function rfqReviewLabel(status: string, locale: "fi" | "en"): string {
  return (locale === "fi" ? REVIEW_FI : REVIEW_EN)[status] ??
    (locale === "fi" ? "Tila vaatii tarkistamista sovelluksesta" : "Check this status in the application");
}
export function rfqStatusLabel(status: string, locale: "fi" | "en"): string {
  return (locale === "fi" ? RFQ_FI : RFQ_EN)[status] ??
    (locale === "fi" ? "Tarkista tila sovelluksesta" : "Check the status in the application");
}
export function rfqNextActionLabel(
  action: MatchExplanation["nextReview"], locale: "fi" | "en",
): string {
  const fi = {
    human_confirmation: "Tarkista ja vahvista osuma sovelluksessa",
    check_extraction: "Tarkista dokumentista poimitut tiedot",
    inspect_candidates: "Etsi tai valitse sopiva tuote käsin",
    none: "Ei tähän riviin liittyvää vahvistustehtävää",
  };
  const en = {
    human_confirmation: "Review and confirm the match in the application",
    check_extraction: "Review the extracted document details",
    inspect_candidates: "Find or select a suitable product manually",
    none: "No confirmation task for this line",
  };
  return (locale === "fi" ? fi : en)[action];
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
export function serializeRfqExplanation(
  explanation: RfqExplanation, locale: "fi" | "en" = "en",
): RfqIntelligenceContext {
  const lines = explanation.explanations.map(line => ({
    lineNumber: line.lineNumber,
    reviewStatus: line.reviewStatus,
    reviewStatusLabel: rfqReviewLabel(line.reviewStatus, locale),
    humanConfirmed: line.confirmedByHuman,
    matchMethod: line.method,
    matchMethodExplanation: explainMatchMethod(line.method, locale),
    matchConfidence: line.matchConfidence,
    extractionConfidencePercent: line.extractionConfidencePercent,
    candidates: line.candidates.map(item=>({
      sku:item.sku,name:item.name,confidence:item.confidence,method:item.method,
    })),
    candidateListComplete: line.candidateListComplete,
    nextReview: line.nextReview,
    nextActionLabel: rfqNextActionLabel(line.nextReview, locale),
  }));
  let truncated = explanation.truncated;
  const payload = {
    type: "rfq_read_only_evidence", rfqId: explanation.rfqId,
    reference: explanation.reference, status: explanation.rfqStatus,
    statusLabel: rfqStatusLabel(explanation.rfqStatus, locale),
    totalLines: explanation.totalLines, unresolvedLines: explanation.unresolvedLines,
    confirmedLines: explanation.totalLines - explanation.unresolvedLines,
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
