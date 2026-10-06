import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const migration = readFileSync(
  join(
    process.cwd(),
    "supabase/migrations/20261006191000_support_s4_tracking.sql",
  ),
  "utf8",
);
const ticketListRoute = readFileSync(
  join(process.cwd(), "app/api/support/tickets/route.ts"),
  "utf8",
);
const ticketDetailRoute = readFileSync(
  join(process.cwd(), "app/api/support/tickets/[id]/route.ts"),
  "utf8",
);
const operatorListRoute = readFileSync(
  join(process.cwd(), "app/api/support/operator/tickets/route.ts"),
  "utf8",
);
const operatorDetailRoute = readFileSync(
  join(process.cwd(), "app/api/support/operator/tickets/[id]/route.ts"),
  "utf8",
);
const supportCenter = readFileSync(
  join(process.cwd(), "components/support/SupportCenter.tsx"),
  "utf8",
);
const tracker = readFileSync(
  join(process.cwd(), "components/support/SupportTicketTracker.tsx"),
  "utf8",
);
const inbox = readFileSync(
  join(process.cwd(), "components/support/SupportInbox.tsx"),
  "utf8",
);
const operatorPage = readFileSync(
  join(process.cwd(), "app/app/settings/support/page.tsx"),
  "utf8",
);
const operatorAuth = readFileSync(
  join(process.cwd(), "lib/rivora/support-operator.ts"),
  "utf8",
);
const supportEmail = readFileSync(
  join(process.cwd(), "lib/rivora/support-email.ts"),
  "utf8",
);

test("S4 adds private per-user read cursors and message timestamps", () => {
  assert.match(migration, /create table if not exists public\.support_ticket_reads/);
  assert.match(migration, /primary key \(ticket_id, user_id\)/);
  assert.match(migration, /support_ticket_reads_deny_browser_access/);
  assert.match(
    migration,
    /revoke all on table public\.support_ticket_reads from public, anon, authenticated/,
  );
  assert.match(migration, /last_message_at timestamptz/);
  assert.match(migration, /last_support_message_at timestamptz/);
  assert.match(migration, /support_messages_touch_ticket/);
});

test("S4 ticket reply and read mutations remain service-role-only", () => {
  for (const fn of [
    "mark_support_ticket_read_server",
    "append_support_user_message_server",
    "append_support_operator_message_server",
    "update_support_ticket_operator_server",
  ]) {
    assert.match(migration, new RegExp(`create or replace function public\\.${fn}`));
    assert.match(
      migration,
      new RegExp(
        `revoke all on function public\\.${fn}[\\s\\S]*from public, anon, authenticated`,
      ),
    );
    assert.match(
      migration,
      new RegExp(
        `grant execute on function public\\.${fn}[\\s\\S]*to service_role`,
      ),
    );
  }
});

test("S4 customer ticket list exposes only the signed-in user's own tickets", () => {
  assert.match(ticketListRoute, /export async function GET/);
  assert.match(ticketListRoute, /\.eq\("organization_id", context\.workspace\.id\)/);
  assert.match(ticketListRoute, /\.eq\("created_by", context\.claims\.sub\)/);
  assert.match(ticketListRoute, /support_ticket_reads/);
  assert.match(ticketListRoute, /unreadCount/);
});

test("S4 customer detail verifies ownership, marks read and signs private attachments", () => {
  assert.match(ticketDetailRoute, /ticketForActor/);
  assert.match(ticketDetailRoute, /\.eq\("created_by", actorId\)/);
  assert.match(ticketDetailRoute, /mark_support_ticket_read_server/);
  assert.match(ticketDetailRoute, /createSignedUrl/);
  assert.match(ticketDetailRoute, /15 \* 60/);
});

test("S4 customer replies can include a screenshot and reopen a waiting or resolved ticket", () => {
  assert.match(ticketDetailRoute, /append_support_user_message_server/);
  assert.match(ticketDetailRoute, /support_ticket_reply_user/);
  assert.match(ticketDetailRoute, /image\/png/);
  assert.match(ticketDetailRoute, /5 \* 1024 \* 1024/);
  assert.match(
    migration,
    /when current_status in \('waiting_customer','resolved'\) then 'in_progress'/,
  );
  assert.match(migration, /customer_message_added/);
});

test("S4 operator access is email-allowlisted and never granted to arbitrary workspace admins", () => {
  assert.match(operatorAuth, /AVEROMIRA_SUPPORT_ADMIN_EMAILS/);
  assert.match(operatorAuth, /AVEROMIRA_SUPPORT_EMAIL/);
  assert.match(operatorAuth, /AVEROMIRA_QUOTE_REPLY_TO/);
  assert.match(operatorListRoute, /isSupportOperatorEmail/);
  assert.match(operatorDetailRoute, /isSupportOperatorEmail/);
  assert.match(operatorPage, /isSupportOperatorEmail/);
  assert.match(operatorPage, /redirect\("\/app\/settings"\)/);
  assert.equal(operatorAuth.includes("workspaceRole"), false);
});

test("S4 operator workflow supports replies, statuses, priorities and customer email notifications", () => {
  assert.match(operatorDetailRoute, /append_support_operator_message_server/);
  assert.match(operatorDetailRoute, /update_support_ticket_operator_server/);
  assert.match(operatorDetailRoute, /notifyCustomerAboutSupportReply/);
  assert.match(migration, /support_message_added/);
  assert.match(migration, /ticket_updated/);
  assert.match(supportEmail, /notifyCustomerAboutSupportReply/);
  assert.match(supportEmail, /My support requests/);
});

test("S4 customer Help Center shows unread replies and in-app ticket tracking", () => {
  assert.match(supportCenter, /supportUnreadCount/);
  assert.match(supportCenter, /support-launcher-badge/);
  assert.match(supportCenter, /Omat tukipyynnöt/);
  assert.match(supportCenter, /SupportTicketTracker/);
  assert.match(tracker, /support-ticket-status/);
  assert.match(tracker, /Vastaa tukeen/);
  assert.match(tracker, /\/api\/support\/tickets\/\$\{encodeURIComponent\(ticketId\)\}/);
});

test("S4 operator inbox provides queue, conversation, reply and status controls", () => {
  assert.match(inbox, /support-ops-list/);
  assert.match(inbox, /waitingOnSupport/);
  assert.match(inbox, /Lähetä vastaus/);
  assert.match(inbox, /method: "PATCH"/);
  assert.match(inbox, /method: "POST"/);
  assert.match(operatorPage, /SupportInbox/);
});
