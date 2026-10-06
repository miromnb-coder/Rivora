import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const migration = readFileSync(
  join(
    process.cwd(),
    "supabase/migrations/20261006080000_workspace_erp_connections.sql",
  ),
  "utf8",
);

test("ERP-A5 stores workspace ERP secrets in Supabase Vault", () => {
  assert.match(migration, /create table if not exists public\.erp_connections/);
  assert.match(migration, /secret_id uuid/);
  assert.match(migration, /vault\.create_secret/);
  assert.match(migration, /vault\.update_secret/);
  assert.equal(/client_secret\s+text/i.test(migration), false);
});

test("ERP-A5 rejects plaintext secret keys from configuration JSON", () => {
  assert.match(migration, /erp_connections_no_plain_secret_check/);
  assert.match(migration, /configuration \? 'clientSecret'/);
  assert.match(migration, /configuration \? 'password'/);
  assert.match(migration, /Secrets must not be stored in ERP connection configuration/);
});

test("ERP-A5 credential RPCs are server-only", () => {
  assert.match(
    migration,
    /revoke all on function public\.get_erp_connection_secret_server\(uuid,text\) from authenticated/,
  );
  assert.match(
    migration,
    /grant execute on function public\.get_erp_connection_secret_server\(uuid,text\) to service_role/,
  );
  assert.match(
    migration,
    /revoke all on table public\.erp_connections from authenticated/,
  );
});

test("ERP-A5 binds credential writes to an owner or admin and active provider", () => {
  assert.match(migration, /m\.role in \('owner','admin'\)/);
  assert.match(migration, /o\.erp_provider = normalized_provider/);
});

test("ERP-A5 supports an explicit disconnected state", () => {
  assert.match(migration, /status in \('configured', 'verified', 'error', 'disconnected'\)/);
  assert.match(migration, /status = 'disconnected'/);
  assert.match(migration, /secret_id = null/);
});
