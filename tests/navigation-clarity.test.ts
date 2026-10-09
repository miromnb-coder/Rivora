import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const nav = readFileSync(new URL("../components/AppNav.tsx", import.meta.url), "utf8");
const shell = readFileSync(new URL("../components/AppShell.tsx", import.meta.url), "utf8");
const location = readFileSync(new URL("../components/AppLocation.tsx", import.meta.url), "utf8");

test("sidebar has a single navigation action per section", () => {
  assert.match(nav, /aria-current=/);
  assert.doesNotMatch(nav, /ordersOpen|settingsOpen|orderSubItems|settingsSubItems|function Chevron/);
  assert.match(nav, /pathname === "\/app\/upload"/);
  assert.match(shell, /<AppNav items=\{nav\} locale=\{locale\}/);
});
test("detail pages provide a way back to their parent section", () => {
  assert.match(shell, /<AppLocation locale=\{locale\}/);
  assert.match(location, /<Link href=\{trail\.href\}>/);
  assert.match(location, /aria-current="page"/);
  assert.match(location, /"\/app\/orders\/case\/"/);
});
