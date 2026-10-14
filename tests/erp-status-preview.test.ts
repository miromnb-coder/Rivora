import { readFileSync } from "node:fs";
import { test } from "node:test";
import assert from "node:assert/strict";

const admin = readFileSync("lib/supabase/admin.ts", "utf8");
const dashboard = readFileSync("app/app/page.tsx", "utf8");
const settings = readFileSync("app/app/settings/page.tsx", "utf8");

test("read-only ERP status can detect unavailable server admin configuration", () => {
  assert.match(admin, /export function hasSupabaseAdminKey\(\): boolean/);
  assert.match(admin, /SUPABASE_SECRET_KEY/);
  assert.match(admin, /SUPABASE_SERVICE_ROLE_KEY/);
  assert.match(admin, /throw new Error\("Supabase admin key is not configured\."\)/);
});

test("dashboard stays readable without privileged ERP status while export remains unavailable", () => {
  assert.match(dashboard, /erpStatusUnavailable = isBusinessCentral && !hasSupabaseAdminKey\(\)/);
  assert.match(dashboard, /isBusinessCentral && !erpStatusUnavailable\s*\?\s*await getBusinessCentralConfigurationStatus/);
  assert.match(dashboard, /exportReady = !erpStatusUnavailable/);
  assert.match(dashboard, /ERP-yhteyden tila ei ole saatavilla/);
  assert.match(dashboard, /ERP-vientiä ei pidä yrittää/);
});

test("settings does not attempt privileged ERP lookups or credential writes when missing server configuration", () => {
  assert.match(settings, /erpStatusUnavailable = Boolean\(erpAdapter\) && !hasSupabaseAdminKey\(\)/);
  assert.match(settings, /erpAdapter && !erpStatusUnavailable\s*\?\s*await erpAdapter.getConfigurationStatus/);
  assert.match(settings, /canManage && !erpStatusUnavailable \? \(/);
  assert.match(settings, /ERP-yhteyden tilaa ei voi tarkistaa/);
});

test("other unexpected ERP errors are not silently treated as a verified connection", () => {
  assert.doesNotMatch(dashboard, /catch\s*\([^)]*\)\s*\{\s*return\s+true/);
  assert.doesNotMatch(settings, /catch\s*\([^)]*\)\s*\{\s*return\s+true/);
});
