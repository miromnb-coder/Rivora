import { readFileSync } from "node:fs";
import { test } from "node:test";
import assert from "node:assert/strict";

const css = readFileSync("app/app/navigation.css", "utf8");

test("desktop shell retains a full-height white navigation surface", () => {
  assert.match(css, /\.app-shell-v2 \.app-sidebar-v2 \{ background: var\(--app-surface\) !important/);
  assert.match(css, /\.app-shell-v2 \.app-sidebar-v2 \{\s*height: 100dvh;\s*min-height: 0;\s*border-radius: 0;/);
});

test("desktop workspace is vertically inset and only its right corners are rounded", () => {
  assert.match(css, /Workspace 3\.0 phase 3:[\s\S]*?@media \(min-width: 1024px\)/);
  assert.match(css, /height: calc\(100dvh - 24px\);\s*min-height: 0;\s*margin: 12px 0;/);
  assert.match(css, /border-left: 0;\s*border-radius: 0 16px 16px 0;/);
  assert.match(css, /overflow-x: auto;\s*overflow-y: auto;/);
});

test("Copilot messages remain directly on the warm rail background", () => {
  assert.match(css, /\.app-shell-v2 \.sales-copilot \{ background: var\(--app-copilot\)/);
  assert.match(css, /\.app-shell-v2 \.sales-copilot-message \{ max-width: 100%; margin: 0 0 24px; padding: 0; border: 0; border-radius: 0; background: transparent;/);
});
