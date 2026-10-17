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

/** Explain the exact stored workflow status; score is a deterministic queue aid, not urgency evidence. */
export function orderPriorityReason(
  item: Pick<CaseRow,"stage"|"stageStatus">, locale:"fi"|"en",
): string {
  const stage=item.stage, status=item.stageStatus ?? "";
  const descriptions:Record<string,[string,string]>={
    "erp:erp_failed":["ERP-viennin tila on epäonnistunut. Tarkista virhe ennen mahdollista uudelleenyritystä.","The ERP export is recorded as failed. Review the error before retrying."],
    "erp:erp_partial":["ERP-vienti onnistui vain osittain. Tarkista, mitkä tiedot siirtyivät, ennen uudelleenyritystä.","ERP export is recorded as partial. Check what was transferred before retrying."],
    "rfq:failed":["Tarjouspyynnön käsittely on epäonnistunut, eikä tulosta pidä olettaa valmiiksi.","RFQ processing failed; do not assume the result is complete."],
    "rfq:needs_review":["Tarjouspyyntö on merkitty tarkistusta vaativaksi. Vahvistustarpeet selviävät sen riveiltä.","The RFQ is marked for review. Open its lines to identify pending confirmations."],
    "po:extracted":["Ostotilauksen tiedot on poimittu, mutta niitä ei ole vielä vahvistettu.","Purchase-order details were extracted but have not been confirmed."],
    "po:needs_review":["Ostotilaus on merkitty tarkistusta vaativaksi ennen seuraavaa käsittelyvaihetta.","The purchase order is marked as requiring review before proceeding."],
    "po:matched":["Ostotilaus on täsmäytetty, mutta hyväksyntävaihe on vielä edessä.","The purchase order is matched but awaits the approval step."],
    "quote:draft":["Tarjous on luonnostilassa ja vaatii viimeistelyä ennen jatkamista.","The quote is a draft and needs completion before proceeding."],
    "quote:ready":["Tarjous on merkitty valmiiksi hyväksyntää varten.","The quote is marked ready for approval."],
    "quote:approved":["Tarjous on hyväksytty, mutta sen lähetysvaihe tulee vielä tarkistaa.","The quote is approved but its sending step still needs review."],
    "erp:draft":["Myyntitilausluonnos vaatii tietojen tarkistuksen ennen ERP-toimenpidettä.","The sales-order draft needs review before an ERP action."],
    "erp:ready_for_erp":["Myyntitilaus on valmis ERP-vaiheen tarkistukseen; vientiä ei ole tässä tehty.","The sales order is ready for ERP review; no export has been performed here."],
    "erp:approved":["Myyntitilaus on hyväksytty ja odottaa ERP-vaiheen käsittelyä.","The sales order is approved and awaits ERP processing."],
  };
  const found=descriptions[stage+":"+status];
  return found ? found[locale==="fi"?0:1] :
    locale==="fi"?"Tila ei vastaa tunnettua työjonosääntöä.":"Status has no known queue rule.";
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
        explanation:orderPriorityReason(entry.row,locale),
        suggestedAction:strings(entry.rule.actionFi,entry.rule.actionEn,locale),
      })),
    },
  };
}

/** Bounded wording grounded only in verified per-line fields. */
export function rfqLineFindingReason(
  code: FindingCode, lineNumber: number,
  line: RfqExplanation["explanations"][number] | undefined, locale:"fi"|"en",
): string {
  if (!line) return locale==="fi"?"Rivi tulee tarkistaa sovelluksessa.":"Review the line in the application.";
  if (code==="RFQ_EXTRACTION_UNCERTAIN") {
    const percentage=line.extractionConfidencePercent;
    if (percentage===null) return locale==="fi"?"Poiminnan varmuutta ei ole saatavilla.":"Extraction confidence is unavailable.";
    return locale==="fi"
      ? "Rivin "+lineNumber+" tietojen poiminnan varmuus on "+percentage+" %. Tarkista alkuperäinen dokumentti."
      : "Line "+lineNumber+" extraction confidence is "+percentage+"%. Compare with the source document.";
  }
  if (code==="RFQ_LINE_UNMATCHED") {
    return locale==="fi"
      ? "Riville "+lineNumber+" ei ole vahvistettua tuoteosumaa."+
        (line.candidateListComplete ? " Haettu ehdokaslista on tarkistettu." : " Muitakin ehdokkaita voi olla.")
      : "Line "+lineNumber+" has no confirmed product match."+
        (line.candidateListComplete ? " The retrieved candidate list was checked." : " Other candidates may exist.");
  }
  const state:Record<string,[string,string]>={
    matched:["Tuote-ehdotus odottaa ihmisen vahvistusta.","A product suggestion awaits human confirmation."],
    needs_review:["Rivi on merkitty tarkistusta vaativaksi.","The line is marked as requiring review."],
    pending:["Rivi odottaa käsittelyä.","The line is pending review."],
  };
  return (state[line.reviewStatus]??[
    "Rivin vahvistusta ei ole tallennettu.","No confirmation is recorded for the line.",
  ])[locale==="fi"?0:1];
}

export function analyzeRfq(
  rfq: RfqExplanation, locale: "fi" | "en",
): DeterministicAnalysis {
  const sourceId="rfq:"+rfq.rfqId;
  const findings: AnalysisFinding[]=[];
  const byLine=new Map(rfq.explanations.map(line=>[line.lineNumber,line]));
  const add=(code:FindingCode, severity:FindingSeverity, priority:number,
    lineNumber:number|null, fi:string,en:string,actionFi:string,actionEn:string)=>{
    findings.push({
      id:code+":"+(lineNumber??"rfq"),code,severity,priority,sourceId,
      title:strings(fi,en,locale),
      explanation:lineNumber===null?
        strings("Tarjouspyynnön tallennetun tilan ja tarkkojen rivimäärien perusteella.",
          "Based on the recorded RFQ status and exact line counts.",locale):
        rfqLineFindingReason(code,lineNumber,byLine.get(lineNumber),locale),
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
        line.reviewStatus==="matched"
          ? "Vertaa ehdotusta tilaajan tietoihin ja vahvista sopiva osuma"
          : line.reviewStatus==="pending"
            ? "Käsittele rivi ja tarkista mahdollinen tuote-ehdotus"
            : "Tarkista rivin tuotetiedot ja vahvista vasta sopiva osuma",
        line.reviewStatus==="matched"
          ? "Compare the suggestion with the requested item and confirm only a valid match"
          : line.reviewStatus==="pending"
            ? "Review the line and any available product suggestion"
            : "Review the requested item and confirm only a suitable match");
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
