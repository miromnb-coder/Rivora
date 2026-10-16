# Phase 2.1 — Premium Workspace Visual Refinement

## Changes
- Removed the redundant fixed Help Center launcher **visually within the authenticated
  workspace only**. SupportCenter itself still handles AI answers, article help,
  support tickets, polling, unread counts, focus management and context help.
- Added a navigational Help & Support trigger in the desktop sidebar and mobile
  account menu, using an explicit support-open event. Contextual article links
  preserve their original behavior.
- New support-unread event forwards the existing unread count to the navigation
  trigger. No new network queries are added.
- Opening Help Center dismisses the Copilot placeholder, preventing simultaneous
  competing panels.
- Collapsed the tall sidebar account details behind an accessible summary.
  Language switching and sign-out still work.
- Leads page retains **all six data fields** with responsive container queries:
  the rows become stacked/two-column cards according to the real center width,
  not the browser viewport. Summary is two-by-two and page title is concise.
- CSS is scoped to the authenticated Minimal Linen workspace; marketing, auth
  and the Support Center's internal component styles are unchanged.

## Validation
GitHub CI and synthetic database tests. Confirm visual behavior on real browser
at 320, 390, 768, 1024, 1366 and 1440px, with a real Lead (read-only)
and both Copilot + Help Center interactions. Visual inspection requires separate
manual acceptance before merge.

## Safety
Only the development branch/PR is modified. No production files, business
queries, migrations, ERP operations or DB contents are changed.
