import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

for (const path of [
  "app/login/page.tsx",
  "app/forgot-password/page.tsx",
  "app/reset-password/page.tsx",
]) {
  const source = readFileSync(join(process.cwd(), path), "utf8");

  test(`${path} uses the Averomira auth brand`, () => {
    assert.match(source, /Averomira/);
    assert.equal(source.includes(">NODRA<"), false);
  });
}
