// Phase 6: verified, bounded, read-only evidence. No model-defined SQL or URLs.
import type { ContextSource } from "../copilot-context/types.ts";
export type Phase6Intent = "memory_provenance" | "business_chain" | "business_comparison";
export type EvidenceLevel = "verified_record" | "deterministic_derivation" | "incomplete_evidence" | "conflicting_evidence";
export type EvidenceCode =
  | "MEMORY_METHOD" | "MEMORY_USAGE_FOUND" | "MEMORY_USAGE_MISSING"
  | "MEMORY_ORIGIN_UNVERIFIED" | "MEMORY_TARGET_AT_USE" | "MEMORY_TARGET_CHANGED"
  | "MEMORY_VERIFIED_AT_USE" | "MEMORY_SOURCE_AT_USE"
  | "RFQ_STATUS" | "QUOTE_STATUS" | "PO_STATUS" | "SALES_STATUS"
  | "RELATION_MISSING" | "RELATION_TRUNCATED" | "REVIEW_REQUIRED";
export type EvidenceFact = {
  factId: string; code: EvidenceCode; sourceId: string;
  detail: string; verification: EvidenceLevel;
};
export type Phase6Evidence = {
  kind: Phase6Intent; retrievedAt: string; facts: EvidenceFact[];
  sources: ContextSource[]; partial: boolean; limitations: string[];
};
export type Phase6EvidenceEvent = {
  type: "evidence"; kind: Phase6Intent; partial: boolean;
  facts: EvidenceFact[]; limitations: string[];
};
export const EVIDENCE_CODES = new Set<EvidenceCode>([
  "MEMORY_METHOD","MEMORY_USAGE_FOUND","MEMORY_USAGE_MISSING","MEMORY_ORIGIN_UNVERIFIED",
  "MEMORY_TARGET_AT_USE","MEMORY_TARGET_CHANGED","MEMORY_VERIFIED_AT_USE",
  "MEMORY_SOURCE_AT_USE","RFQ_STATUS","QUOTE_STATUS","PO_STATUS","SALES_STATUS",
  "RELATION_MISSING","RELATION_TRUNCATED","REVIEW_REQUIRED",
]);
export const EVIDENCE_LEVELS = new Set<EvidenceLevel>([
  "verified_record","deterministic_derivation","incomplete_evidence","conflicting_evidence",
]);
