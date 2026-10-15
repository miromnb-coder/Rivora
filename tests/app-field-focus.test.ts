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

test("Standalone and composite fields use a single semantic keyboard outline", () => {
  assert.match(styles, /outline: 2px solid var\(--app-focus\)/);
  assert.match(styles, /border: 1px solid var\(--app-control-border\)/);
  assert.match(styles, /form:focus-within/);
  assert.match(styles, /support-search:focus-within/);
  assert.doesNotMatch(styles, /!important|#[0-9a-f]{6}/i);
});

test("Composer, ticket replies and support contact fields remain operational", () => {
  assert.match(support, /support-ai-form > textarea:focus-visible/);
  assert.match(center, /className="support-contact-form"/);
  assert.match(center, /className="support-ai-form"/);
  assert.match(center, /SupportTicketTracker/);
  assert.match(center, /setView\(\{ kind: "help" \}\)/);
});
