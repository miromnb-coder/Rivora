# Phase 4.1 — Conversation UX & Streaming Verification

## Starting point
Continues Phase 4 on PR #115, branch `design/minimal-linen-workspace-copilot-1`. No design restart, change to main, database migration, ERP action or AI Support modification.

## UX improvements
- The response transcript now parses real SSE frames incrementally with a persistent UTF-8 decoder, tolerating arbitrary network packet, multi-byte character and CRLF splits.
- UI updates are grouped to animation frames instead of a React state update for every model token. The final text flushes before the completion or error state is shown.
- Partial/interrupted assistant turns are retained visually but excluded from future prompt history; only fully completed user/assistant pairs are forwarded.
- Stopped or failed replies can be retried in place without duplicating the user bubble. New conversation cancels the old stream and ignores stale responses.
- Users can scroll up to read earlier content without autoscroll forcing them back to the bottom; a compact "Uusimmat viestit / Latest messages" action returns to the latest content.
- Composer grows with text, respects Enter and Shift+Enter, uses larger touch targets and shows truthful failure/disabled-service text.
- The Copilot pane remains Linen-canvas without a separate conversation card; Help Center/AI Support remain separate. Includes keyboard focus cues and reduced-motion support.

## Verification implemented
- `tests/copilot-phase4-1.test.ts`: verifies UTF-8 + CRLF split across single-byte chunks, oversized/truncated frames, completed-only history, and UX invariants.
- Local synthetic browser fixture `scripts/copilot-ui-server.mjs` uses **only canned synthetic data** and runs without OpenAI credentials, a Supabase connection or production data.
- `tests/copilot-browser.spec.ts`, configured by `playwright.copilot.config.ts`, exercises 15 browser scenarios across desktop (1440 px), tablet (768 px) and mobile (390 px): real client SSE parsing, multiline input, new conversation, streaming Stop, retry, feature-off errors and incomplete responses.
- `.github/workflows/operations-synthetic.yml` invokes that synthetic browser suite in addition to the existing Operations browser and isolated PostgreSQL tests.
- Final CI, browser and Preview results must be taken from the **current PR head** (not from an earlier commit). If green, record automated acceptance separately from real authenticated Preview visual sign-off.

## Release gates
**No live model activation was authorized or performed.** `AVEROMIRA_COPILOT_ENABLED` is still off by default, and Preview must not be enabled with unverified production-connected Supabase credentials. Rate-limit counters are database writes if activated. Streaming AI expense is not yet integrated into the reservation/settlement ledger; this requires a separate release decision.

Automated Playwright verification tests the real browser component against a synthetic streaming transport; it **does not** prove a live OpenAI model response or human visual approval on the authenticated Vercel Preview. Before merging PR #115: perform authenticated visual QA on the actual Vercel Preview at 390, 768, 1024, 1366, 1440 px; verify keyboard focus, scrolling, modal close/reopen and support overlay; obtain explicit approval for production.

## Non-goals
No live company/customer order lookup, tenant query tools, ERP actions, product-memory writes, automatic email sends, chat persistence or main branch changes.
