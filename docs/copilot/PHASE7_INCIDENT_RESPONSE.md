# Phase 7.3 — Copilot monitoring and incident playbook

## Observable events
The Copilot lifecycle emits `copilot_ai_reserved`, `copilot_ai_settled`, `copilot_response_completed`, `copilot_response_failed`, and `copilot_usage_ambiguous` using only allowed fields (requestId, context class, coarse response-size bucket, generic error-name class). The old broader `operationalLog` handler is unchanged for other service areas.

The functions in `lib/rivora/copilot-release/metrics.ts` can assess **provided, redacted aggregate observations**; no live alert delivery is claimed. Run `node --experimental-strip-types scripts/copilot-operations-check.mjs /secure/aggregate.json` with synthetic or authorized aggregated data.

## Operator alert triage
- >=3 consecutive failed calls in the defined observation interval: diagnose OpenAI timeout vs authorization/read failures without dumping user prompts.
- Any ambiguous billing: stop escalation of usage, reconcile held ledger reservations by legitimate provider/billing evidence. Never release an unknown reservation without proof.
- Any cross-tenant authorization denial anomaly: inspect RLS, active workspace selection and feature configuration; keep beta off until verified.
- Budget denial must leave no model request. Daily and monthly ceilings remain independently set in DB; app code cannot silently raise them.
- Retain incident timestamps, request IDs, deployment SHA, category and resolution in a restricted operational log, not in GitHub issues with customer data.

## Go/no-go
A built monitoring adapter does not prove that production sends alerts or keeps logs for a certain duration. The manual `billingReconciliation` and acceptance gates require actual operator validation.
