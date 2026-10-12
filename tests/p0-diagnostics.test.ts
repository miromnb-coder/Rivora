import test from "node:test";
import assert from "node:assert/strict";
import { supabaseProjectRef, p0DiagnosticOperatorAllowed, observeSupabaseFetch,
  P0_DIAGNOSTICS_EXPIRES_AT, P0_PRODUCTION_PROJECT_ID } from "../lib/rivora/p0-diagnostics.ts";

const allowed = { deploymentEnvironment: "production", now: P0_DIAGNOSTICS_EXPIRES_AT - 1,
  deploymentProjectId: P0_PRODUCTION_PROJECT_ID,
  email: "operator@synthetic.invalid", emailConfirmed: true,
  configuredEmails: "operator@synthetic.invalid" };
test("P0 diagnostic denies missing configuration, preview, expiry and unconfirmed identity", () => {
  assert.equal(p0DiagnosticOperatorAllowed(allowed), true);
  for (const override of [{ configuredEmails: undefined }, { deploymentEnvironment: "preview" },
    { now: P0_DIAGNOSTICS_EXPIRES_AT }, { now: NaN }, { emailConfirmed: false },
    { deploymentProjectId: "other-project" }, { deploymentProjectId: undefined },
    { email: "other@synthetic.invalid" }]) {
    assert.equal(p0DiagnosticOperatorAllowed({ ...allowed, ...override }), false);
  }
});
test("P0 project identity rejects credentials, custom hosts and HTTP", () => {
  assert.equal(supabaseProjectRef("https://abcdefghijklmnopqrst.supabase.co/rest/v1/organizations"), "abcdefghijklmnopqrst");
  for(const url of ["https://secret:password@abcdefghijklmnopqrst.supabase.co",
    "http://abcdefghijklmnopqrst.supabase.co", "https://abcdefghijklmnopqrst.supabase.co.evil.invalid",
    "https://localhost:5432", "invalid"]) assert.equal(supabaseProjectRef(url), null);
});
test("P0 observation records contacted destination and prohibits redirect following", async () => {
  let method: string | undefined, redirect: RequestRedirect | undefined;
  const observation = observeSupabaseFetch(async (_input, init) => {
    method = init?.method; redirect = init?.redirect; return new Response(null, { status: 200 });
  });
  assert.equal(observation.projectRef(), null);
  await observation.fetch("https://abcdefghijklmnopqrst.supabase.co/rest/v1/organizations?select=id&limit=0", { method: "HEAD" });
  assert.equal(method, "HEAD"); assert.equal(redirect, "error");
  assert.equal(observation.projectRef(), "abcdefghijklmnopqrst");
  await assert.rejects(() => observation.fetch("https://other.invalid"));
});
test("P0 diagnostic never forwards arbitrary paths, writes, filters or request bodies", async () => {
  let forwarded = 0;
  const observer = observeSupabaseFetch(async () => { forwarded++; return new Response(null); });
  const root = "https://abcdefghijklmnopqrst.supabase.co/rest/v1/";
  for (const [url, init] of [
    [root + "organizations?select=id&limit=0", { method: "POST" }],
    [root + "organizations?select=id&limit=1", { method: "HEAD" }],
    [root + "organizations?select=*&limit=0", { method: "HEAD" }],
    [root + "organizations?select=id&limit=0&organization_id=eq.anything", { method: "HEAD" }],
    [root + "organizations?select=id&select=*&limit=0", { method: "HEAD" }],
    [root + "products?select=id&limit=0", { method: "HEAD" }],
    [root + "organizations?select=id&limit=0", { method: "HEAD", body: "payload" }],
  ] as [string, RequestInit][]) await assert.rejects(() => observer.fetch(url, init));
  assert.equal(forwarded, 0);
});
test("P0 failed probes do not establish an identity", async () => {
  const observer = observeSupabaseFetch(async () => new Response(null, { status: 503 }));
  await observer.fetch("https://abcdefghijklmnopqrst.supabase.co/rest/v1/organizations?select=id&limit=0", { method: "HEAD" });
  assert.equal(observer.projectRef(), null);
});
