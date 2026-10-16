import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const read = (p: string) => readFileSync(join(process.cwd(), p), "utf8");
const app = read("components/AppShell.tsx");
const launcher = read("components/workspace/WorkspaceSupportTrigger.tsx");
const help = read("components/support/SupportCenter.tsx");
const events = read("components/support/ContextHelpTrigger.tsx");
const frame = read("components/workspace/WorkspaceFrame.tsx");
const leads = read("app/app/leads/page.tsx");
const css = read("app/app/workspace-shell.css");

test("Help Center stays fully functional and opens from navigation", () => {
  assert.match(app, /<WorkspaceSupportTrigger locale=\{locale\}/);
  assert.match(app, /<SupportCenter locale=\{locale\}/);
  assert.match(launcher, /dispatchEvent\(new CustomEvent\(SUPPORT_OPEN_EVENT\)\)/);
  assert.match(events, /SUPPORT_UNREAD_EVENT/);
  assert.match(help, /setView\(\{ kind: "article", articleId \}\)/);
  assert.match(help, /openSupport\(\)/);
  assert.match(help, /supportUnreadCount/);
  for (const name of ["askSupportAi", "submitSupport", "SupportTicketTracker", "openContactFromAi"]) assert.ok(help.includes(name));
  assert.match(css, /\.ml-workspace-shell \.support-launcher \{ display: none !important; \}/);
  assert.match(frame, /window\.addEventListener\(SUPPORT_OPEN_EVENT/);
  assert.match(frame, /setCopilotDismissed\(true\)/);
});
test("Account menu preserves locale selection and sign-out on desktop and mobile", () => {
  assert.match(app, /<details className="ml-workspace-account-menu">/);
  assert.match(app, /<details className="ml-mobile-account">/);
  assert.equal((app.match(/<LocaleSwitcher/g) || []).length, 2);
  assert.equal((app.match(/action=\{signOut\}/g) || []).length, 2);
  assert.match(app, /ml-account-details-email/);
  assert.match(css, /ml-workspace-account-details/);
});
test("Leads keep every field across container breakpoints, without changing queries", () => {
  assert.match(leads, /requireSalesAdmin\(\)/);
  assert.match(leads, /\.from\("marketing_leads"\)/);
  assert.match(leads, /className="app-page-v2 ml-leads-page ml-unified-page"/);
  for (const cls of ["person", "company", "intent", "followup", "state", "open"]) {
    assert.match(leads, new RegExp("ml-lead-" + cls));
    assert.match(css, new RegExp("ml-lead-" + cls));
  }
  assert.match(css, /container: leads \/ inline-size/);
  assert.match(css, /@container leads \(max-width: 900px\)/);
  assert.match(css, /@container leads \(max-width: 480px\)/);
  assert.doesNotMatch(leads, /style=\{\{\s*display: "none"/);
});
