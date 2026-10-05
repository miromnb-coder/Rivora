import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const migration = readFileSync(
  join(
    process.cwd(),
    "supabase/migrations/20261005204500_generalize_erp_provider_rpc.sql",
  ),
  "utf8",
);

test("ERP-A4 removes Business Central-only provider constraints", () => {
  assert.equal(migration.includes("provider = 'business_central'"), false);
  assert.equal(migration.includes("target_provider <> 'business_central'"), false);
  assert.match(
    migration,
    /provider ~ '\^\[a-z\]\[a-z0-9_\]\{0,63\}\$'/,
  );
});

test("ERP delivery start is bound to the workspace provider selection", () => {
  assert.match(
    migration,
    /workspace_provider <> target_provider/,
  );
  assert.match(
    migration,
    /target_provider in \('none', 'custom'\)/,
  );
});

test("ERP delivery finish audits the provider from the actual attempt", () => {
  assert.match(
    migration,
    /'provider', attempt_provider/,
  );
  assert.match(
    migration,
    /draft_provider is distinct from attempt_provider/,
  );
});

test("ERP mapping removal has a provider-aware RPC", () => {
  assert.match(
    migration,
    /remove_erp_entity_mapping\(\s*target_provider text,\s*target_entity_type text,\s*target_local_entity_id uuid/s,
  );
  assert.match(
    migration,
    /where provider = target_provider/,
  );
});
