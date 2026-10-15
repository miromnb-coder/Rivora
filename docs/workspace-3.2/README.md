# Workspace 3.2 evidence

The authoritative delivery report is the updated description of [PR #112](https://github.com/miromnb-coder/Rivora/pull/112). This directory contains synthetic evidence and reproduction notes, not production release approval.

The [2026-10-15 continuation](CONTINUATION-2026-10-15.md) resumes the saved `21e45ab` head, adds detail/RFQ/PO layout coverage and records the resulting overflow fixes. Historical screenshots and measurements below retain their original SHA attribution.

Primary implementation: `067b91d202ac1d64caa73177d7d91d1e72ae6fe3` (following `5fdf792`, `fc18922` and `3fa2945`). Follow-up `9d1bdfba6947ba164593402fbd99549d68dde675` allows enlarged mobile topbar text to reflow across wider system fonts. The baseline geometry/motion/performance evidence remains explicitly tied to `067b91d`; the follow-up changes only mobile label wrapping. The PR report records the latest head, CI and Preview verification.

The first remote Workspace run at `bac09e6` selected all 66 cases and reported **64 passed / 2 failed / 0 skipped**: both engines found a 323px document at 320px with enlarged text. This was a real font-dependent overflow, not a reason to relax the assertion. The follow-up keeps the 320px assertion and adds Arial/monospace stress checks. Local focused validation passed 8 mobile/reflow cases and then both strengthened enlarged-text cases. The final CI run is linked in the PR report.

## Reproduce

```sh
npm ci
npm run typecheck
npm test
npm run build
npx playwright install --with-deps chromium webkit
npx playwright test --config playwright.workspace.config.ts --list
npx playwright test --config playwright.workspace.config.ts
npx playwright test --config playwright.operations.config.ts
```

The Workspace configuration now selects 96 cases (48 Chromium + 48 WebKit), including 30 new detail-page cases. The original report's 66 cases describe `21e45ab`. The default catalogue configuration intentionally retains its original selection; the existing authenticated Copilot specification also remains separate. The dedicated Workspace CI uploads `workspace-report/` and `workspace-test-results/`, including geometry/contrast attachments and screenshots. Operations keeps its own workflow and meaning.

In this managed Linux session browser binaries and missing WebKit runtime libraries were installed only under `/tmp`. The local run used `PLAYWRIGHT_BROWSERS_PATH=/tmp/averomira-browsers` and `PLAYWRIGHT_SKIP_VALIDATE_HOST_REQUIREMENTS=1` after supplying the required libraries to the downloaded browser's own library directory. Actual WebKit 26.0 processes executed all 33 cases successfully. This is not physical Safari validation.

## Evidence boundaries

The isolated server bundles the real AppShell, AppNav, SalesCopilot and SupportCenter. It renders the real Orders, Products, Customers, Quotes and Inbox server pages, plus Product, Customer, Quote, RFQ and Purchase Order detail pages with synthetic data adapters. Detail pages include RFQ candidates/manual selection and PO reconciliation exceptions. The fixture lives outside the Next route tree. Page markup is static: native controls and interactive shell components are exercised, but page-level React handlers and server actions are not. Server actions throw, the server rejects writes, browser requests to other origins fail, and all chat calls are mocked. A build-graph check rejects real backend modules. No auth bypass, test account, schema change or new AI tool was added to the application.

The route/title screenshots contain synthetic records only. All 17 geometry widths and both browser engines are available in CI artifacts; this directory retains selected views for review. `1440-open.png` and `1440-closed.png` show document start; `screenshots/orders-end-1440.png` shows the natural document end and bottom gap. The fixture's workspace-switch button is test scaffolding and is absent from the application.

`performance.json` compares the same isolated 65-row Orders fixture before/after. Bundle sizes are fixture bundle sizes, not Next route chunk sizes. No new dependency was installed. The production build no longer prints comparable per-route JS/CSS sizes. Two-frame toggle samples and zero observed long tasks are observations, not a general performance guarantee. Sidebar width changes immediately to avoid interpolating the long worklist; panel geometry changes once, and the panel surface owns enter/exit motion.

`public-css-comparison.json` compares 438 home and 34 login elements at 1440×900 with identical computed colors, typography, spacing, borders and dimensions under compiled baseline/current styles. A separate normalized CSS review confirmed that non-app rules retain their behavior; shared legacy important selectors now exclude the authenticated subtree without changing their public/auth behavior.

## Baseline and limitations

- Initial main: `eb4a11824f9693668e12936ab66a61e3270174e7`; PR head: `f1908f5978ac1b65c0e026b601eb0bc1bee1cb38`; PR open, same base/head; initial checkout clean.
- Baseline typecheck: PASS. Baseline Node tests: 43 passed, 0 failed, 0 skipped.
- Baseline webpack build: FAIL because Next rejects the extra `contextExcerpt` route export. The fix removes only `export`; the function body, API methods, permissions, quotas, provider calls and business logic remain unchanged. Final default Turbopack build: PASS.
- Authenticated role/workspace integration: NOT RUN. Existing guard/feature mechanisms were read and existing source/unit checks passed; UI role fixtures do not verify server authorization. Local guest `/app` and `/onboarding` redirects to `/login` were checked.
- Full authenticated runtime review of record/detail, RFQ/PO business flows, Settings and Memory pages: NOT RUN. The continuation adds synthetic layout/native-control coverage for five detail pages; it does not verify persistence, approvals, email, ERP or server authorization. No real data-changing flow was exercised.
- Browser zoom at 200%/400%: NOT RUN. 320 CSS-px reflow and doubled text are separate executed tests; device scale factor is not claimed as zoom.
- Real keyboard, browser address bar and orientation on iOS: NOT RUN. The existing visualViewport keyboard fallback was retained and now cleans its custom properties when leaving overlay mode. Physical-device behavior remains unverified.
- REAL IPAD SAFARI: NOT RUN — physical device validation required.

Release remains blocked by these missing physical-device and integration checks. Nothing in this evidence authorizes a main merge or a production deployment.

Rollback: revert only this task's commits on the development branch, preserving the original PR work. No force push or database rollback is required. The original PR diff and clean-worktree record were saved in this session under `/tmp/averomira-pr112-baseline.patch` and `/tmp/averomira-worktree-baseline.txt`.
