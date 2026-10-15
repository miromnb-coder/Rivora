# Workspace 3.2 evidence

The authoritative delivery report is the updated description of [PR #112](https://github.com/miromnb-coder/Rivora/pull/112). This directory contains synthetic evidence and reproduction notes, not production release approval.

Source implementation: `067b91d202ac1d64caa73177d7d91d1e72ae6fe3` (following `5fdf792`, `fc18922` and `3fa2945`). Later evidence-only commits do not change the tested application, configuration or test code.

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

The Workspace configuration selects 66 cases (33 Chromium + 33 WebKit). The default catalogue configuration intentionally retains its original selection; the existing authenticated Copilot specification also remains separate. The dedicated Workspace CI uploads `workspace-report/` and `workspace-test-results/`, including geometry/contrast attachments and screenshots. Operations keeps its own workflow and meaning.

In this managed Linux session browser binaries and missing WebKit runtime libraries were installed only under `/tmp`. The local run used `PLAYWRIGHT_BROWSERS_PATH=/tmp/averomira-browsers` and `PLAYWRIGHT_SKIP_VALIDATE_HOST_REQUIREMENTS=1` after supplying the required libraries to the downloaded browser's own library directory. Actual WebKit 26.0 processes executed all 33 cases successfully. This is not physical Safari validation.

## Evidence boundaries

The isolated server bundles the real AppShell, AppNav, SalesCopilot and SupportCenter. It renders the real Orders, Products, Customers, Quotes and Inbox server pages with synthetic data adapters. The fixture lives outside the Next route tree. Server actions throw, the server rejects writes, browser requests to other origins fail, and all chat calls are mocked. No auth bypass, test account, schema change or new AI tool was added to the application.

The route/title screenshots contain synthetic records only. All 17 geometry widths and both browser engines are available in CI artifacts; this directory retains selected views for review. `1440-open.png` and `1440-closed.png` show document start; `screenshots/orders-end-1440.png` shows the natural document end and bottom gap. The fixture's workspace-switch button is test scaffolding and is absent from the application.

`performance.json` compares the same isolated 65-row Orders fixture before/after. Bundle sizes are fixture bundle sizes, not Next route chunk sizes. No new dependency was installed. The production build no longer prints comparable per-route JS/CSS sizes. Two-frame toggle samples and zero observed long tasks are observations, not a general performance guarantee. Sidebar width changes immediately to avoid interpolating the long worklist; panel geometry changes once, and the panel surface owns enter/exit motion.

`public-css-comparison.json` compares 438 home and 34 login elements at 1440×900 with identical computed colors, typography, spacing, borders and dimensions under compiled baseline/current styles. A separate normalized CSS review confirmed that non-app rules retain their behavior; shared legacy important selectors now exclude the authenticated subtree without changing their public/auth behavior.

## Baseline and limitations

- Initial main: `eb4a11824f9693668e12936ab66a61e3270174e7`; PR head: `f1908f5978ac1b65c0e026b601eb0bc1bee1cb38`; PR open, same base/head; initial checkout clean.
- Baseline typecheck: PASS. Baseline Node tests: 43 passed, 0 failed, 0 skipped.
- Baseline webpack build: FAIL because Next rejects the extra `contextExcerpt` route export. The fix removes only `export`; the function body, API methods, permissions, quotas, provider calls and business logic remain unchanged. Final default Turbopack build: PASS.
- Authenticated role/workspace integration: NOT RUN. Existing guard/feature mechanisms were read and existing source/unit checks passed; UI role fixtures do not verify server authorization. Local guest `/app` and `/onboarding` redirects to `/login` were checked.
- Full runtime review of all record/detail, RFQ/PO business flows, Settings and Memory pages: NOT RUN. All routes compile; source guards/data contracts remain. Five actual page types and the Support/Operations fixtures received browser coverage. No real data-changing flow was exercised.
- Browser zoom at 200%/400%: NOT RUN. 320 CSS-px reflow and doubled text are separate executed tests; device scale factor is not claimed as zoom.
- Real keyboard, browser address bar and orientation on iOS: NOT RUN. The existing visualViewport keyboard fallback was retained and now cleans its custom properties when leaving overlay mode. Physical-device behavior remains unverified.
- REAL IPAD SAFARI: NOT RUN — physical device validation required.

Release remains blocked by these missing physical-device and integration checks. Nothing in this evidence authorizes a main merge or a production deployment.

Rollback: revert only this task's commits on the development branch, preserving the original PR work. No force push or database rollback is required. The original PR diff and clean-worktree record were saved in this session under `/tmp/averomira-pr112-baseline.patch` and `/tmp/averomira-worktree-baseline.txt`.
