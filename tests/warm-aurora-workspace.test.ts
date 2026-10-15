import { readFileSync } from "node:fs";
import { test } from "node:test";
import assert from "node:assert/strict";

const layout = readFileSync("app/app/layout.tsx", "utf8");
const theme = readFileSync("app/app/warm-aurora.css", "utf8");
const shell = readFileSync("components/AppShell.tsx", "utf8");
const copilot = readFileSync("components/copilot/SalesCopilot.tsx", "utf8");

test("Warm Aurora is app-scoped and loaded after the existing workspace and focus layers", () => {
  assert.match(layout, /import "\.\/navigation\.css";[\s\S]*import "\.\/field-focus\.css";[\s\S]*import "\.\/warm-aurora\.css";/);
  assert.match(theme, /--app-bg: #F7F4EE/);
  assert.match(theme, /--app-surface: #FFFCF8/);
  assert.match(theme, /radial-gradient/);
  assert.doesNotMatch(theme, /!important|pointer-events:\s*none/);
});

test("desktop uses separate rounded navigation and workspace panels with a shared-canvas Copilot", () => {
  assert.match(theme, /--workspace-nav: 216px/);
  assert.match(theme, /gap: 20px/);
  assert.match(theme, /\.app-shell-v2 \.app-sidebar-v2 \{/);
  assert.match(theme, /border-radius: 22px/);
  assert.match(theme, /\.app-shell-v2 \.app-main-v2 \{/);
  assert.match(theme, /border-radius: 24px/);
  assert.match(theme, /\.app-shell-v2\[data-shell-mode="desktop"\] \.sales-copilot \{[\s\S]*?background: transparent/);
  assert.match(theme, /\.sales-copilot-message:not\(\.is-user\) \{ background: transparent; \}/);
});

test("responsive and accessibility behavior stay anchored in existing components", () => {
  assert.match(theme, /data-shell-mode="tablet"/);
  assert.match(theme, /data-shell-mode="mobile"/);
  assert.match(theme, /prefers-reduced-motion: reduce/);
  assert.match(shell, /useModal/);
  assert.match(copilot, /onScroll=/);
  assert.match(copilot, /aria-live="off"/);
  assert.match(copilot, /aria-label=\{fi \? "Lähetä viesti"/);
});
