import assert from "node:assert/strict";
import test from "node:test";
import { CopilotStreamParser, buildCopilotHistory } from "../lib/rivora/copilot-stream.ts";
import { encodeCopilotEvent } from "../lib/rivora/copilot-protocol.ts";
import { readFileSync } from "node:fs";

test("SSE parser preserves UTF-8 text and CRLF terminators over single-byte chunks", () => {
  const parser = new CopilotStreamParser();
  const payload = [
    encodeCopilotEvent({ type: "stage", stage: "connecting" }),
    encodeCopilotEvent({ type: "delta", text: "Älykkäämpi työtila 💡" }),
    encodeCopilotEvent({ type: "done" }),
  ].join("").replace(/\n/g, "\r\n");
  const bytes = new TextEncoder().encode(payload);
  const events = [];
  for (const byte of bytes) events.push(...parser.push(Uint8Array.of(byte)));
  parser.finish();
  assert.deepEqual(events, [
    { type: "stage", stage: "connecting" },
    { type: "delta", text: "Älykkäämpi työtila 💡" },
    { type: "done" },
  ]);
});

test("SSE parser allows fragmented frames but rejects oversized or unterminated frames", () => {
  const parser = new CopilotStreamParser();
  const payload = new TextEncoder().encode(encodeCopilotEvent({
    type: "delta", text: "Askel kerrallaan",
  }));
  assert.deepEqual(parser.push(payload.slice(0, 7)), []);
  assert.deepEqual(parser.push(payload.slice(7)), [
    { type: "delta", text: "Askel kerrallaan" },
  ]);
  parser.finish();
  assert.throws(() => new CopilotStreamParser().push(
    new TextEncoder().encode("event: delta\ndata: " + "x".repeat(17000)),
  ), /too large/);
  const cut = new CopilotStreamParser();
  cut.push(payload.slice(0, -1));
  assert.throws(() => cut.finish(), /middle of an event/);
});

test("Conversation history includes only complete paired user and assistant turns", () => {
  const input = [
    { role: "user" as const, text: "First question" },
    { role: "assistant" as const, text: "First answer", stage: "done" as const },
    { role: "user" as const, text: "Failed question" },
    { role: "assistant" as const, text: "Partial", stage: "error" as const },
    { role: "user" as const, text: "Stopped question" },
    { role: "assistant" as const, text: "Partial", stage: "stopped" as const },
    { role: "user" as const, text: "Next question" },
    { role: "assistant" as const, text: "Next answer", stage: "done" as const },
    { role: "user" as const, text: "Pending" },
    { role: "assistant" as const, text: "", stage: "responding" as const },
  ];
  assert.deepEqual(buildCopilotHistory(input), [
    { role: "user", text: "First question" },
    { role: "assistant", text: "First answer" },
    { role: "user", text: "Next question" },
    { role: "assistant", text: "Next answer" },
  ]);
});

test("Phase 4.1 keeps streaming and recovery local to Copilot without database writes", () => {
  const ui = readFileSync("components/copilot/CopilotConversation.tsx", "utf8");
  const shell = readFileSync("components/workspace/WorkspaceFrame.tsx", "utf8");
  const css = readFileSync("app/app/copilot-conversation.css", "utf8");
  for (const fragment of ["CopilotStreamParser", "buildCopilotHistory", "requestAnimationFrame",
                          "flushPaint", "retryLast", "followTail.current", "shiftKey", "role=\"log\""])
    assert.ok(ui.includes(fragment), "Missing recovery contract: " + fragment);
  assert.match(ui, /aria-busy=\{busy\}/);
  assert.match(shell, /SUPPORT_OPEN_EVENT/);
  assert.match(shell, /paused=\{copilotDismissed\}/);
  assert.match(ui, /if \(paused\) controller\.current\?\.abort\(\)/);
  assert.match(css, /prefers-reduced-motion: reduce/);
  assert.match(css, /ml-copilot-scroll-latest/);
  assert.match(css, /ml-copilot-retry/);
  assert.doesNotMatch(ui, /\.from\(|\.insert\(|\.update\(/);
});
