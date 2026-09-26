# Nodra

Nodra turns messy industrial RFQs into product-matched, human-reviewable quote drafts.

## v0.1 scope

1. Upload RFQ (PDF / Excel / CSV)
2. Extract structured RFQ lines
3. Resolve customer-specific product language against a canonical catalogue
4. Assign confidence and surface uncertain lines
5. Human confirms/corrects matches
6. Confirmed corrections become customer-specific product memory
7. Build a quote draft

ERP write-back, autonomous sending, billing and complex CPQ are intentionally out of scope.

## Stack

- Next.js 16 App Router
- React 19 + TypeScript
- Tailwind CSS 4
- Supabase-ready Postgres/Auth/Storage layer

## Run locally

```bash
npm install
npm run dev
```

The app currently runs on demonstration data so the full review workflow can be evaluated before provisioning a dedicated Supabase project.

## Supabase

`supabase/schema.sql` contains the v0.1 domain model. Do **not** apply it to the existing OrderDesk Nordic database. Provision a dedicated Nodra project first, then install organization-scoped RLS policies before exposing tables through the Data API.

Environment variables:

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
```

Core domain:

`organizations → customers → RFQs → RFQ lines → product candidates → human feedback → customer product mappings → quotes`

The strategic learning loop is `customer_product_mappings`: once a user verifies a customer's alias, Nodra can reuse that knowledge on future RFQs.

## Current product baseline

The current main branch includes Finnish/English locale handling for the public site and authenticated product, plus the neutral white Nodra product UI refresh aligned with the marketing site.

Deployment trigger: current main baseline verified 2026-09-26.
