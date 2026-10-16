import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const file = (name: string) => readFileSync(name, "utf8");

test("Phase 4.3 metadata preflight is limited to read-only SELECT", () => {
  const sql = file("docs/copilot/PRODUCTION_PREFLIGHT_READONLY.sql");
  const uncommented = sql.split("\n").filter(line => !line.trim().startsWith("--")).join("\n").trim();
  assert.match(uncommented, /^select\b/i);
  assert.match(uncommented, /pg_database_size/);
  assert.match(uncommented, /private\.operation_limits/);
  assert.match(uncommented, /private\.ai_usage_ledger/);
  assert.match(uncommented, /averomira_operations_owner/);
});

test("Prepared Copilot ledger patch documents its dependency on the Phase 2A foundation", () => {
  const foundation = file("supabase/migrations/20261011110113_operations_foundation.sql");
  const ledger = file("supabase/migrations/20261011113020_operations_shared_ai_ledger.sql");
  const patch = file("docs/copilot/PRODUCTION_LEDGER_PATCH_CANDIDATE.sql");
  const runbook = file("docs/copilot/PRODUCTION_DB_BACKUP_MIGRATION_RUNBOOK.md");
  assert.match(foundation, /private\.operation_limits/);
  assert.match(foundation, /private\.ai_usage_ledger/);
  assert.match(ledger, /reserve_ai_usage_server/);
  assert.match(patch, /COPILOT_LEDGER_FOUNDATION_MISSING/);
  assert.match(patch, /COPILOT_PRODUCTION_CHANGE_NOT_APPROVED/);
  assert.match(runbook, /NO-GO/);
  assert.match(runbook, /restore rehearsal/i);
});
