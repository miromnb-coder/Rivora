import { readFileSync } from "node:fs";
import { test } from "node:test";
import assert from "node:assert/strict";

const css = readFileSync("app/app/navigation.css", "utf8");
const marker = css.indexOf("/* Workspace 3.0: allow natural document scrolling");
const layout = marker >= 0 ? css.slice(css.indexOf("@media (min-width: 1024px)", marker), css.indexOf("@media (prefers-reduced-motion: reduce)", marker)) : "";

test("desktop retains a full-height white sticky sidebar", () => {
  assert.match(css, /\.app-shell-v2 \.app-sidebar-v2 \{ background: var\(--app-surface\) !important/);
  assert.match(layout, /\.app-shell-v2 \.app-sidebar-v2 \{\s*position: sticky;\s*top: 0;\s*align-self: start;\s*height: 100dvh;/);
});

test("shell restores the normal document scroll instead of locking its height", () => {
  assert.match(layout, /\.app-shell-v2 \{\s*height: auto;\s*min-height: 100dvh;\s*overflow: visible;/);
  assert.doesNotMatch(layout, /overflow:\s*hidden/);
  assert.match(layout, /\.app-shell-v2\.is-copilot-open \.app-main-v2 \{\s*overflow: visible;/);
});

test("working card keeps 12px gutters and only the right corners rounded", () => {
  assert.match(layout, /height: auto;\s*min-height: calc\(100dvh - 24px\);\s*margin: 12px 0;/);
  assert.match(layout, /border-left: 0;\s*border-radius: 0 16px 16px 0;/);
  assert.match(layout, /overflow: visible;/);
});

test("Copilot messages remain directly on their warm background", () => {
  assert.match(css, /\.app-shell-v2 \.sales-copilot \{ background: var\(--app-copilot\)/);
  assert.match(css, /\.app-shell-v2 \.sales-copilot-message \{ max-width: 100%; margin: 0 0 24px; padding: 0; border: 0; border-radius: 0; background: transparent;/);
});
