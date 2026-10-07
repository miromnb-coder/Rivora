import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const migration = readFileSync(
  join(
    process.cwd(),
    "supabase/migrations/20261007081500_memory_m4_controlled_expansion.sql",
  ),
  "utf8",
);
const structuredRoute = readFileSync(
  join(process.cwd(), "app/api/purchase-orders/structured/route.ts"),
  "utf8",
);
const poActions = readFileSync(
  join(process.cwd(), "app/app/purchase-orders/actions.ts"),
  "utf8",
);
const reconciliationActions = readFileSync(
  join(process.cwd(), "app/app/purchase-orders/reconciliation-actions.ts"),
  "utf8",
);
const reconciliationService = readFileSync(
  join(process.cwd(), "lib/rivora/po-reconciliation-service.ts"),
  "utf8",
);
const reconciliation = readFileSync(
  join(process.cwd(), "lib/rivora/po-reconciliation.ts"),
  "utf8",
);
const reconciliationPanel = readFileSync(
  join(process.cwd(), "app/app/purchase-orders/[id]/ReconciliationPanel.tsx"),
  "utf8",
);
const poDetail = readFileSync(
  join(process.cwd(), "app/app/purchase-orders/[id]/page.tsx"),
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

test("M4 extends the canonical memory core with scalar targets without weakening entity memory", () => {
  assert.match(migration, /add column if not exists target_value text/);
  assert.match(
    migration,
    /target_entity_type in ('product', 'customer', 'unit', 'po_field')/,
  );
  assert.match(
    migration,
    /target_entity_type in ('product', 'customer')[\s\S]*target_entity_id is not null[\s\S]*target_value is null/,
  );
  assert.match(
    migration,
    /target_entity_type in ('unit', 'po_field')[\s\S]*target_entity_id is null[\s\S]*target_value is not null/,
  );
  assert.match(
    migration,
    /Existing memory types must target product or customer entities/,
  );
});

test("M4 PO field memory is restricted to an allow-listed field vocabulary", () => {
  for (const field of [
    "customer_sku",
    "description",
    "manufacturer",
    "manufacturer_part_number",
    "quantity",
    "unit",
    "unit_price",
    "net_unit_price",
    "discount_percent",
    "line_total",
  ]) {
    assert.match(migration, new RegExp(`'${field}'`));
  }
  assert.match(migration, /Unsupported purchase-order field target/);
});

test("M4 unit memory can only be learned from accepted equal-quantity unit mismatches", () => {
  assert.match(
    migration,
    /accept_purchase_order_exception_with_memory_server/,
  );
  assert.match(migration, /line_row\.exception_codes \? 'unit_mismatch'/);
  assert.match(
    migration,
    /abs\(po_quantity - quote_quantity\) > 0\.0001/,
  );
  assert.match(
    migration,
    /Unit memory cannot be learned when quantities differ/,
  );
  assert.match(migration, /'alias_only', true/);
  assert.match(migration, /'evidence', 'accepted_unit_mismatch'/);
});

test("M4 privileged mutations remain service-role-only and actor-bound", () => {
  for (const signature of [
    "upsert_customer_po_field_memory_server",
    "update_customer_po_field_memory_server",
    "disable_customer_scalar_memory_server",
    "accept_purchase_order_exception_with_memory_server",
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

test("M4 memory usage stays idempotent and provenance-backed", () => {
  assert.match(
    migration,
    /insert into public\.workspace_memory_usage_events/,
  );
  assert.match(
    migration,
    /on conflict \(memory_id, source_entity_type, source_entity_id\)[\s\S]*do nothing/,
  );
  assert.match(
    migration,
    /'memory_target_value', mem\.target_value/,
  );
  assert.match(
    migration,
    /create trigger purchase_orders_memory_usage/,
  );
  assert.match(
    migration,
    /create trigger purchase_order_reconciliation_lines_memory_usage/,
  );
});

test("structured PO imports apply only verified customer PO-field memory", () => {
  for (const source of [structuredRoute, poActions]) {
    assert.match(source, /toPurchaseOrderRowsWithFieldMemory/);
    assert.match(source, /customer_po_field_alias/);
    assert.match(source, /verification_state", "verified"/);
    assert.match(source, /memory_context: memoryContext/);
    assert.match(source, /po_field_memories/);
  }
});

test("PO reconciliation loads only verified customer unit memory", () => {
  assert.match(reconciliationService, /customer_unit_alias/);
  assert.match(reconciliationService, /verification_state", "verified"/);
  assert.match(
    reconciliationService,
    /customer_id", purchaseOrder\.customer_id/,
  );
  assert.match(reconciliationService, /\{ unitAliases \}/);
  assert.match(reconciliationService, /memory_context: line\.memoryContext/);
});

test("unit memory changes only equivalence logic and keeps source snapshots intact", () => {
  assert.match(reconciliation, /deterministic-v2-memory/);
  assert.match(reconciliation, /unitComparison/);
  assert.match(reconciliation, /memoryAssistedLines/);
  assert.match(reconciliation, /poSnapshot: po/);
  assert.equal(reconciliation.includes("po.quantity ="), false);
  assert.equal(reconciliation.includes("quote.quantity ="), false);
});

test("PO exception review learns unit memory through the server RPC", () => {
  assert.match(reconciliationActions, /createAdminClient/);
  assert.match(
    reconciliationActions,
    /accept_purchase_order_exception_with_memory_server/,
  );
  assert.match(reconciliationActions, /remember_unit_alias: rememberUnitAlias/);
  assert.match(reconciliationActions, /target_actor_id: claims\.sub/);
});

test("M4 UI makes unit learning explicit and explains assisted PO lines", () => {
  assert.match(reconciliationPanel, /name="rememberUnitAlias"/);
  assert.match(
    reconciliationPanel,
    /Muista yksikköalias/,
  );
  assert.match(
    reconciliationPanel,
    /Se ei tee määrämuunnosta/,
  );
  assert.match(
    reconciliationPanel,
    /Älykäs muisti auttoi/,
  );
  assert.match(poDetail, /po_field_memories/);
  assert.match(poDetail, /Alkuperäistä tiedostoa tai sen arvoja ei muutettu/);
});

test("Smart Memory management exposes controlled PO fields but no manual unit-memory creation", () => {
  assert.match(memoryPage, /customer_unit_alias/);
  assert.match(memoryPage, /customer_po_field_alias/);
  assert.match(memoryPage, /createCustomerPoFieldMemory/);
  assert.match(memoryPage, /Yksikköalias voidaan oppia vain PO-poikkeaman ihmishyväksynnästä/);
  assert.equal(memoryActions.includes("createCustomerUnitMemory"), false);
  assert.match(
    memoryActions,
    /upsert_customer_po_field_memory_server/,
  );
  assert.match(
    memoryActions,
    /disable_customer_scalar_memory_server/,
  );
});
