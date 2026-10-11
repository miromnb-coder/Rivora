export const DOCUMENT_TYPES = ["rfq_pdf_process", "po_pdf_process"] as const;
export type DocumentType = typeof DOCUMENT_TYPES[number];
export type JobState = "queued" | "running" | "retry_wait" | "blocked" | "needs_review" | "succeeded" | "dead" | "cancelled";
export type FailureCode = "network" | "provider_rate" | "provider_unavailable" | "timeout" | "invalid_file" | "invalid_extraction" | "config" | "permission" | "budget" | "database" | "ambiguous_effect" | "cancelled" | "stale_lease" | "internal";
export class OperationError extends Error {
  code: FailureCode;
  constructor(code: FailureCode) { super(code); this.code = code; }
}
export function classifyFailure(error: unknown): FailureCode {
  if (error instanceof OperationError) return error.code;
  const e = error as { status?: number; code?: string; name?: string; message?: string } | null;
  const internal = String(e?.message ?? "");
  if (internal.includes("OPERATION_STALE_LEASE")) return "stale_lease";
  if (internal.includes("OPERATION_CANCELLED")) return "cancelled";
  if (internal.includes("OPERATION_PERMISSION")) return "permission";
  if (internal.includes("OPERATION_AMBIGUOUS_EFFECT")) return "ambiguous_effect";
  if (internal.includes("OPERATION_INVALID_EXTRACTION")) return "invalid_extraction";
  if (internal.includes("OPERATION_BUDGET")) return "budget";
  if (e?.status === 429) return "provider_rate";
  if (e?.status && e.status >= 500) return "provider_unavailable";
  if (e?.name === "AbortError" || e?.name === "TimeoutError" || e?.name === "APIConnectionTimeoutError") return "timeout";
  if (["ECONNRESET","ECONNREFUSED","ENOTFOUND","ETIMEDOUT","EAI_AGAIN","ENETUNREACH"].includes(String(e?.code)) || e?.name === "APIConnectionError") return "network";
  if (["40001","40P01","08006","57P01"].includes(String(e?.code))) return "database";
  return "internal";
}
export function failurePolicy(code: FailureCode, type: string, attempt: number, unknownCalls: number, random = Math.random) {
  if (code === "stale_lease") return { state: null, delay: 0 };
  if (code === "cancelled") return { state: "cancelled" as const, delay: 0 };
  if (["config","permission","budget"].includes(code)) return { state: "blocked" as const, delay: 0 };
  if (code === "ambiguous_effect" || (unknownCalls > 1 && ["timeout","network","provider_rate","provider_unavailable","database"].includes(code))) return { state: "needs_review" as const, delay: 0 };
  if (["invalid_file","invalid_extraction","internal"].includes(code)) return { state: "dead" as const, delay: 0 };
  if (!DOCUMENT_TYPES.includes(type as DocumentType) && type !== "support_notification" && type !== "incident_notification" && type !== "email_reconcile") return { state: "needs_review" as const, delay: 0 };
  return { state: "retry_wait" as const, delay: Math.ceil([30,120,600][Math.min(2,attempt-1)] * (0.8 + Math.max(0,Math.min(1,random()))*0.4)) };
}
export function operationsEnabled(env: Record<string,string|undefined> = process.env) {
  return env.AVEROMIRA_OPERATIONS_ENABLED === "true" && env.VERCEL_ENV === "production"
    && env.VERCEL_PROJECT_ID === "prj_69utcxbvaCPDSle5W3zptTa946rv";
}
export function safeJobReason(code: string | null, fi = true) {
  const reasons: Record<string,[string,string]> = {
    budget:["Käsittely odottaa käyttörajan tarkistusta.","Processing is waiting for a budget review."],
    config:["Käsittelyasetukset vaativat ylläpitäjän tarkistuksen.","An administrator must review processing settings."],
    permission:["Käyttöoikeus on muuttunut. Ota yhteys työtilan ylläpitäjään.","Access has changed. Contact your workspace administrator."],
    invalid_file:["Tarkista PDF-tiedosto ja lähetä korjattu aineisto.","Review the PDF and upload a corrected document."],
    invalid_extraction:["Aineiston tiedot vaativat tarkistusta.","The document data needs review."],
    ambiguous_effect:["Toimituksen tulos vaatii tarkistusta ennen uusia toimia.","The delivery result needs review before further actions."],
  };
  return code ? (reasons[code]?.[fi?0:1] ?? (fi?"Käsittely ei valmistunut. Ilmoita käsittelytunniste tukipalvelulle.":"Processing did not finish. Give the operation ID to support.")) : null;
}
