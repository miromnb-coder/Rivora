import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const css = readFileSync(join(process.cwd(), "app/globals.css"), "utf8");

test("homepage editorial grid exposes subtle drafting guides", () => {
  assert.match(css, /Homepage editorial grid \+ technical drafting/);
  assert.match(css, /--draft-line:/);
  assert.match(css, /repeating-linear-gradient\(\s*to bottom/);
  assert.match(css, /repeating-linear-gradient\(\s*to right/);
  assert.match(css, /\.minimal-direction::before/);
  assert.match(css, /\.minimal-direction::after/);
});

test("technical drafting marks stay decorative and reduce on mobile", () => {
  assert.match(css, /pointer-events: none/);
  assert.match(css, /\.product-showcase::before/);
  assert.match(css, /\.workflow-showcase::before/);
  assert.match(css, /@media \(max-width: 720px\)/);
  assert.match(css, /\.minimal-direction::before,\s*\.minimal-direction::after \{\s*display: none;/);
});


test("drafting grid spans the viewport and divides the navigation into cells", () => {
  assert.match(css, /Editorial grid refinement — full viewport rules \+ navigation drafting cells/);
  assert.match(css, /\.minimal-direction \.nav-v2-brand::after/);
  assert.match(css, /\.minimal-direction \.nav-v2-actions::before/);
  assert.match(css, /\.minimal-direction \.nav-v2::after/);
  assert.match(css, /width: 100vw/);
  assert.match(css, /transform: translateX\(-50%\)/);
});


test("left and right vertical drafting guides share one symmetric overlay", () => {
  assert.match(css, /--draft-guide-inset:/);
  assert.match(css, /background-size: 1px 100%, 1px 100%/);
  assert.match(css, /var\(--draft-guide-inset\) 0,/);
  assert.match(css, /calc\(100% - var\(--draft-guide-inset\)\) 0/);
  assert.match(css, /\.minimal-direction::after \{\s*content: none;/);
});
