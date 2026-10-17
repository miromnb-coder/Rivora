# AVEROMIRA — Phase 5 final acceptance, release gate & owner sign-off

**Scope:** Phases 5.1E.1, 5.1F, 5.1G, 5.1H, 5.1I in ONE development branch / ONE draft PR.
**Source of truth:** `main` at 76e53579fe9b0ddbfa12e5dbaff257e103b60281.

## 5.1E.1 — Answer precision & UX
- When structured findings are available, model instructions require a short factual overview rather than a duplicated task list.
- Read-only fallback without a findings event retains ordinary sections.
- Existing Minimal Linen layout, progress messages, source allowlist, scroll state and keyboard navigation remain unchanged unless verified by separate screenshot review.

## 5.1F — RFQ evidence integrity & coverage
- Direct, bounded JWT/RLS-scoped lookup of a specific RFQ line beyond the first 50. Same organization+RFQ equality; exactly one line required; no global scan enlargement.
- Focused candidate retrieval uses 3 candidates plus 1 sentinel, scoped to that RFQ line; general overview retains its conservative global limit.
- Disambiguate totalLines, retrievedLines and analyzedLines in model context. UI labels analyzed rather than incorrectly claiming all fetched rows were analyzed; verified findings add optional retrievedCount.
- No privileged Product Memory provenance RPC, approvals or write actions.

## 5.1G — Follow-up intelligence
- Only immediate preceding USER question may supply a line number for narrowly recognized elliptical follow-ups; current active RFQ and actor's normal authorization still required for data retrieval.
- Ambiguous 'other' questions ask for a line number, without sending business data or invoking OpenAI. AI-generated history is never used as a line selector.
- Route remains consent + organization scoped; switching workspace/route resets existing chat state. No cross-RFQ comparison or agent tools added.

## 5.1H — Reliability and safety
- Unit/regression tests cover above and existing 2-tenant, RLS, SSE failure, budget, browser and backup preflight checks.
- Release requires latest-commit typecheck, tests, build, Playwright desktop+mobile, synthetic Postgres, GitHub checks AND Vercel Preview READY.
- No migration and no production DB write. Production recoverability is not assumed from pilot readiness.

## 5.1I — Final pilot acceptance
- The sibling `PHASE5_FINAL_ACCEPTANCE_CASES.json` contains **36** traceable scenarios. Their initial status is 'not_executed', never auto-marked 'pass' merely because source code exists.
- Security failures, tenant leakage, fabricated approvals/sources or budget bypass are absolute blockers. All critical tests must pass and at least 90% of remaining pre-defined cases must be accepted with issues recorded.
- Owner must perform real authenticated RFQ/Orders interaction on the pilot account and approve the report. This cannot be truthfully claimed completed by synthetic CI alone.

**Current verdict: pending CI + real authenticated pilot + owner sign-off. NOT a Phase 5 production-complete declaration.**

## Owner-required next actions
1. Review the single PR diff and exact Vercel Preview.
2. If checks pass, explicitly authorize the merge.
3. Conduct 36-question private pilot review with original records, note mismatches.
4. Sign off Phase 5 only if its release gates pass; plan Phase 6 separately.
