import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const migration = readFileSync(
  join(
    process.cwd(),
    "supabase/migrations/20261006113000_memory_m1_core.sql",
  ),
  "utf8",
);

const hardening = readFileSync(
  join(
    process.cwd(),
    "supabase/migrations/20261006114500_harden_memory_m1_rpc.sql",
  ),
  "utf8",
);

const helper = readFileSync(
  join(process.cwd(), "lib/rivora/memory.ts"),
  "utf8",
);

test("M1 creates customer/workspace-scoped structured memory", () => {
  assert.match(
    migration,
    /create table if not exists public\.workspace_memory_entries/,
  );
  assert.match(migration, /scope in \('customer', 'workspace'\)/);
  assert.match(
    migration,
    /scope = 'customer' and customer_id is not null/,
  );
  assert.match(
    migration,
    /scope = 'workspace' and customer_id is null/,
  );
});

test("M1 memory is exact-keyed and only verified entries are reusable", () => {
  assert.match(migration, /private\.normalize_memory_key/);
  assert.match(migration, /verification_state in \('proposed', 'verified', 'conflict', 'disabled'\)/);
  assert.match(
    migration,
    /where verification_state = 'verified'/,
  );
  assert.match(helper, /\.eq\("verification_state", "verified"\)/);
});

test("M1 rejects cross-workspace customer and target references", () => {
  assert.match(
    migration,
    /Memory customer does not belong to the workspace/,
  );
  assert.match(
    migration,
    /Memory target product does not belong to the workspace/,
  );
  assert.match(
    migration,
    /Memory target customer does not belong to the workspace/,
  );
});

test("M1 mutations are RPC-gated and browser table access is read-only", () => {
  assert.match(
    migration,
    /revoke all on table public\.workspace_memory_entries from authenticated/,
  );
  assert.match(
    migration,
    /grant select on table public\.workspace_memory_entries to authenticated/,
  );
  assert.equal(
    /grant (insert|update|delete).*workspace_memory_entries to authenticated/i.test(
      migration,
    ),
    false,
  );
  assert.match(
    migration,
    /private\.has_org_role\([\s\S]*array\['owner','admin','member'\]/,
  );
});

test("M1 does not silently overwrite a verified conflicting memory", () => {
  assert.match(
    migration,
    /Verified memory conflicts with the requested target/,
  );
  assert.match(
    migration,
    /Verified memory cannot be downgraded through upsert/,
  );
});

test("M1 records provenance, confidence, verification and usage", () => {
  assert.match(migration, /manual_confirmation/);
  assert.match(migration, /approved_quote/);
  assert.match(migration, /approved_po_reconciliation/);
  assert.match(migration, /verified_erp_mapping/);
  assert.match(migration, /confidence >= 0 and confidence <= 100/);
  assert.match(migration, /verified_by uuid/);
  assert.match(migration, /verified_at timestamptz/);
  assert.match(migration, /last_used_at timestamptz/);
  assert.match(migration, /use_count integer not null default 0/);
});

test("M1 usage is limited to verified memory", () => {
  assert.match(
    migration,
    /Only verified memory can be recorded as used/,
  );
  assert.match(
    migration,
    /set use_count = use_count \+ 1/,
  );
});

test("M1 writes lifecycle events to the existing activity audit trail", () => {
  assert.match(migration, /memory_created/);
  assert.match(migration, /memory_state_changed/);
  assert.match(migration, /memory_target_changed/);
  assert.match(migration, /memory_used/);
  assert.match(
    migration,
    /private\.write_activity_event/,
  );
});

test("memory server helper prefers customer memory and can fall back to workspace memory", () => {
  assert.match(helper, /scope", "customer"/);
  assert.match(helper, /allowWorkspaceFallback/);
  assert.match(helper, /scope", "workspace"/);
  assert.match(helper, /rememberWorkspaceDecision/);
  assert.match(helper, /recordWorkspaceMemoryUsage/);
});


test("M1 mutation RPCs are server-only after hardening", () => {
  assert.match(
    hardening,
    /drop function if exists public\.upsert_workspace_memory_entry/,
  );
  assert.match(
    hardening,
    /create or replace function public\.upsert_workspace_memory_entry_server/,
  );
  assert.match(
    hardening,
    /revoke all on function public\.upsert_workspace_memory_entry_server[\s\S]*from authenticated/,
  );
  assert.match(
    hardening,
    /grant execute on function public\.upsert_workspace_memory_entry_server[\s\S]*to service_role/,
  );
  assert.match(
    hardening,
    /revoke all on function public\.set_workspace_memory_state_server\(uuid,text,uuid\) from authenticated/,
  );
  assert.match(
    hardening,
    /revoke all on function public\.record_workspace_memory_usage_server\(uuid,uuid\) from authenticated/,
  );
});

test("M1 server helpers require an explicit actor for mutations", () => {
  assert.match(helper, /createAdminClient/);
  assert.match(helper, /target_actor_id: actorId/);
  assert.match(helper, /upsert_workspace_memory_entry_server/);
  assert.match(helper, /set_workspace_memory_state_server/);
  assert.match(helper, /record_workspace_memory_usage_server/);
});
