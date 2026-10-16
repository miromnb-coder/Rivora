import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");
const css = read("styles/minimal-linen.css");
const ui = read("components/design-system/MinimalLinen.tsx");
const gallery = read("components/design-system/MinimalLinenGallery.tsx");
const preview = read("app/design-system-preview/page.tsx");
const root = read("app/layout.tsx");
const shell = read("components/AppShell.tsx");

test("Minimal Linen tokens agree with the approved palette", () => {
  const palette: Record<string, string> = {
    "--ml-canvas": "#faf7f3",
    "--ml-surface": "#ffffff",
    "--ml-surface-warm": "#fffcf8",
    "--ml-surface-soft": "#f7f4f0",
    "--ml-selected": "#f2e8e1",
    "--ml-ink": "#24211f",
    "--ml-muted": "#665e57",
    "--ml-primary": "#635244",
    "--ml-border": "#e5ded6",
    "--ml-border-strong": "#d8cdc4",
  };
  for (const [token, color] of Object.entries(palette)) {
    assert.ok(css.includes(token + ": " + color + ";"), token + " is missing");
  }
  for (const space of [1, 2, 3, 4, 6, 8, 12]) assert.match(css, new RegExp("--ml-space-" + space + ":"));
});

test("foundation CSS is scoped and does not replace global app styles", () => {
  assert.match(css, /\.ml-theme\s*\{/);
  assert.doesNotMatch(css, /(^|\n)\s*(?:html|body|:root|\*)\s*\{/m);
  assert.doesNotMatch(root, /minimal-linen\.css/);
  assert.doesNotMatch(shell, /MinimalLinenGallery|ml-theme|CopilotPanel/);
  assert.match(css, /prefers-reduced-motion:\s*reduce/);
});

test("button variants and accessible input states are implemented", () => {
  for (const name of ["primary", "secondary", "quiet", "danger"]) {
    assert.ok(css.includes(".ml-button--" + name), "missing button variant " + name);
  }
  for (const name of ["MlButton", "MlTextField", "MlTextareaField", "MlSelectField", "MlCard", "MlStatusBadge", "MlAlert", "MlTabs", "MlDataTable", "MlDialog", "MlEmptyState", "MlSkeleton"]) {
    assert.match(ui, new RegExp("export function " + name + "\\("));
  }
  assert.match(ui, /aria-invalid/);
  assert.match(ui, /aria-describedby/);
  assert.match(ui, /role="tablist"/);
  assert.match(ui, /role="tabpanel"/);
  assert.match(ui, /showModal\(\)/);
  assert.match(css, /:focus-visible/);
  assert.match(css, /min-height:\s*44px/);
});

test("preview is authenticated and non-production only", () => {
  assert.match(preview, /process\.env\.VERCEL_ENV !== "preview"/);
  assert.match(preview, /process\.env\.NODE_ENV !== "development"/);
  assert.match(preview, /notFound\(\)/);
  assert.match(preview, /await requireWorkspace\(\)/);
  assert.match(preview, /robots: \{ index: false, follow: false \}/);
  assert.match(gallery, /Eristetty komponenttien esikatselu/);
  assert.match(gallery, /Mitään ei tallennettu/);
});

test("design gallery includes meaningful demonstrations and synthetic data", () => {
  for (const name of ["MlButton", "MlTextField", "MlSelectField", "MlTextareaField", "MlTabs", "MlDataTable", "MlStatusBadge", "MlDialog", "MlSkeleton", "MlEmptyState"]) {
    assert.ok(gallery.includes("<" + name), "gallery missing " + name);
  }
  assert.match(gallery, /EX-101/);
  assert.match(gallery, /onClick=/);
  assert.match(gallery, /onSubmit=/);
});
