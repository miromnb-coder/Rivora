import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const path = new URL("../app/design-system-preview/workspace/page.tsx", import.meta.url);
const source = readFileSync(path, "utf8");

test("workspace preview is restricted, authenticated and based solely on synthetic orders", () => {
  assert.match(source, /process\.env\.VERCEL_ENV !== "preview"/);
  assert.match(source, /await requireWorkspace\(\)/);
  assert.match(source, /notFound\(\)/);
  assert.match(source, /robots: \{ index: false, follow: false \}/);
  assert.match(source, /WorkspaceFrame/);
  assert.match(source, /Kaikki esimerkkiasiakkaat/);
  assert.doesNotMatch(source, /\.from\(|\/api\/orders|insert\(|update\(/);
});
