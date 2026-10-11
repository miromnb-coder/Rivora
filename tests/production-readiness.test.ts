import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import {
  toCatalogueRows,
  toPurchaseOrderRows,
  toRfqRows,
} from "../lib/rivora/imports.ts";

const migration = readFileSync(
  join(
    process.cwd(),
    "supabase/migrations/20261006100000_r3_production_readiness.sql",
  ),
  "utf8",
);
const leadRoute = readFileSync(
  join(process.cwd(), "app/api/leads/route.ts"),
  "utf8",
);
const bcAdapter = readFileSync(
  join(process.cwd(), "lib/rivora/erp/business-central.ts"),
  "utf8",
);
const healthRoute = readFileSync(
  join(process.cwd(), "app/api/health/route.ts"),
  "utf8",
);
const smokeWorkflow = readFileSync(
  join(process.cwd(), ".github/workflows/production-smoke.yml"),
  "utf8",
);
const proxyGuard = readFileSync(
  join(process.cwd(), "lib/supabase/proxy.ts"),
  "utf8",
);
const runbook = readFileSync(
  join(process.cwd(), "docs/production-runbook.md"),
  "utf8",
);

test("R3 public rate limiter is service-role-only", () => {
  assert.match(migration, /create table if not exists public\.public_rate_limits/);
  assert.match(migration, /create or replace function public\.consume_public_rate_limit_server/);
  assert.match(
    migration,
    /revoke all on function public\.consume_public_rate_limit_server\(text,text,integer,integer\) from authenticated/,
  );
  assert.match(
    migration,
    /grant execute on function public\.consume_public_rate_limit_server\(text,text,integer,integer\) to service_role/,
  );
});

test("public lead capture enforces both client and email throttles", () => {
  assert.match(leadRoute, /scope: "lead_ip"/);
  assert.match(leadRoute, /windowSeconds: 10 \* 60/);
  assert.match(leadRoute, /limit: 10/);
  assert.match(leadRoute, /scope: "lead_email"/);
  assert.match(leadRoute, /windowSeconds: 60 \* 60/);
  assert.match(leadRoute, /limit: 4/);
  assert.match(leadRoute, /"Retry-After"/);
  assert.match(leadRoute, /status: 429/);
});

test("Business Central calls have finite timeouts and ambiguous create recovery", () => {
  assert.match(bcAdapter, /AbortSignal\.timeout\(20_000\)/);
  assert.match(
    bcAdapter,
    /AbortSignal\.timeout\(method === "POST" \? 30_000 : 20_000\)/,
  );
  assert.match(bcAdapter, /detectedAfterAmbiguousCreate: true/);
  assert.match(bcAdapter, /Automatic retry is locked/);
  assert.match(
    bcAdapter,
    /afterCreateFailure\.value\?\.\[0\]/,
  );
});

test("production health endpoint is minimal and database-backed", () => {
  assert.match(healthRoute, /\.from\("organizations"\)/);
  assert.match(healthRoute, /status: "ok"/);
  assert.match(healthRoute, /status: 503/);
  assert.equal(healthRoute.includes("SUPABASE_SECRET"), false);
  assert.equal(healthRoute.includes("RESEND_API_KEY"), false);
  assert.equal(healthRoute.includes("BUSINESS_CENTRAL_CLIENT_SECRET"), false);
});

test("tabular business imports have workload-specific row ceilings", () => {
  const rfqRow = {
    "customer sku": "SKU-1",
    description: "Product",
    quantity: "1",
    unit: "pcs",
  };
  assert.throws(
    () => toRfqRows(Array.from({ length: 1001 }, () => rfqRow)),
    /Maximum is 1,000/,
  );

  const poRow = {
    sku: "SKU-1",
    description: "Product",
    quantity: "1",
    "unit price": "10",
  };
  assert.throws(
    () => toPurchaseOrderRows(Array.from({ length: 2001 }, () => poRow)),
    /Maximum is 2,000/,
  );

  const catalogueRow = {
    sku: "SKU-1",
    name: "Product",
  };
  assert.throws(
    () => toCatalogueRows(Array.from({ length: 25001 }, () => catalogueRow)),
    /25 000/,
  );
});

test("production smoke is non-destructive and targets Averomira", () => {
  assert.match(smokeWorkflow, /https:\/\/averomira\.com\/api\/health/);
  assert.match(smokeWorkflow, /https:\/\/averomira\.com\/login/);
  assert.match(smokeWorkflow, /cron:/);
  assert.equal(smokeWorkflow.includes("/app/sales-orders"), false);
});

test("runbook documents ambiguous ERP, restore drills and credential rotation", () => {
  assert.match(runbook, /Pending for more than 10 minutes/);
  assert.match(runbook, /Restore drill/);
  assert.match(runbook, /Credential rotation/);
  assert.match(runbook, /Do not click export again/);
});

test("R3 migration fixes current production advisor hotspots", () => {
  assert.match(migration, /pilot invites authorized read/);
  assert.match(migration, /\(select auth\.jwt\(\)\)/);
  assert.match(migration, /pilot_access_invites_accepted_by_idx/);
  assert.match(migration, /quote_email_events_organization_id_idx/);
  assert.match(migration, /quotes_created_by_idx/);
});


test("production health endpoint bypasses authenticated app routing", () => {
  assert.match(proxyGuard, /pathname === "\/api\/health"/);
});
