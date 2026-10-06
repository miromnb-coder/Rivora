import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const migration = readFileSync(
  join(
    process.cwd(),
    "supabase/migrations/20261006130000_memory_m2_product_memory.sql",
  ),
  "utf8",
);
const rfqActions = readFileSync(
  join(process.cwd(), "app/app/rfq/[id]/actions.ts"),
  "utf8",
);
const uploadActions = readFileSync(
  join(process.cwd(), "app/app/upload/actions.ts"),
  "utf8",
);
const memoryActions = readFileSync(
  join(process.cwd(), "app/app/memory/actions.ts"),
  "utf8",
);
const rfqPage = readFileSync(
  join(process.cwd(), "app/app/rfq/[id]/page.tsx"),
  "utf8",
);

test("M2 migrates legacy Customer Memory into the M1 memory core safely", () => {
  assert.match(migration, /from public\.customer_product_mappings m/);
  assert.match(
    migration,
    /case when m\.confirmed_by_user_id is not null then 'verified' else 'proposed' end/,
  );
  assert.match(migration, /'customer_sku_product'/);
  assert.match(migration, /'migrated_from_legacy_memory', true/);
  assert.match(migration, /on conflict do nothing/);
});

test("M2 Product Memory is the canonical first-priority RFQ match", () => {
  assert.match(
    migration,
    /'product_memory'::text as method,[\s\S]*5 as method_priority/,
  );
  assert.match(migration, /mem\.verification_state = 'verified'/);
  assert.match(migration, /mem\.target_entity_type = 'product'/);
  assert.equal(migration.includes("'customer_memory'::text"), false);
  assert.match(
    migration,
    /review_status = 'needs_review'/,
  );
});

test("M2 never silently replaces a conflicting verified product memory", () => {
  assert.match(
    migration,
    /Verified Product Memory points to another product/,
  );
  assert.match(
    migration,
    /existing_memory\.verification_state = 'verified'/,
  );
});

test("M2 memory use counting is idempotent per RFQ line", () => {
  assert.match(
    migration,
    /create table if not exists public\.workspace_memory_usage_events/,
  );
  assert.match(
    migration,
    /unique \(memory_id, source_entity_type, source_entity_id\)/,
  );
  assert.match(
    migration,
    /on conflict \(memory_id, source_entity_type, source_entity_id\)[\s\S]*do nothing/,
  );
  assert.match(migration, /set use_count = m\.use_count \+ counts\.added_uses/);
  assert.match(
    migration,
    /set times_used = legacy\.times_used \+ counts\.added_uses/,
  );
});

test("M2 mutations stay behind server-only service-role RPCs", () => {
  for (const signature of [
    "confirm_rfq_line_match_with_memory_server",
    "refresh_rfq_matches_with_memory_server",
    "update_customer_product_memory_server",
    "disable_customer_product_memory_server",
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
});

test("RFQ confirmation and retry use M2 server RPCs with the authenticated actor", () => {
  assert.match(rfqActions, /createAdminClient/);
  assert.match(rfqActions, /confirm_rfq_line_match_with_memory_server/);
  assert.match(rfqActions, /refresh_rfq_matches_with_memory_server/);
  assert.match(rfqActions, /target_actor_id: claims\.sub/);
  assert.equal(
    rfqActions.includes('supabase.rpc("confirm_rfq_line_match"'),
    false,
  );
});

test("new CSV and PDF RFQs run Product Memory matching", () => {
  assert.match(uploadActions, /createAdminClient/);
  assert.equal(
    (
      uploadActions.match(
        /refresh_rfq_matches_with_memory_server/g,
      ) ?? []
    ).length,
    2,
  );
  assert.equal(
    (
      uploadActions.match(/target_actor_id: claims\.sub/g) ?? []
    ).length,
    2,
  );
});

test("Customer Memory management keeps the M1 core synchronized", () => {
  assert.match(memoryActions, /update_customer_product_memory_server/);
  assert.match(memoryActions, /disable_customer_product_memory_server/);
  assert.match(memoryActions, /target_actor_id: claims\.sub/);
});

test("RFQ Review explains Product Memory without bypassing confirmation", () => {
  assert.match(
    rfqPage,
    /product_memory: \["Älykkään muistin vastine", "Smart Product Memory match"\]/,
  );
  assert.match(
    rfqPage,
    /myös muisti- ja tarkat osumat vaativat vahvistuksen/,
  );
});
