# Phase 7 — Customer release limitations

- Copilot is read-only. It cannot approve RFQs, send quotes, write to ERP, delete business records or execute arbitrary agent tool loops.
- Product-memory usage may be incomplete or missing immutable point-in-time metadata. Match confidence is not product compatibility or human approval.
- RFQ business chains use explicit stored relationships, bounded samples and do not query a live external ERP.
- Model explanation text is not deterministically provable from source; only structured source/finding/evidence components are server-validated. High-stakes approvals remain human.
- The Phase 6 flags are default OFF until explicit per-actor pilot authorization.
- Phase 5 and Phase 6 acceptance cases remain pending until tested. Production recovery has no verified restore proof in this repository.
- Beta is designed as a small approved organization allowlist, not an opt-out general rollout; new rollout flags default OFF.
- Customer privacy terms, third-party DPAs and data retention periods require independent review.
