import { readFileSync } from "node:fs";
import { test } from "node:test";
import assert from "node:assert/strict";

const shell = readFileSync("components/AppShell.tsx", "utf8");
const css = readFileSync("app/app/navigation.css", "utf8");
const copilot = readFileSync("components/copilot/SalesCopilot.tsx", "utf8");

test("Copilot docks in a real third column at common desktop widths", () => {
  assert.match(css, /@media \(min-width: 1200px\)/);
  assert.match(css, /is-copilot-open\s*\{\s*grid-template-columns:\s*232px minmax\(0, 1fr\) 360px/);
  assert.match(css, /grid-column: 3; grid-row: 1/);
  assert.match(css, /@media \(max-width: 1199px\)/);
  assert.doesNotMatch(css, /1599px/);
});
test("sidebar toggle belongs to shared top toolbar, not brand block", () => {
  const toolbar = shell.indexOf('className="app-workspace-toolbar"');
  const toggle = shell.indexOf('className="app-sidebar-toggle"');
  assert.ok(toolbar !== -1 && toggle > toolbar);
  assert.match(shell, /aria-label=\{collapsed \?/);
});
test("collapsed sidebar keeps an accessible account menu, locale and signout", () => {
  assert.match(shell, /app-sidebar-account-trigger/);
  assert.match(shell, /app-sidebar-account-menu/);
  assert.match(shell, /<LocaleSwitcher locale=\{locale\} label=\{copy.language\} \/>/);
  assert.match(shell, /action=\{signOut\}/);
  assert.doesNotMatch(css, /\.app-sidebar-v2-account \{ display: none !important/);
});
test("Copilot has responsive dialog semantics and does not hide Support features permanently", () => {
  assert.match(copilot, /role=\{overlay \? "dialog" : "complementary"\}/);
  assert.match(copilot, /aria-modal=\{overlay \? true : undefined\}/);
  assert.match(css, /is-copilot-open \.support-launcher \{ visibility: hidden/);
  assert.match(shell, /<SupportCenter/);
});
