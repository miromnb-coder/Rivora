import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const hardening = readFileSync(
  join(
    process.cwd(),
    "supabase/migrations/20261006133000_memory_m2_freeze_hardening.sql",
  ),
  "utf8",
);

test("M2 freeze hardening preserves legacy and Product Memory match methods", () => {
  for (const method of [
    "product_memory",
    "customer_memory",
    "exact_sku",
    "exact_mpn",
    "fuzzy",
    "catalogue",
    "ai_suggestion",
  ]) {
    assert.match(hardening, new RegExp(`'${method}'`));
  }
  assert.match(hardening, /rfq_lines_match_method_check/);
  assert.match(hardening, /product_match_candidates_method_check/);
  assert.match(hardening, /'manual'/);
});

test("M2 freeze hardening covers the customer foreign key", () => {
  assert.match(
    hardening,
    /workspace_memory_entries_customer_id_idx[\s\S]*workspace_memory_entries\(customer_id\)/,
  );
});

test("M2 freeze hardening preserves the actor on legacy delete audit", () => {
  assert.match(
    hardening,
    /coalesce\(\(select auth\.uid\(\)\), old\.confirmed_by_user_id\)/,
  );
  assert.match(
    hardening,
    /set confirmed_by_user_id = target_actor_id,[\s\S]*delete from public\.customer_product_mappings/,
  );
});

test("M2 freeze hardening keeps delete mutation service-role-only", () => {
  assert.match(
    hardening,
    /revoke all on function public\.disable_customer_product_memory_server\(uuid,uuid\) from authenticated/,
  );
  assert.match(
    hardening,
    /grant execute on function public\.disable_customer_product_memory_server\(uuid,uuid\) to service_role/,
  );
});
