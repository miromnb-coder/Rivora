# AVEROMIRA — Phase 5.0 Context Foundation

## Scope
A default-OFF, opt-in, read-only order-case context layer for the existing Averomira Copilot. No arbitrary SQL, model-chosen tools, new SQL migrations, ERP writes, email actions or new paid infrastructure.

## Integration
- `lib/rivora/order-cases.ts`: shared case projection, same four sources and business rules used by `app/app/orders/page.tsx`. For context only, fetch a 201st sentinel from each (200-row) source. Report partial results; never claim complete company-wide totals when truncated.
- `lib/rivora/copilot-context/authorization.ts`: current authenticated JWT client reads memberships. A user with multiple organizations must explicitly select one matching current workspace before model context is enabled; the selected cookie is a hint, NOT an access grant. No service-role client for business data.
- `resolver.ts`: one deterministically allowlisted `orders_overview` query. RFQ-level review and arbitrary tool execution are not enabled in Phase 5.0.
- `orders.ts`: RLS-backed, `organization_id`-scoped read and 10-row maximum for the model (initial default: 5); no writes.
- `sanitize.ts` and `sources.ts`: bounded untrusted text, server-built internal source URLs, truncated flag, context max size 6,000 characters.
- `app/api/copilot/stream/route.ts`: context fetch happens BEFORE cost reservation and provider call; existing pilot gate, rate limits, billing/settlement and streaming retained. Context stages are emitted only when a real lookup is running. Sources emitted on successfully billed response only.
- `components/copilot/CopilotConversation.tsx`: user consent checkbox DEFAULT OFF, visible only to authorized accounts after the server context flag is enabled. The session must opt-in before any company data reaches OpenAI; private UI label and source links stay in Minimal Linen.
- `app/api/copilot/status/route.ts`: `contextAvailable` true only when AI activation is ready, user is authorized, and context flag is enabled.

## Production activation (NOT approved and NOT performed)
1. Review CI, tenant isolation, injected-source behavior, accessibility and cost tests, then obtain owner approval to merge.
2. Merge code with **`AVEROMIRA_COPILOT_CONTEXT_ENABLED` unset or `false`** (current default). Verify existing generic pilot continues to work unchanged. Do not pre-enable this environment variable.
3. Verify live selected workspace and user's memberships; ensure sources, client RLS and no service-role use for business data.
4. Check privacy and customer terms for sharing filtered order metadata with the external model; get explicit user consent via the checkbox.
5. With separate activation approval, enable `AVEROMIRA_COPILOT_CONTEXT_ENABLED=true` on production *for the already pinned pilot account only*, redeploy, and test one harmless query on an approved synthetic record.
6. Check ledger usage. Limits stay 0.01 USD per request, 0.25/day, 1/month. A larger request is rejected before provider call. Prompt inputs are `store:false`.
7. If anything fails, set `AVEROMIRA_COPILOT_CONTEXT_ENABLED=false` and redeploy: general AI pilot remains unchanged. For emergency full AI shutdown set `AVEROMIRA_COPILOT_ENABLED=false` and redeploy. A rollback of code is a separate approved step.

## Caveats and evidence gates
- Current old `getAuthContext` used the first membership. Phase 5.0 selects deterministically and uses a validated membership for any explicitly selected cookie, while refusing multi-membership *context* until a selection is explicit.
- A bounded, incomplete page of orders is NOT evidence of a full dataset. The `partial` flag and caption must remain visible for partial sources.
- The RLS `SELECT` policies on RFQs, quotes, POs, sales drafts and membership records were reviewed via Supabase metadata. They use `private.is_org_member(organization_id)`. A real two-tenant test should still be run on isolated synthetic PostgreSQL before live context is enabled.
- Context fields, history and user messages are UNTRUSTED data to the model. The system's instruction hierarchy, SQL rules, source URL registry and tenant access checks are immutable to that input.
- **No customer records were dumped or imported into the branch**. Existing live Copilot pilot stays allowed only to the previously approved actor/organization; Context remains disabled.
