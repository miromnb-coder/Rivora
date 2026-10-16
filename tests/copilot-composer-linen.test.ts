import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const ui = readFileSync("components/copilot/CopilotConversation.tsx", "utf8");
const css = readFileSync("app/app/copilot-conversation.css", "utf8");

test("Copilot never renders color emoji instead of a monochrome welcome/process icon", () => {
  assert.match(ui, /function CopilotGlyph\(/);
  assert.match(ui, /fill="none" stroke="currentColor"/);
  assert.match(ui, /<CopilotGlyph \/>/);
  assert.match(ui, /<CopilotGlyph completed=\{message\.stage === "done"\} \/>/);
  assert.doesNotMatch(ui, /[✳✅]/);
});

test("Message composer keeps real accessible controls and streaming behaviors", () => {
  assert.match(ui, /placeholder=\{fi \? "Miten voin auttaa\?" : "How can I help you\?"\}/);
  assert.match(ui, /className="ml-copilot-composer-actions"/);
  assert.match(ui, /aria-label=\{fi \? "Lähetä viesti"/);
  assert.match(ui, /aria-label=\{fi \? "Pysäytä vastaus"/);
  assert.match(ui, /onKeyDown=\{onComposerKeyDown\}/);
  assert.match(ui, /maxLength=\{1200\}/);
  assert.doesNotMatch(ui, /aria-label=\{fi \? "Lisää liite"/);
});

test("Linen composer stays warm, softly focused, two-level and touch accessible", () => {
  assert.match(css, /\.ml-workspace-shell \.ml-copilot-composer\s*\{[\s\S]*?flex-direction: column;/);
  assert.match(css, /background: var\(--ml-surface-warm\)/);
  assert.match(css, /\.ml-workspace-shell \.ml-copilot-composer:focus-within/);
  assert.match(css, /\.ml-workspace-shell \.ml-copilot-composer-actions/);
  assert.match(css, /\.ml-workspace-shell \.ml-copilot-send\s*\{[\s\S]*?border-radius: 50%/);
  assert.match(css, /width: 44px; height: 44px/);
  assert.match(css, /prefers-reduced-motion: reduce/);
});
