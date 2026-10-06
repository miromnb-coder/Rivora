import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const sitemap = readFileSync(join(process.cwd(), "app/sitemap.ts"), "utf8");
const robots = readFileSync(join(process.cwd(), "app/robots.ts"), "utf8");
const manifest = readFileSync(join(process.cwd(), "app/manifest.ts"), "utf8");
const privateSurfaces = [
  "app/login/page.tsx",
  "app/forgot-password/page.tsx",
  "app/reset-password/page.tsx",
  "app/onboarding/page.tsx",
  "app/app/layout.tsx",
];

test("public sitemap lists only indexable marketing/legal URLs", () => {
  assert.match(sitemap, /https:\/\/averomira\.com/);
  assert.match(sitemap, /privacy/);
  assert.match(sitemap, /terms/);
  assert.equal(sitemap.includes("/login"), false);
  assert.equal(sitemap.includes("/app"), false);
});

test("robots blocks private and auth surfaces and advertises sitemap", () => {
  for (const path of ["/app/", "/login", "/forgot-password", "/reset-password", "/onboarding", "/auth/", "/api/"]) {
    assert.equal(robots.includes(`"${path}"`), true);
  }
  assert.match(robots, /sitemap\.xml/);
  assert.match(robots, /host: baseUrl/);
});

test("private auth/product surfaces emit noindex metadata", () => {
  for (const path of privateSurfaces) {
    const source = readFileSync(join(process.cwd(), path), "utf8");
    assert.match(source, /index: false/);
    assert.match(source, /follow: false/);
  }
});

test("web manifest uses the Averomira favicon and brand name", () => {
  assert.match(manifest, /name: "Averomira"/);
  assert.match(manifest, /src: "\/favicon\.svg"/);
  assert.match(manifest, /type: "image\/svg\+xml"/);
});
