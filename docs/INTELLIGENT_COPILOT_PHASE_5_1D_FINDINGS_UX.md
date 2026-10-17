# Phase 5.1D — Intelligence Findings & Next Steps UX

## Scope
- **Read-only source-linked findings** for 5.1C deterministic analysis, in the existing Minimal Linen conversation panel; no separate full-size chat card and no business mutations.
- `findings` SSE event contains max 5 bounded, validated deterministic findings and no arbitrary URL or mutation command.
- Server builds the payload from the verified 5.1C result AND currently authenticated/validated sources. Dropped findings force `partial=true`.
- Event is sent **only after the provider's completed response and successful usage settlement**, immediately before `done`; failures/aborts must not reveal findings.
- Browser renders findings only for successfully completed turns where both validated sources and findings exist. Record links come only from the same validated `sources` event; findings never carry their own URL.
- Findings and next steps are compact two-section typography with a subtle rule and slim severity indicator; no thick borders or redundant cards. Mobile remains scrollable. Text is always escaped by React.
- `AVEROMIRA_COPILOT_FINDINGS_UI_ENABLED` is a new independent default-OFF server flag that requires the existing 5.1C analysis flag and previous pilot/RLS/consent/budget boundaries. With this OFF, 5.1C analysis may still inform the model's normal streamed answer but does not create UI findings.
- Scope unchanged: current private actor+workspace pilot, no SQL migrations, no new service, no automatic approvals, PO/ERP writes, email or production flag changes.

## Release and acceptance
- CI typecheck, Node unit/security tests, Next build, browser mobile/desktop, synthetic PostgreSQL/RLS and ledger tests.
- Browser checks explicit opt-in, matching source href, partial coverage note, session reset, and no findings shown on stream failure or incomplete response.
- Vercel Preview exact head must be READY. Do not merge to production or enable 5.1C/5.1D flags without separate owner approval.
- Real pilot verification afterwards: confirm wording, link correctness, and factual alignment with the corresponding RFQ/Orders records; model prose remains probabilistic.
