import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const migration = readFileSync(
  join(
    process.cwd(),
    "supabase/migrations/20261006183000_support_s1_foundation.sql",
  ),
  "utf8",
);
const hardening = readFileSync(
  join(
    process.cwd(),
    "supabase/migrations/20261006184500_harden_support_s1.sql",
  ),
  "utf8",
);
const supportCenter = readFileSync(
  join(process.cwd(), "components/support/SupportCenter.tsx"),
  "utf8",
);
const supportRoute = readFileSync(
  join(process.cwd(), "app/api/support/tickets/route.ts"),
  "utf8",
);
const appShell = readFileSync(
  join(process.cwd(), "components/AppShell.tsx"),
  "utf8",
);

test("S1 creates workspace-scoped support entities and a private attachment bucket", () => {
  for (const table of [
    "support_tickets",
    "support_messages",
    "support_attachments",
    "support_events",
  ]) {
    assert.match(
      migration,
      new RegExp(`create table if not exists public\\.${table}`),
    );
    assert.match(
      migration,
      new RegExp(`alter table public\\.${table} enable row level security`),
    );
  }

  assert.match(migration, /'support-attachments'/);
  assert.match(migration, /public,\s*file_size_limit/);
  assert.match(migration, /false,\s*5242880/);
});

test("S1 support ticket creation is atomic and hardened behind the server role", () => {
  assert.match(
    hardening,
    /create or replace function public\.create_support_ticket_server/,
  );
  assert.match(hardening, /target_actor_id uuid/);
  assert.match(
    hardening,
    /m\.user_id = target_actor_id[\s\S]*m\.role in \('owner','admin','member'\)/,
  );
  assert.match(hardening, /insert into public\.support_tickets/);
  assert.match(hardening, /insert into public\.support_messages/);
  assert.match(hardening, /insert into public\.support_events/);
  assert.match(
    hardening,
    /revoke all on function public\.create_support_ticket_server[\s\S]*from authenticated/,
  );
  assert.match(
    hardening,
    /grant execute on function public\.create_support_ticket_server[\s\S]*to service_role/,
  );
  assert.match(
    hardening,
    /drop function if exists public\.create_support_ticket\(uuid,text,text,text,text,text\)/,
  );
});

test("browser roles cannot mutate support tables directly", () => {
  assert.match(
    migration,
    /revoke all on table public\.support_tickets from anon, authenticated/,
  );
  assert.match(
    migration,
    /revoke all on table public\.support_messages from anon, authenticated/,
  );
  assert.equal(
    /grant (insert|update|delete).*support_tickets to authenticated/i.test(
      migration,
    ),
    false,
  );
});

test("support attachment upload stays server-side and validates image size and type", () => {
  assert.match(supportRoute, /createAdminClient/);
  assert.match(supportRoute, /image\/png/);
  assert.match(supportRoute, /image\/jpeg/);
  assert.match(supportRoute, /image\/webp/);
  assert.match(supportRoute, /5 \* 1024 \* 1024/);
  assert.match(supportRoute, /from\("support-attachments"\)/);
  assert.match(supportRoute, /from\("support_attachments"\)/);
});

test("support endpoint is authenticated, rate-limited and records safe app context", () => {
  assert.match(supportRoute, /getAuthContext/);
  assert.match(supportRoute, /support_ticket_user/);
  assert.match(supportRoute, /windowSeconds: 60 \* 60/);
  assert.match(supportRoute, /limit: 10/);
  assert.match(supportRoute, /rawContextPath\.startsWith\("\/app"\)/);
  assert.match(supportRoute, /target_request_id: requestId/);
  assert.match(supportRoute, /create_support_ticket_server/);
  assert.match(supportRoute, /target_actor_id: context\.claims\.sub/);
});

test("S1 Help Center is mounted globally in the authenticated app shell", () => {
  assert.match(appShell, /SupportCenter/);
  assert.match(appShell, /<SupportCenter locale=\{locale\}/);
  assert.match(supportCenter, /className="support-launcher"/);
  assert.match(supportCenter, /Miten voimme auttaa\?/);
  assert.match(supportCenter, /Lähetä tukipyyntö/);
  assert.match(supportCenter, /Kuvakaappaus \(valinnainen\)/);
});

test("S1 Help Center foundation remains intact as later support phases are added", () => {
  assert.match(supportCenter, /className="support-launcher"/);
  assert.match(supportCenter, /Lähetä tukipyyntö/);
  assert.match(supportCenter, /\/api\/support\/tickets/);
  assert.match(supportCenter, /Kuvakaappaus \(valinnainen\)/);
});


test("S1 hardening gives the audit table an explicit browser-deny policy and covers support FKs", () => {
  assert.match(hardening, /create policy support_events_deny_browser_access/);
  for (const index of [
    "support_messages_org_idx",
    "support_messages_author_idx",
    "support_attachments_org_idx",
    "support_attachments_message_idx",
    "support_attachments_uploaded_by_idx",
    "support_events_org_idx",
    "support_events_actor_idx",
  ]) {
    assert.match(hardening, new RegExp(`create index if not exists ${index}`));
  }
});
