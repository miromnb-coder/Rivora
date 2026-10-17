// Phase 5.1C — deterministic, read-only findings. Business facts only from JWT/RLS reads.
// Pure functions: no model calls, no SQL, no mutations, no implied approvals.
import type { CaseRow } from "../order-cases.ts";
import type { RfqExplanation } from "./rfq-explanation.ts";

export type FindingSeverity = "critical" | "high" | "medium" | "info";
export type FindingCode =
  | "ORDER_ERP_FAILURE" | "ORDER_PO_REVIEW" | "ORDER_RFQ_REVIEW"
  | "ORDER_QUOTE_ACTION" | "ORDER_ERP_READY"
  | "RFQ_PROCESSING_FAILED" | "RFQ_LINE_UNMATCHED" | "RFQ_EXTRACTION_UNCERTAIN"
  | "RFQ_LINE_UNCONFIRMED" | "RFQ_REVIEW_REMAINING" | "RFQ_READY_FOR_QUOTE";
export type AnalysisFinding = {
  id: string;
  code: FindingCode;
  severity: FindingSeverity;
  priority: number;
  sourceId: string;
  title: string;
  explanation: string;
  suggestedAction: string;
};
export type DeterministicAnalysis = {
  kind: "orders_priority" | "rfq_review";
  partial: boolean;
  /** Only inspected cases or selected RFQ lines; NEVER the entire business history. */
  inspectedCount: number;
  totalCount: number | null;
  findings: AnalysisFinding[];
};
const strings = (fi: string, en: string, locale: "fi" | "en") =>
  locale === "fi" ? fi : en;

/** A fixed scoring policy, not a learned score and not a business SLA. */
export function orderPriorityRule(caseRow: Pick<CaseRow, "stage" | "stageStatus">):
  { code: FindingCode; severity: FindingSeverity; priority: number; fi: string; en: string;
    actionFi: string; actionEn: string } | null {
  const state = caseRow.stageStatus ?? "";
  if (caseRow.stage === "done" || state === "erp_created") return null;
  if (caseRow.stage === "erp" && ["erp_failed", "erp_partial"].includes(state))
    return {code:"ORDER_ERP_FAILURE",severity:"critical",priority:100,
      fi:"ERP-vienti vaatii huomiota",en:"ERP export needs attention",
      actionFi:"Tarkista vientivirhe ennen uudelleenyritystä",actionEn:"Review the export issue before retrying"};
  if (caseRow.stage === "rfq" && state === "failed")
    return {code:"ORDER_RFQ_REVIEW",severity:"critical",priority:95,
      fi:"Tarjouspyynnön käsittely epäonnistui",en:"RFQ processing failed",
      actionFi:"Tarkista tarjouspyyntö sovelluksessa",actionEn:"Review the RFQ in the application"};
  if (caseRow.stage === "po" && ["needs_review", "extracted"].includes(state))
    return {code:"ORDER_PO_REVIEW",severity:"high",priority:85,
      fi:"Ostotilaus tarvitsee tarkistuksen",en:"Purchase order needs review",
      actionFi:"Tarkista ostotilauksen tiedot",actionEn:"Review the purchase order"};
  if (caseRow.stage === "rfq" && state === "needs_review")
    return {code:"ORDER_RFQ_REVIEW",severity:"high",priority:80,
      fi:"Tarjouspyyntö vaatii tarkistuksen",en:"RFQ requires review",
      actionFi:"Tarkista vahvistamattomat rivit",actionEn:"Review unconfirmed RFQ lines"};
  if (caseRow.stage === "quote" && ["draft", "ready", "approved"].includes(state))
    return {code:"ORDER_QUOTE_ACTION",severity:"medium",priority:65,
      fi:"Tarjous odottaa jatkotoimia",en:"Quote awaits next steps",
      actionFi:"Avaa tarjous ja tarkista sen vaihe",actionEn:"Open the quote and review its stage"};
  if (caseRow.stage === "po" && state === "matched")
    return {code:"ORDER_PO_REVIEW",severity:"medium",priority:60,
      fi:"Ostotilaus odottaa vahvistusta",en:"Purchase order awaits approval",
      actionFi:"Tarkista osuma ja hyväksy tarvittaessa",actionEn:"Review the match and approve if appropriate"};
  if (caseRow.stage === "erp" && ["draft", "ready_for_erp", "approved"].includes(state))
    return {code:"ORDER_ERP_READY",severity:"medium",priority:55,
      fi:"ERP-vaiheessa oleva myyntitilaus",en:"Sales order in ERP preparation",
      actionFi:"Tarkista tilaus ennen ERP-toimenpidettä",actionEn:"Review order before an ERP action"};
  return null; // Unknown statuses are never assigned an invented priority.
}

