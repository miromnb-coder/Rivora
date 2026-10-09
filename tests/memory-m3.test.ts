import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const migration = readFileSync(
  join(
    process.cwd(),
    "supabase/migrations/20261006150000_memory_m3_explainability_management.sql",
  ),
  "utf8",
);
const provenanceMigration = readFileSync(
  join(
    process.cwd(),
    "supabase/migrations/20261006151500_memory_m3_usage_provenance.sql",
  ),
  "utf8",
);
const m2Migration = readFileSync(
  join(
    process.cwd(),
    "supabase/migrations/20261006130000_memory_m2_product_memory.sql",
  ),
  "utf8",
);
const rfqPage = readFileSync(
  join(process.cwd(), "app/app/rfq/[id]/page.tsx"),
  "utf8",
);
const memoryPage = readFileSync(
  join(process.cwd(), "app/app/memory/page.tsx"),
  "utf8",
);
const memoryActions = readFileSync(
  join(process.cwd(), "app/app/memory/actions.ts"),
  "utf8",
);
const settingsPage = readFileSync(
  join(process.cwd(), "app/app/settings/page.tsx"),
  "utf8",
);
const appNav = readFileSync(
  join(process.cwd(), "components/AppNav.tsx"),
  "utf8",
);

test("M3 explains Product Memory from the idempotent RFQ usage provenance", () => {
  assert.match(
    migration,
    /create or replace function public\.get_rfq_product_memory_explanations_server/,
  );
  assert.match(migration, /workspace_memory_usage_events usage/);
  assert.match(migration, /usage\.source_entity_type = 'rfq_line'/);
  assert.match(migration, /mem\.target_entity_id = l\.selected_product_id/);
  assert.match(migration, /target_actor_id uuid/);
});

test("M3 explainability RPC stays service-role-only", () => {
  assert.match(
    migration,
    /revoke all on function public\.get_rfq_product_memory_explanations_server\(uuid,uuid\) from authenticated/,
  );
  assert.match(
    migration,
    /grant execute on function public\.get_rfq_product_memory_explanations_server\(uuid,uuid\) to service_role/,
  );
});

test("M3 management mutates canonical memory by memory id", () => {
  assert.match(
    migration,
    /update_customer_product_memory_by_memory_server/,
  );
  assert.match(
    migration,
    /disable_customer_product_memory_by_memory_server/,
  );
  assert.match(migration, /where mem\.id = target_memory_id/);
  assert.match(
    migration,
    /update public\.workspace_memory_entries[\s\S]*verification_state = 'verified'/,
  );
  assert.match(
    migration,
    /update public\.workspace_memory_entries[\s\S]*verification_state = 'disabled'/,
  );
});

test("M3 explicit management keeps the legacy compatibility mirror synchronized", () => {
  assert.match(
    migration,
    /insert into public\.customer_product_mappings/,
  );
  assert.match(
    migration,
    /on conflict \(organization_id, customer_id, normalized_customer_sku\)/,
  );
  assert.match(
    migration,
    /delete from public\.customer_product_mappings legacy/,
  );
});

test("M3 mutation RPCs stay actor-bound and service-role-only", () => {
  for (const signature of [
    "update_customer_product_memory_by_memory_server",
    "disable_customer_product_memory_by_memory_server",
  ]) {
    assert.match(
      migration,
      new RegExp(
        `revoke all on function public\\.${signature}[\\s\\S]*from authenticated`,
      ),
    );
    assert.match(
      migration,
      new RegExp(
        `grant execute on function public\\.${signature}[\\s\\S]*to service_role`,
      ),
    );
  }
  assert.match(migration, /om\.user_id = target_actor_id/);
});

test("Smart Memory settings read the M1 canonical memory table", () => {
  assert.match(memoryPage, /from\("workspace_memory_entries"\)/);
  assert.match(memoryPage, /customer_sku_product/);
  assert.match(memoryPage, /verification_state/);
  assert.match(memoryPage, /use_count/);
  assert.equal(memoryPage.includes('from("customer_product_mappings")'), false);
});

test("Smart Memory settings update and disable by canonical memory id", () => {
  assert.match(memoryActions, /name="memoryId"|formData\.get\("memoryId"\)/);
  assert.match(
    memoryActions,
    /update_customer_product_memory_by_memory_server/,
  );
  assert.match(
    memoryActions,
    /disable_customer_product_memory_by_memory_server/,
  );
  assert.match(memoryActions, /target_actor_id: claims\.sub/);
});

test("RFQ Review renders remembered mapping provenance without bypassing review", () => {
  assert.match(
    rfqPage,
    /get_rfq_product_memory_explanations_server/,
  );
  assert.match(
    rfqPage,
    /product_memory: \["Muistettu vastine", "Remembered mapping"\]/,
  );
  assert.match(
    rfqPage,
    /Muisti priorisoi ehdotuksen, mutta tämä rivi vaatii edelleen ihmisen vahvistuksen/,
  );
  assert.match(
    rfqPage,
    /memoryExplanationByLine/,
  );
});

test("Smart Memory remains reachable from the Settings page", () => {
  assert.match(settingsPage, /"Älykäs muisti"/);
  assert.match(settingsPage, /"\/app\/memory"/);
  assert.match(appNav, /pathname === "\/app\/memory"/);
});

test("M3 does not relax the M2 verified-only reuse rule", () => {
  assert.match(m2Migration, /mem\.verification_state = 'verified'/);
  assert.match(m2Migration, /review_status = 'needs_review'/);
});


test("M3 snapshots Product Memory meaning at usage time", () => {
  assert.match(
    provenanceMigration,
    /create trigger workspace_memory_usage_events_snapshot/,
  );
  assert.match(
    provenanceMigration,
    /'memory_target_entity_id', mem\.target_entity_id/,
  );
  assert.match(
    provenanceMigration,
    /'memory_source_value', mem\.source_value/,
  );
  assert.match(
    provenanceMigration,
    /'memory_verification_state', mem\.verification_state/,
  );
  assert.match(
    provenanceMigration,
    /Memory usage event workspace mismatch/,
  );
});

test("M3 explainability prefers immutable usage provenance over mutable current memory", () => {
  assert.match(
    provenanceMigration,
    /usage\.metadata ->> 'memory_target_entity_id'/,
  );
  assert.match(
    provenanceMigration,
    /usage\.metadata ->> 'memory_source_value'/,
  );
  assert.match(
    provenanceMigration,
    /usage\.metadata ->> 'memory_verified_at'/,
  );
  assert.match(
    provenanceMigration,
    /memory_target_entity_id'[\s\S]*= l\.selected_product_id/,
  );
});

test("M3 provenance hardening keeps explain RPC service-role-only", () => {
  assert.match(
    provenanceMigration,
    /revoke all on function public\.get_rfq_product_memory_explanations_server\(uuid,uuid\) from authenticated/,
  );
  assert.match(
    provenanceMigration,
    /grant execute on function public\.get_rfq_product_memory_explanations_server\(uuid,uuid\) to service_role/,
  );
});
