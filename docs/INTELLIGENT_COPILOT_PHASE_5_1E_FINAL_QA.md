# Phase 5.1E — Final QA, Intelligence Validation & UX Refinement

## Scope and findings
- Phase 5.1C/D were already deployed to the private test workspace. This release does **not** widen the pilot, increase budget, add AI tools, or perform any business record writes.
- Actual read-only production verification (2026-10-17):
  - RFQ `QA-RFQ-20261004-001`: 2 lines; 1 confirmed, 1 unconfirmed/unmatched.
  - RFQ `QA-RFQ-20261004-PDF`: 2 lines; 0 confirmed, 2 unconfirmed.
  This matches the photographed pilot's **main status counts** but does not prove every generated sentence or suggestion correct.
- Order priority explanations now depend on the stored stage + status, with distinct reasons for failed/partial ERP exports, PO review, RFQ review, and quote draft/approval.
- RFQ line explanations now describe exact per-line review state, the extraction confidence percentage where known, and whether candidate search might be incomplete; no confidence score is treated as approval.
- Verified RFQ line links are deterministically derived from source IDs and finding IDs (e.g. `RFQ_LINE_UNMATCHED:2`), routing to the authenticated `/app/rfq/:id#rfq-line-2` page; other findings retain verified case links.
- The `findings` protocol now optionally includes bounded inspectedCount and totalCount (old frames remain compatible), so UI can say precisely how many retrieved records/lines it reviewed.
- When the **existing** Findings UI flag is enabled and deterministic analysis exists, the model is asked for a short factual overview rather than repeating the structured findings. The streamed text itself remains probabilistic.
- Minimal Linen transcript retains one background; scroll-to-latest link is smaller, separated from the composer and no longer styled as a large floating pill.

## Gates
Run repository CI (typecheck, unit tests, Next build, browser suite, isolated RLS/ledger SQL). Check Vercel Preview on exact final commit. PR remains draft until owner review.
No production migrations, storage changes, Vercel flag changes, new services, permissions expansion, or auto-merge. Real authenticated UI walkthrough still required after merge.

## Remaining known limits
- User-facing model prose cannot be exhaustively verified by deterministic tests.
- Orders ranking covers the existing capped, RLS-scoped read, not entire historical order book.
- The selected RFQ lines and candidates may be partial; exact counts alone do not make candidate details complete.
