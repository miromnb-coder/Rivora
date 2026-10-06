import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const migration = readFileSync(
  join(
    process.cwd(),
    "supabase/migrations/20261006093000_harden_leads_authorization.sql",
  ),
  "utf8",
);
const hardening = readFileSync(
  join(
    process.cwd(),
    "supabase/migrations/20261006094000_harden_leads_feature_rpc.sql",
  ),
  "utf8",
);
const salesGuard = readFileSync(
  join(process.cwd(), "lib/rivora/sales.ts"),
  "utf8",
);
const appShell = readFileSync(
  join(process.cwd(), "components/AppShell.tsx"),
  "utf8",
);
const alertRoute = readFileSync(
  join(process.cwd(), "app/api/leads/alert-count/route.ts"),
  "utf8",
);

test("SEC-L1 defines an explicit workspace feature gate for Leads", () => {
  assert.match(migration, /create table if not exists public\.organization_features/);
  assert.match(migration, /feature_key = lower\(trim\(coalesce\(target_feature, ''\)\)\)/);
  assert.match(migration, /m\.role in \('owner', 'admin'\)/);
  assert.match(migration, /f\.enabled = true/);
});

test("marketing lead read and update policies require the Leads feature", () => {
  assert.match(migration, /drop policy if exists marketing_leads_owner_admin_select/);
  assert.match(migration, /drop policy if exists marketing_leads_owner_admin_update/);
  assert.match(
    migration,
    /create policy marketing_leads_feature_admin_select[\s\S]*?can_manage_workspace_feature\('leads'\)/,
  );
  assert.match(
    migration,
    /create policy marketing_leads_feature_admin_update[\s\S]*?can_manage_workspace_feature\('leads'\)/,
  );
});

test("pilot invite admin policies use the same Leads feature gate", () => {
  assert.match(
    migration,
    /create policy "pilot invites feature admin insert"[\s\S]*?can_manage_workspace_feature\('leads'\)/,
  );
  assert.match(
    migration,
    /create policy "pilot invites feature admin read"[\s\S]*?can_manage_workspace_feature\('leads'\)/,
  );
  assert.match(
    migration,
    /create policy "pilot invites feature admin update"[\s\S]*?can_manage_workspace_feature\('leads'\)/,
  );
  assert.match(migration, /grant select, insert, update on table public\.pilot_access_invites to authenticated/);
});

test("feature check RPC is hardened to security invoker with read-only feature visibility", () => {
  assert.match(hardening, /security invoker/);
  assert.match(hardening, /create policy organization_features_member_read/);
  assert.match(hardening, /grant select on table public\.organization_features to authenticated/);
  assert.equal(/grant (insert|update|delete).*organization_features to authenticated/i.test(hardening), false);
});

test("Leads route and API use the centralized capability guard", () => {
  assert.match(salesGuard, /canManageWorkspaceFeature\(context, "leads"\)/);
  assert.match(alertRoute, /canManageWorkspaceFeature\(context, "leads"\)/);
});

test("Leads navigation no longer depends on a workspace name", () => {
  assert.equal(appShell.includes("nordic flow systems oy"), false);
  assert.match(appShell, /leadsEnabled: boolean/);
  assert.match(appShell, /\.\.\.\(leadsEnabled/);
});
