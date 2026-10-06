import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const knowledge = readFileSync(
  join(process.cwd(), "lib/rivora/support-ai.ts"),
  "utf8",
);
const route = readFileSync(
  join(process.cwd(), "app/api/support/ask/route.ts"),
  "utf8",
);
const supportCenter = readFileSync(
  join(process.cwd(), "components/support/SupportCenter.tsx"),
  "utf8",
);

test("S3 Support AI is authenticated and workspace/user rate-limited", () => {
  assert.match(route, /getAuthContext/);
  assert.match(route, /!context\.claims\?\.sub \|\| !context\.workspace/);
  assert.match(route, /support_ai_user_short/);
  assert.match(route, /windowSeconds: 10 \* 60/);
  assert.match(route, /limit: 20/);
  assert.match(route, /support_ai_user_day/);
  assert.match(route, /limit: 100/);
  assert.match(route, /context\.workspace\.id.*context\.claims\.sub/s);
});

test("S3 AI receives only safe route-level app context, not record contents", () => {
  assert.match(route, /normalizeContextPath/);
  assert.match(route, /path\.startsWith\("\/app"\)/);
  assert.match(route, /supportContextForPath\(contextPath, locale\)/);
  assert.match(route, /Current route:/);
  assert.match(route, /Current area:/);
  assert.equal(/\.from\(["'][a-z_]+["']\)/.test(route), false);
});

test("S3 AI is explicitly read-only and cannot authorize product actions", () => {
  assert.match(
    knowledge,
    /Do not perform writes, approvals, confirmations, exports, sends, deletes, configuration changes/,
  );
  assert.match(
    route,
    /You are read-only\. You can explain, guide and point to product UI/,
  );
  assert.match(
    knowledge,
    /Never provide instructions for bypassing authorization, approval, audit, workspace isolation/,
  );
});

test("S3 blocks likely credentials before they reach OpenAI", () => {
  assert.match(knowledge, /looksLikeSupportSecret/);
  assert.match(knowledge, /PRIVATE KEY/);
  assert.match(knowledge, /client\[_ -\]\?secret/i);
  assert.match(route, /looksLikeSupportSecret\(question\)/);
  assert.match(route, /support_ai_secret_blocked/);
  assert.match(route, /sensitiveInputBlocked: true/);
});

test("S3 Support AI is bounded to approved knowledge and refuses unsupported claims", () => {
  assert.match(route, /SUPPORT_AI_KNOWLEDGE/);
  assert.match(route, /If the knowledge is insufficient, set supported=false and do not guess/);
  assert.match(route, /unsupportedSupportAiAnswer/);
  assert.match(route, /structured|json_schema/i);
});

test("S3 Support AI never writes conversations into Smart Memory", () => {
  assert.match(
    knowledge,
    /Support AI conversations must never be written into product memory/,
  );
  assert.equal(route.includes("workspace_memory_entries"), false);
  assert.equal(route.includes("create_support_ticket"), false);
});

test("S3 Help Center exposes AI chat, related help and human escalation", () => {
  assert.match(supportCenter, /Kysy Averomira AI:lta/);
  assert.match(supportCenter, /\/api\/support\/ask/);
  assert.match(supportCenter, /support-ai-thread/);
  assert.match(supportCenter, /articleIds/);
  assert.match(supportCenter, /Luo tukipyyntö tästä keskustelusta/);
  assert.match(supportCenter, /openContactFromAi/);
});

test("S3 escalation prefills but does not automatically submit a support ticket", () => {
  const functionStart = supportCenter.indexOf("function openContactFromAi");
  const functionEnd = supportCenter.indexOf("async function askSupportAi", functionStart);
  const escalation = supportCenter.slice(functionStart, functionEnd);

  assert.match(escalation, /setSubject/);
  assert.match(escalation, /setMessage/);
  assert.match(escalation, /setView\(\{ kind: "contact" \}\)/);
  assert.equal(escalation.includes('fetch("/api/support/tickets"'), false);
});

test("S3 UI warns users not to paste secrets", () => {
  assert.match(
    supportCenter,
    /Älä lähetä salasanoja, Client Secretejä, API-avaimia tai tokeneita/,
  );
  assert.match(
    supportCenter,
    /Do not send passwords, Client Secrets, API keys or tokens/,
  );
});
