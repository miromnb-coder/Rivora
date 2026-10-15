import { readFileSync } from "node:fs";
import { test } from "node:test";
import assert from "node:assert/strict";
const css = readFileSync("app/app/navigation.css", "utf8");
test("authenticated theme has one canvas shared with Copilot and portals", () => {
  assert.equal((css.match(/--app-bg:/g) ?? []).length, 1);
  assert.match(css, /\[data-averomira-app-portal\]/);
  assert.match(css, /--app-bg: #FAF6F2/);
  assert.doesNotMatch(css, /--app-copilot|!important/);
});
test("natural document flow and bounded navigation remain structural contracts", () => {
  assert.match(css, /height: auto; min-height: 100dvh; overflow: visible/);
  assert.match(css, /border: 1px solid var\(--app-outer-border\)/);
  assert.match(css, /border-radius: 0 16px 16px 0/);
  assert.match(css, /\.app-nav-scroll \{ flex: 1 1 auto; min-height: 0; overflow-y: auto/);
  assert.match(css, /@container workspace-content \(width < 680px\)/);
});
