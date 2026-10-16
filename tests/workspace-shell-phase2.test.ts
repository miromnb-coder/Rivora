import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");
const shell = read("components/AppShell.tsx");
const frame = read("components/workspace/WorkspaceFrame.tsx");
const css = read("app/app/workspace-shell.css");
const layout = read("app/app/layout.tsx");
const nav = read("components/AppNav.tsx");

test("Workspace Shell keeps all existing routes, support and account functions", () => {
  assert.match(shell, /<AppNav items=\{nav\} locale=\{locale\}/);
  assert.match(shell, /<AppLocation locale=\{locale\}/);
  assert.match(shell, /<SupportCenter locale=\{locale\}/);
  assert.match(shell, /action=\{signOut\}/);
  assert.match(shell, /LocaleSwitcher/);
  assert.match(shell, /leadsEnabled/);
  assert.match(frame, /WorkspaceFrame/);
  assert.doesNotMatch(frame, /fetch\(|openai|supabase/);
});
test("Copilot in Phase 2 is a UI-only placeholder", () => {
  assert.match(frame, /Keskustelu ei ole vielä käytössä/);
  assert.doesNotMatch(frame, /\/api\/copilot|<textarea|<input|MessageComposer|SupportCenter/);
  assert.match(frame, /ml-copilot-close/);
  assert.match(frame, /ml-copilot-backdrop/);
  assert.match(frame, /aria-modal/);
  assert.match(frame, /Escape/);
});
test("Grid breakpoints protect center width and avoid mobile squeeze", () => {
  assert.match(css, /grid-template-columns: 232px minmax\(0,1fr\) 360px/);
  assert.match(css, /@media \(min-width: 1360px\)/);
  assert.match(css, /@media \(min-width: 768px\) and \(max-width: 1023px\)/);
  assert.match(css, /@media \(max-width: 767px\)/);
  assert.match(css, /grid-template-columns: 72px minmax\(0,1fr\)/);
  assert.match(css, /ml-copilot-dismissed/);
  assert.match(css, /background: var\(--ml-canvas\)/);
  assert.match(css, /prefers-reduced-motion: reduce/);
});
test("Layout imports isolated foundation and shell CSS, leaving marketing separate", () => {
  assert.match(layout, /styles\/minimal-linen\.css/);
  assert.match(layout, /workspace-shell\.css/);
  assert.match(nav, /aria-label=\{label\}/);
  assert.doesNotMatch(read("app/layout.tsx"), /workspace-shell\.css/);
  assert.doesNotMatch(read("components/support/SupportCenter.tsx"), /ml-workspace-shell/);
});
