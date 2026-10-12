import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");
const styles = read("app/app/field-focus.css");
const layout = read("app/app/layout.tsx");
const support = read("app/app/support-s5.css");
const center = read("components/support/SupportCenter.tsx");

test("Single-focus CSS is loaded by the authenticated app after support styles", () => {
  assert.ok(layout.indexOf('import "./support-s5.css";') > 0);
  assert.ok(layout.indexOf('import "./field-focus.css";') > layout.indexOf('import "./support-s5.css";'));
  assert.match(styles, /\.app-shell-v2/);
});

test("App text inputs, selects and textareas get one visible high-contrast border", () => {
  assert.match(styles, /input:not\(\[type="checkbox"\]\)/);
  assert.match(styles, /:focus-visible/);
  assert.match(styles, /select:focus-visible/);
  assert.match(styles, /textarea:focus-visible/);
  assert.match(styles, /outline: none !important/);
  assert.match(styles, /box-shadow: none !important/);
  assert.match(styles, /border-color: #5c665e !important/);
  // Checkbox/radio/file controls retain their focus outline; don't remove
  // it broadly for every input type.
  assert.doesNotMatch(styles, /\.app-shell-v2 input:focus-visible,/);
});

test("The Help search owns one focus border, with no bordered nested input", () => {
  assert.match(center, /className="support-search"/);
  assert.match(styles, /\.support-search input:focus-visible/);
  assert.match(styles, /border: 0 !important/);
  assert.match(styles, /background: transparent !important/);
  assert.match(styles, /\.support-search:focus-within \{/);
  assert.match(styles, /border-color: #5c665e;/);
  assert.match(styles, /box-shadow: none;/);
});

test("Composer, ticket replies and support contact fields remain operational", () => {
  assert.match(support, /support-ai-form > textarea:focus-visible/);
  assert.match(center, /className="support-contact-form"/);
  assert.match(center, /className="support-ai-form"/);
  assert.match(center, /SupportTicketTracker/);
  assert.match(center, /setView\(\{ kind: "help" \}\)/);
});
