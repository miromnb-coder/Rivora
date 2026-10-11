# AI Support 2.1 — visual acceptance and protected Preview QA

Scope: visual presentation only, on top of production's S5–S8 feature code. No new backend endpoints, model changes, migrations or message sends.

## Expected look

- One Averomira AI header and one welcome question, warm white design and monochrome star icon.
- No nested AI card, duplicate context-help section or three large support-card tiles in the home view.
- At most three suggested questions and a compact, clearly labeled current page.
- Scrollable chat area; the multiline textarea and three-way Help / Tickets / Contact nav remain visible at the bottom.
- Dedicated Help screen with all approved articles and contextual suggestions; existing tickets, article links, escalation and screenshot upload retain their behavior.
- Mobile dynamic viewport and safe areas; keyboard focus stays inside the modal and returns to the invoking control when closed.

## Verification performed by CI

- `npm run typecheck`
- `npm test` (S1–S8 plus new S2.1 structure/security/accessibility regression assertions)
- `npm run build`

These checks verify TS/build/static invariants, not an authenticated browser rendering.

## Actual browser acceptance: still required

The Preview is behind Vercel / application authentication. Do not loosen auth or add a public QA endpoint. Once an authorized synthetic account has been signed in and an authorized local Playwright storageState file is available, run:

```sh
SUPPORT_PREVIEW_URL=https://<protected-preview-host> \
SUPPORT_PREVIEW_STORAGE_STATE=/secure/path/test-session.json \
npx playwright test -c playwright.support.config.ts
```

Only pass a safe test-user session. Never commit test cookies, bypass headers or real production credentials. The tests intercept `/api/support/ask` and do **not** make paid AI requests or submit support tickets. Screenshots, traces and videos are disabled to avoid exposing dashboard details.

Viewports exercised when configured: 390x844, 430x932, 768x900 and 1440x900.

Verify additionally in a real iOS Safari session: keyboard opening, safe-area placement, composer remaining visible and scrolling inside the dialog. Chromium mobile emulation cannot fully prove native iOS keyboard behavior.

## Acceptance checklist

- [ ] Protected authenticated Preview tested at all four viewport widths.
- [ ] Real iOS Safari composer and virtual keyboard checked.
- [ ] Help search, article, tickets and escalated contact form verified with synthetic data.
- [ ] No cross-workspace data or real secrets used in QA.
- [ ] PR diff reviewed and explicitly approved before merging.

No production merge/deployment is authorized by this document.
