import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const read = (file: string) => readFileSync(join(process.cwd(), file), "utf8");
const center = read("components/support/SupportCenter.tsx");
const prompts = read("components/support/SupportQuickPrompts.tsx");
const styles = read("app/app/support-s5.css");
const knowledge = read("lib/rivora/support-knowledge.ts");

const homeStart = center.indexOf('{view.kind === "home" ? (', center.indexOf("support-center-body"));
const helpStart = center.indexOf('{view.kind === "help" ? (', homeStart);
const ticketsStart = center.indexOf('{view.kind === "tickets" || view.kind === "ticket" ? (', helpStart);
const home = center.slice(homeStart, helpStart);
const help = center.slice(helpStart, ticketsStart);

test("2.1 home is a single AI shell, not a card inside the legacy support stack", () => {
  assert.ok(homeStart > 0 && helpStart > homeStart && ticketsStart > helpStart);
  assert.match(home, /className="support-ai-shell"/);
  assert.match(home, /className="support-ai-bottom"/);
  assert.match(home, /<SupportQuickPrompts/);
  assert.doesNotMatch(home, /className="support-ai-card"|support-context-section|support-help-library|support-home-action-copy/);
  assert.equal((home.match(/<SupportQuickPrompts/g) || []).length, 1);
  assert.equal((home.match(/className="support-home-actions"/g) || []).length, 1);
});

test("2.1 help library and contextual recommendations are on their own screen", () => {
  assert.match(center, /\| \{ kind: "help" \}/);
  assert.match(help, /support-help-library-page/);
  assert.match(help, /support-context-links/);
  assert.match(help, /SUOSITELTU TÄSSÄ NÄKYMÄSSÄ/);
  assert.match(help, /setView\(\{ kind: "article", articleId: article.id \}\)/);
  assert.match(help, /setView\(\{ kind: "home" \}\)/);
  assert.match(center, /articleReturnView/);
});

test("2.1 has fixed bottom composer, multiline message and compact three-way navigation", () => {
  assert.match(home, /ref=\{aiInputRef\}[\s\S]*?rows=\{2\}/);
  assert.match(home, /event\.key === "Enter" && !event\.shiftKey/);
  assert.match(home, /event\.currentTarget\.form\?\.requestSubmit\(\)/);
  assert.match(home, /<nav className="support-home-actions"/);
  assert.match(home, /<BookIcon\s*\/>/);
  assert.match(home, /<TicketIcon\s*\/>/);
  assert.match(home, /<HeadsetIcon\s*\/>/);
  assert.match(styles, /\.support-ai-scroll\s*\{/);
  assert.match(styles, /overflow-y: auto/);
  assert.match(styles, /\.support-ai-bottom\s*\{/);
  assert.match(styles, /grid-template-columns: repeat\(3, minmax\(0, 1fr\)\)/);
});

test("2.1 preserves AI, consent, escalation, manual tickets and both languages", () => {
  for (const symbol of [
    "askSupportAi", "useCurrentRecord", "recordContextAvailable",
    "openContactFromAi", "submitSupport", "SupportTicketTracker", "supportUnreadCount",
    "articleIds", "setAiQuestion", "SupportQuickPrompts",
  ]) assert.ok(center.includes(symbol), symbol);
  assert.match(prompts, /Miksi ostotilaus vaatii tarkistusta\?/);
  assert.match(prompts, /How does the Business Central integration work\?/);
  assert.match(knowledge, /business-central-mapping/);
  assert.match(center, /setUseCurrentRecord\(false\)/);
});

test("2.1 modal restores focus and traps keyboard navigation", () => {
  assert.match(center, /ref=\{dialogRef\}/);
  assert.match(center, /ref=\{launcherRef\}/);
  assert.match(center, /previousFocusRef\.current/);
  assert.match(center, /useModal\(\{ active: open, panel: dialogRef/);
  const modal = read("components/workspace/useModal.ts");
  assert.match(modal, /event\.key !== "Tab"/);
  assert.match(modal, /event\.key === "Escape"/);
  assert.match(center, /returnTo\?\.focus\(\)/);
});

test("2.1 covers phone and desktop heights and preserves reduced motion", () => {
  assert.match(styles, /width: min\(492px, calc\(100vw - 32px\)\)/);
  assert.match(styles, /@media \(max-width: 560px\)/);
  assert.match(styles, /width: 100vw/);
  assert.match(styles, /height: 100dvh/);
  assert.match(styles, /env\(safe-area-inset-bottom\)/);
  assert.match(styles, /@media \(max-height: 650px\)/);
  assert.match(styles, /prefers-reduced-motion: reduce/);
});

test("2.1 polish: welcome has no icon and composer uses one subtle focus border", () => {
  assert.doesNotMatch(prompts, /support-s5-sparkle/);
  assert.equal(styles.includes(".support-s5-sparkle {"), false);
  assert.ok(styles.includes("border-color: var(--app-control-border);"));
  assert.ok(styles.includes("outline: 2px solid var(--app-focus);"));
  assert.ok(styles.includes("border: 0 !important;"));
  assert.ok(styles.includes("outline: none !important;"));
  assert.ok(styles.includes(".support-ai-form > textarea:focus-visible"));
  assert.ok(styles.includes("box-shadow: none !important;"));
});
