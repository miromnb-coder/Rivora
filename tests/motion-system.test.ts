import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const motionCss = readFileSync(join(process.cwd(), "app/motion.css"), "utf8");
const rootLayout = readFileSync(join(process.cwd(), "app/layout.tsx"), "utf8");
const appNav = readFileSync(join(process.cwd(), "components/AppNav.tsx"), "utf8");
const supportCenter = readFileSync(
  join(process.cwd(), "components/support/SupportCenter.tsx"),
  "utf8",
);
const rfqReview = readFileSync(
  join(process.cwd(), "app/app/rfq/[id]/page.tsx"),
  "utf8",
);
const memoryPage = readFileSync(
  join(process.cwd(), "app/app/memory/page.tsx"),
  "utf8",
);
const dashboard = readFileSync(join(process.cwd(), "app/app/page.tsx"), "utf8");
const toast = readFileSync(join(process.cwd(), "components/MotionToast.tsx"), "utf8");

test("Motion System v1 is loaded globally and exposes the agreed timing tokens", () => {
  assert.match(rootLayout, /import "\.\/motion\.css"/);
  for (const token of [
    "--motion-instant: 100ms",
    "--motion-fast: 160ms",
    "--motion-base: 220ms",
    "--motion-panel: 300ms",
    "--motion-emphasis: 420ms",
    "--motion-data: 500ms",
  ]) {
    assert.ok(motionCss.includes(token), token);
  }
});

test("Motion System v1 has a global reduced-motion escape hatch", () => {
  assert.match(motionCss, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(motionCss, /animation-duration: 0\.01ms !important/);
  assert.match(motionCss, /transition-duration: 0\.01ms !important/);
});

test("sidebar uses one measured active indicator and animated accordion state", () => {
  assert.match(appNav, /app-sidebar-v2-active-indicator/);
  assert.match(appNav, /getBoundingClientRect\(\)/);
  assert.match(appNav, /aria-hidden=\{!open\}/);
  assert.doesNotMatch(appNav, /className="app-sidebar-v2-subnav" hidden=\{!open\}/);
  assert.match(motionCss, /app-sidebar-v2-order-group\.is-open > \.app-sidebar-v2-subnav/);
});

test("Support AI morphs through idle, working and success states", () => {
  assert.match(supportCenter, /aiSent/);
  assert.match(supportCenter, /support-ai-submit-motion/);
  assert.match(supportCenter, /motion-dots/);
  assert.match(supportCenter, /is-working/);
  assert.match(supportCenter, /is-success/);
});

test("RFQ review exposes extraction flow and remembered-match feedback hooks", () => {
  assert.match(rfqReview, /motion-extraction-summary/);
  assert.match(rfqReview, /motion-rfq-extraction-flow/);
  assert.match(rfqReview, /motion-memory-used/);
  assert.match(rfqReview, /motion-state-badge/);
});

test("Smart Memory rows expose verification-state motion markers", () => {
  assert.match(memoryPage, /motion-memory-state-/);
  assert.match(memoryPage, /motion-memory-row/);
  assert.match(motionCss, /motion-memory-state-verified/);
  assert.match(motionCss, /motion-memory-state-disabled/);
});

test("dashboard, tables and reusable toasts share the data motion layer", () => {
  assert.match(dashboard, /dashboard-kpi-item/);
  assert.match(motionCss, /dashboard-kpi-item strong/);
  assert.match(motionCss, /table tbody tr/);
  assert.match(toast, /averomira-toast-region/);
  assert.match(toast, /aria-live="polite"/);
});
