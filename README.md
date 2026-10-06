# Averomira

Averomira turns messy industrial RFQs into product-matched, human-reviewable quote drafts.

## v0.1 scope

1. Upload RFQ (PDF / Excel / CSV)
2. Extract structured RFQ lines
3. Resolve customer-specific product language against a canonical catalogue
4. Assign confidence and surface uncertain lines
5. Human confirms/corrects matches
6. Confirmed corrections become customer-specific product memory
7. Build a quote draft
8. Upload a customer purchase order (PDF / Excel / CSV)
9. Extract and persist auditable PO metadata + order lines
10. Optionally anchor the PO to an approved or sent quote

Quote ↔ PO reconciliation now gates Sales Order Draft creation. The first ERP adapter targets Microsoft Dynamics 365 Business Central and creates Draft sales orders only; posting, shipping, invoicing and autonomous ERP approval remain out of scope.

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

`supabase/schema.sql` contains the v0.1 domain model. Do **not** apply it to the existing OrderDesk Nordic database. Provision a dedicated Averomira project first, then install organization-scoped RLS policies before exposing tables through the Data API.

Environment variables:

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
```

Core domain:

`organizations → customers → RFQs → RFQ lines → product candidates → human feedback → customer product mappings → quotes`

The strategic learning loop is `customer_product_mappings`: once a user verifies a customer's alias, Averomira can reuse that knowledge on future RFQs and, in the next reconciliation layer, customer purchase orders.

Purchase-order foundation adds `purchase_orders → purchase_order_lines → purchase_order_files`. Source files live in the private `purchase-order-files` Storage bucket and each PO can optionally reference the quote that preceded it.

Sprint 2 adds deterministic Quote ↔ PO reconciliation. Each run is versioned in `purchase_order_reconciliations` with line-level results in `purchase_order_reconciliation_lines`. Exact customer SKU, canonical SKU and MPN matches are preferred; description-similarity matches always require human review. Quantity, unit, net unit price, line total, extra PO lines and quote lines missing from the PO become explicit exceptions. Review accepts exceptions without mutating either source document, and owner/admin approval is required before the PO can move to the approved state.

Sprint 3 adds `sales_order_drafts → sales_order_draft_lines`, explicit ERP entity mappings, and audited `erp_delivery_attempts`. Sales Order Drafts are created only from the latest approved PO reconciliation. Accepted PO commercial values are preferred while canonical product identity comes from the approved quote line. An unmatched extra PO line blocks draft creation rather than guessing an ERP product.

The Business Central adapter uses Microsoft Entra service-to-service Client Credentials authentication. Production credentials are workspace-scoped: non-secret connection metadata is stored in `erp_connections`, while client secrets are encrypted in Supabase Vault and are only read server-side. The original Vercel environment configuration remains a temporary migration fallback for the already-proven production workspace.

Before creating a Business Central Draft sales order, the adapter validates the mapped customer and items, checks item base units, and searches for an existing order using customer number + customer PO number. Partial creation locks automatic retry. If a create response is ambiguous because of a timeout/network break, the adapter performs another duplicate lookup before allowing a retry path.

Microsoft Business Central is currently the only native ERP adapter. `custom` means the customer uses another ERP but Averomira must not request credentials or attempt automatic export until a real adapter has been implemented and tested. `none` disables ERP export while keeping the ERP-independent Sales Order Draft workflow available.

## Current product baseline

The current product includes Finnish/English locale handling, RFQ extraction/matching, Quote Builder, delivery tracking, PO extraction, deterministic Quote ↔ PO reconciliation, Sales Order Drafts and the first Business Central ERP adapter.

Deployment trigger: current main baseline verified 2026-09-26.


## Production operations

A non-destructive production smoke workflow checks the public health endpoint, login page and homepage. Workspace owners/admins can open **Settings → Production status** for safe operational checks such as stale ERP attempts and recent application/email failures.

Incident procedures, ERP ambiguity handling, upload/rate limits, credential rotation and the backup/restore drill checklist are documented in `docs/production-runbook.md`.
