# Phase 3.1 — Unified Workspace Final Polish

## Scope
- Compact Overview / Orders / Products statistic cards: 73px minimum height,
  reduced padding, and **4-up only when the actual content area is at least
  700px**, otherwise 2-up.
- Consistent Minimal Linen page headers across Leads and the other main pages,
  slightly tighter vertical rhythm and uniform primary-button icon spacing.
- Customers: native **Add customer** disclosure sits beside the header when
  closed; the form flows at full width below the header when open; stacked CTA
  on smaller viewports. Existing createCustomer server action unchanged.
- Leads: improved padding and section spacing, more efficient 3-column/two-row
  display for content widths 650–900px; all six record data fields remain
  accessible on narrower layouts. Filters keep 44px tap targets.

## Non-goals
- No new AI conversations, changes to Help Center, Vercel Toolbar, live data,
  customer/lead queries, sales calculations, ERP state or database schema.
- Do **not** hide Vercel Toolbar using application CSS. It is a preview/
  development interface, not an Averomira component.

## Review gates
Automated CI and synthetic tests must pass. Confirm browser screenshots at
390, 768, 1366, and 1440px, with Help Center and Copilot if both are
visible. Do not write to real company data from Preview. PR stays draft.
