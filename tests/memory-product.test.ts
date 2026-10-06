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

test("M2 backfills historical customer SKU memory without trusting actorless rows", () => {
  assert.match(migration, /insert into public\.workspace_memory_entries/);
  assert.match(migration, /'customer_sku_product'/);
  assert.match(
    migration,
    /case when m\.confirmed_by_user_id is not null then 'verified' else 'proposed' end/,
  );
});

test("M2 uses only verified Smart Product Memory as the reusable memory source", () => {
  assert.match(migration, /'product_memory'::text as method/);
  assert.match(migration, /mem\.verification_state = 'verified'/);
  assert.match(migration, /mem\.memory_type = 'customer_sku_product'/);
  assert.match(migration, /mem\.scope = 'customer'/);
  assert.equal(migration.includes("'customer_memory'::text"), false);
});

test("M2 keeps remembered suggestions human-confirmed", () => {
  assert.match(
    migration,
    /match_method = best\.method,[\s\S]*review_status = 'needs_review'/,
  );
  assert.match(
    rfqPage,
    /memory and exact matches still require confirmation/,
  );
  assert.match(rfqPage, /Smart Product Memory match/);
});

test("M2 confirmation writes verified memory through a server-only actor-bound RPC", () => {
  assert.match(
    migration,
    /create or replace function public\.confirm_rfq_line_match_with_memory_server/,
  );
  assert.match(migration, /target_actor_id uuid/);
  assert.match(
    migration,
    /Verified Product Memory points to another product/,
  );
  assert.match(
    migration,
    /public\.upsert_workspace_memory_entry_server/,
  );
  assert.match(
    migration,
    /revoke all on function public\.confirm_rfq_line_match_with_memory_server[\s\S]*from authenticated/,
  );
  assert.match(
    migration,
    /grant execute on function public\.confirm_rfq_line_match_with_memory_server[\s\S]*to service_role/,
  );
});

test("M2 usage counting is idempotent per RFQ line", () => {
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
});

test("M2 application paths use the server-only Product Memory RPCs", () => {
  assert.match(rfqActions, /confirm_rfq_line_match_with_memory_server/);
  assert.match(rfqActions, /refresh_rfq_matches_with_memory_server/);
  assert.match(rfqActions, /target_actor_id: claims\.sub/);
  assert.equal(rfqActions.includes('rpc("confirm_rfq_line_match",'), false);

  assert.match(uploadActions, /refresh_rfq_matches_with_memory_server/g);
  assert.match(uploadActions, /target_actor_id: claims\.sub/g);
  assert.equal(uploadActions.includes('rpc("refresh_rfq_matches",'), false);
});

test("M2 keeps Memory management synchronized with the canonical memory core", () => {
  assert.match(memoryActions, /update_customer_product_memory_server/);
  assert.match(memoryActions, /disable_customer_product_memory_server/);
  assert.match(memoryActions, /target_actor_id: claims\.sub/);
  assert.match(
    migration,
    /verification_state = 'disabled'/,
  );
});

test("M2 does not auto-apply inactive catalogue targets", () => {
  assert.match(
    migration,
    /join public\.products p[\s\S]*p\.id = mem\.target_entity_id[\s\S]*p\.active = true/,
  );
});