const CASE_HREF = /^\/app\/orders\/case\/(rfq|quote|po|sales)\/([0-9a-f-]{36})$/i;
function sourceIdFromCase(row: CaseRow): string | null {
  const match=CASE_HREF.exec(row.href);
  return match ? match[1] + ":" + match[2] : null;
}
export function prioritizeOrderCases(
  rows: readonly CaseRow[], locale: "fi" | "en", limit: number,
  sourceTruncated: boolean,
): { chosen: CaseRow[]; analysis: DeterministicAnalysis } {
  if (!Number.isInteger(limit) || limit < 1 || limit > 10)
    throw new Error("COPILOT_ANALYSIS_INVALID_LIMIT");
  const scored = rows.flatMap(row=>{
    const rule=orderPriorityRule(row);
    const sourceId=sourceIdFromCase(row);
    return rule && sourceId ? [{row,rule,sourceId}]:[];
  });
  scored.sort((a,b)=>
    b.rule.priority-a.rule.priority ||
    (Number.isFinite(Date.parse(a.row.updatedAt))?Date.parse(a.row.updatedAt):0) -
    (Number.isFinite(Date.parse(b.row.updatedAt))?Date.parse(b.row.updatedAt):0) ||
    a.row.key.localeCompare(b.row.key));
  const selected=scored.slice(0,limit);
  return {
    chosen:selected.map(item=>item.row),
    analysis:{
      kind:"orders_priority",
      partial:sourceTruncated || scored.length>limit,
      inspectedCount:rows.length,
      totalCount:null, // Four 200-row source scans are NOT a complete order count.
      findings:selected.map((entry,index)=>({
        id:"priority-"+(index+1),code:entry.rule.code,
        severity:entry.rule.severity,priority:entry.rule.priority,
        sourceId:entry.sourceId,
        title:strings(entry.rule.fi,entry.rule.en,locale),
        explanation:strings("Prioriteetti perustuu tallennettuun käsittelytilaan, ei määräaikaan.",
          "Priority is based on recorded workflow status, not a due date.",locale),
        suggestedAction:strings(entry.rule.actionFi,entry.rule.actionEn,locale),
      })),
    },
  };
}

