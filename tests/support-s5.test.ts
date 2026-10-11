import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const center = readFileSync(join(process.cwd(), "components/support/SupportCenter.tsx"), "utf8");
const prompts = readFileSync(join(process.cwd(), "components/support/SupportQuickPrompts.tsx"), "utf8");
const styles = readFileSync(join(process.cwd(), "app/app/support-s5.css"), "utf8");
const layout = readFileSync(join(process.cwd(), "app/app/layout.tsx"), "utf8");

test("S5 quick prompts remain user-initiated and source-driven", () => {
  assert.match(center, /<SupportQuickPrompts/);
  assert.match(center, /contextArticles\.length/);
  assert.match(prompts, /onPick\(article\.title\)/);
  assert.match(center, /setAiQuestion\(question\)/);
  assert.match(center, /\/api\/support\/ask/);
});

test("S5 preserves conversation across route transitions but isolates record history", () => {
  const effect = center.slice(center.indexOf("if (previousPathRef.current === pathname)"), center.indexOf("}, [pathname]"));
  assert.doesNotMatch(effect, /setAiMessages\(\[\]\)/);
  assert.match(effect, /setContextChanged\(aiMessages\.length > 0\)/);
  assert.match(center, /history: previousMessages\.filter\(\(item\) => item\.path === pathname\)/);
  assert.match(center, /path: pathname/);
});

test("S5 does not remove support ticket escalation or accessibility labels", () => {
  assert.match(center, /SupportTicketTracker/);
  assert.match(center, /openContactFromAi/);
  assert.match(center, /role="dialog"/);
  assert.match(center, /aria-live="polite"/);
});

test("S5 scoped styles provide mobile coverage and readable customer bubbles", () => {
  assert.match(layout, /import "\.\/support-s5\.css";/);
  assert.match(styles, /height: 100dvh/);
  assert.match(styles, /grid-template-columns: repeat\(3, minmax\(0,1fr\)\)/);
  assert.match(styles, /support-ai-message\.is-user > p/);
  assert.match(styles, /color: #fff/);
});
