import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const migration = readFileSync(
  join(
    process.cwd(),
    "supabase/migrations/20261006090000_erp_requested_name.sql",
  ),
  "utf8",
);

test("ERP-B0 stores unsupported ERP names separately from native provider keys", () => {
  assert.match(migration, /add column if not exists erp_requested_name text/);
  assert.match(migration, /erp_provider = 'custom'/);
  assert.match(migration, /does not enable a native connection or automatic export/i);
});