export function analyzeRfq(
  rfq: RfqExplanation, locale: "fi" | "en",
): DeterministicAnalysis {
  const sourceId="rfq:"+rfq.rfqId;
  const findings: AnalysisFinding[]=[];
  const add=(code:FindingCode, severity:FindingSeverity, priority:number,
    lineNumber:number|null, fi:string,en:string,actionFi:string,actionEn:string)=>{
    findings.push({
      id:code+":"+(lineNumber??"rfq"),code,severity,priority,sourceId,
      title:strings(fi,en,locale),
      explanation:lineNumber===null?
        strings("Havainto perustuu tarjouspyynnön tallennettuun tilaan ja tarkkoihin laskentoihin.",
          "Based on recorded RFQ status and exact counts.",locale):
        strings("Rivin "+lineNumber+" tallennetun tarkistustilan perusteella.",
          "Based on recorded review state for line "+lineNumber+".",locale),
      suggestedAction:strings(actionFi,actionEn,locale),
    });
  };
  if(rfq.rfqStatus==="failed")
    add("RFQ_PROCESSING_FAILED","critical",100,null,
      "Tarjouspyynnön käsittely epäonnistui","RFQ processing failed",
      "Tarkista käsittelyvirhe ennen jatkamista","Review the processing error before proceeding");
  for(const line of rfq.explanations){
    if(line.confirmedByHuman) continue;
    if(line.reviewStatus==="unmatched")
      add("RFQ_LINE_UNMATCHED","high",90,line.lineNumber,
        "Rivi "+line.lineNumber+": tuoteosuma puuttuu","Line "+line.lineNumber+": product match missing",
        line.candidateListComplete?
          "Tarkista katalogi ja valitse sopiva tuote käsin":
          "Tarkista katalogi ja mahdolliset muut tuote-ehdokkaat",
        line.candidateListComplete?
          "Check catalogue and choose a suitable product manually":
          "Review the catalogue and other possible product candidates");
    if(line.extractionConfidencePercent!==null && line.extractionConfidencePercent<60)
      add("RFQ_EXTRACTION_UNCERTAIN","high",85,line.lineNumber,
        "Rivi "+line.lineNumber+": tietojen poiminta on epävarma",
        "Line "+line.lineNumber+": low extraction confidence",
        "Vertaa poimittuja tietoja alkuperäiseen dokumenttiin",
        "Compare extracted fields with the original document");
    if(line.reviewStatus!=="unmatched")
      add("RFQ_LINE_UNCONFIRMED","medium",70,line.lineNumber,
        "Rivi "+line.lineNumber+": vahvistus puuttuu",
        "Line "+line.lineNumber+": confirmation missing",
        "Tarkista ja vahvista osuma tarvittaessa",
        "Review and confirm the match if appropriate");
  }
  if(rfq.unresolvedLines>0 && findings.length===0)
    add("RFQ_REVIEW_REMAINING","high",75,null,
      "Tarjouspyynnössä on vahvistamattomia rivejä",
      "The RFQ contains unconfirmed lines",
      "Avaa kaikki rivit ja tarkista jäljellä olevat vahvistukset",
      "Review remaining line confirmations in the RFQ");
  if(rfq.unresolvedLines===0 && rfq.rfqStatus==="ready" && !rfq.quoteExists)
    add("RFQ_READY_FOR_QUOTE","info",35,null,
      "Rivit on vahvistettu; tarjous voidaan tarkistaa seuraavaksi",
      "All lines are confirmed; the quote can be reviewed next",
      "Tarkista tarjouspyyntö ennen tarjouksen muodostamista",
      "Review the RFQ before creating a quote");
  findings.sort((a,b)=>b.priority-a.priority || a.id.localeCompare(b.id));
  const selected=findings.slice(0,5);
  return {
    kind:"rfq_review",
    partial:rfq.truncated || !rfq.allLinesInspected || findings.length>5 ||
      rfq.explanations.length < rfq.inspectedLines,
    inspectedCount:rfq.explanations.length,
    totalCount:rfq.totalLines,
    findings:selected,
  };
}

/** Server-generated evidence only; hard bound model context and never include arbitrary URLs. */
export function serializeAnalysis(analysis: DeterministicAnalysis): string {
  const safe={
    kind:analysis.kind,partial:analysis.partial,
    inspectedCount:analysis.inspectedCount,totalCount:analysis.totalCount,
    scopeNote:analysis.kind==="orders_priority" ?
      "Priorities only among retrieved cases; not a global ranking or deadline." :
      "Exact RFQ totals, but sampled line-level findings may omit other unresolved lines.",
    findings:analysis.findings.slice(0,5).map(f=>({
      code:f.code,priority:f.priority,sourceId:f.sourceId,
      title:f.title.slice(0,95),suggestedAction:f.suggestedAction.slice(0,120),
    })),
  };
  const data=JSON.stringify(safe);
  if(data.length>1800) throw new Error("COPILOT_ANALYSIS_TOO_LARGE");
  return data;
}
