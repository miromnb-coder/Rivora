import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const layout = readFileSync(join(process.cwd(), "app/layout.tsx"), "utf8");
const favicon = readFileSync(join(process.cwd(), "public/favicon.svg"), "utf8");

test("Averomira exposes a crawlable site favicon", () => {
  assert.match(layout, /url: "\/favicon\.svg"/);
  assert.match(layout, /type: "image\/svg\+xml"/);
  assert.match(layout, /shortcut: "\/favicon\.svg"/);
  assert.match(favicon, /aria-label="Averomira"/);
  assert.match(favicon, /viewBox="0 0 256 256"/);
});
