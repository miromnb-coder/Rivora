# Phase 4 — Intelligent Copilot Conversation Experience

## Scope shipped in the development branch

- Replaces the non-interactive placeholder inside the existing Minimal Linen right pane, without moving, boxing or recoloring that pane.
- Provides an accessible message transcript, 1,200-character multiline composer, Enter-to-send / Shift+Enter newline, prompt suggestions, new conversation, Stop, response errors and retry text.
- Uses an authenticated `POST /api/copilot/stream` endpoint. Model-generated text is delivered as actual OpenAI response deltas over SSE, not a fake character-by-character playback.
- Only shows these factual runtime stages: connecting to the model, receiving model text, done/interrupted. A lightweight local subject hint changes wording for next-step planning versus comparison, but never claims to have read orders or performed any actions.
- Keeps conversation state in the mounted browser component only. Nothing is written to product memory or a conversations table.
- AI Support stays independent through the existing SupportCenter and SUPPORT_OPEN_EVENT shell behavior.
- The server prompt explicitly denies live record access, ERP operations, changing data, invented references and action-completion claims. Supplied navigation area is a bounded route label, not record evidence.
- Input schema limits length/history, validates roles and route-area labels, blocks likely credentials, checks workspace membership, rejects cross-origin calls, and enforces short/daily server rate limits.
- The model response uses `store:false`, up to 700 output tokens, no automatic retry, 30-second provider timeout and no model call when the feature flag is off.

## Deployment and data safety

**The model endpoint is OFF by default.** It returns HTTP 503 unless `AVEROMIRA_COPILOT_ENABLED=true` is deliberately configured for that environment. Do not set that variable yet merely to demonstrate Preview.

Only the source branch / PR #115 is changed. No production deployment or Supabase migration has been requested or performed. When the API is eventually activated, its existing rate-limit RPC will write counter state to the configured DB, so production-connected Preview needs a separate safety approval. OpenAI calls can incur billing; Phase 4 has request/token limits, but **does not yet use the shared AI cost reservation ledger for streaming**. Add streaming-ledger accounting or an approved equivalent cost ceiling before live rollout.

Do not add any customer-record queries or data-changing tool calls as part of this phase. Read-only, tenant-checked record tools, permissions and audited actions are a later separate phase.

## Verification and acceptance

- CI: `npm run typecheck`, `npm test`, `npm run build`.
- Synthetic operations PostgreSQL workflow should remain green.
- Test protocol validation, SSE parsing, runtime flag, cancellation, keyboard operation and AI Support isolation.
- Manually inspect and test 390px, 768px, 1024px, 1366px and 1440px at both empty and long conversation states.
- Verify scrolling while streaming, focus after closing the drawer, Escape, touch keyboard and reduced motion.
- If model streaming is to be tested, use an explicitly isolated preview with a separate test account and controlled API budget; do not use real tenant data.
- Keep PR in **Draft** and do not merge without visual/browser review and explicit owner approval.

## Known remaining scope

This phase does not provide real-order analysis, function calling, business record summaries, saved multi-device conversations, tool provenance or automatic writes. Those must be designed and authorized separately.
