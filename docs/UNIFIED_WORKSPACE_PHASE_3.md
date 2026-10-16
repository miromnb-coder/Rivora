# Averomira — Phase 3: Unified Workspace Pages

**Development branch only.** This PR does not alter the production site, database,
Support AI or underlying RFQ → Quote → PO → ERP operations.

## Phase 3.1
- Overview: one concise Page Header, loaded-data KPIs, next-action queue and
  recent cases with stable source links.
- Orders: a responsive three-group row (customer/reference, stage, action/date)
  instead of five squeezed columns. Existing case de-duplication and filters
  are untouched. Counts are explicitly labelled as loaded-case summaries.

## Phase 3.2
- Customers: short page title; native disclosure form for adding a customer;
  all four customer metrics remain visible in an adaptive list. createCustomer
  server action is unchanged. The list shows at most 500 customers.
- Products: short title; consistent status tiles and easy-to-scan product rows,
  showing price, stock and status. Sample-limited metrics are labelled as such
  because the list fetch is capped at 500. Existing product links and queries
  remain unchanged.
- Leads: four compact summary tiles at desktop widths, two on narrower views,
  lower-profile filters. Existing filtered links and lead status logic intact.
- Shared scoped styles in app/app/unified-pages.css.

## Validation gates
- CI typecheck, Node tests and build must pass.
- Synthetic PostgreSQL and Playwright workflow gates must pass.
- Manual authenticated browser screenshots needed at 390, 768, 1366 and 1440px
  with non-sensitive representative content to validate layout.
- Preview can potentially reach production DB credentials; do not modify
  company records while preview isolation is unverified.
- No PR merge until explicit approval and full visual review.

## Known limitations not hidden in UI
- Overview and Orders draw from bounded existing source queries and are
  not asserted to represent complete historic totals.
- Customers and Products lists are limited to 500 records.
- Persistent pagination/search and Copilot Intelligence are separate work.
