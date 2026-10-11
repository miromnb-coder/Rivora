import assert from "node:assert/strict";
import test from "node:test";
import {
  helpArticles, articleById, searchSupportArticles, supportKnowledgeExcerpt,
} from "../lib/rivora/support-knowledge.ts";

test("S6: Finnish and English use the same approved article IDs", () => {
  assert.deepEqual(helpArticles.fi.map((a) => a.id), helpArticles.en.map((a) => a.id));
  assert.equal(new Set(helpArticles.fi.map((a) => a.id)).size, helpArticles.fi.length);
  assert.ok(helpArticles.fi.length >= 12);
});

test("S6: retrieves ERP mapping guidance with bounded results and valid source IDs", () => {
  const found = searchSupportArticles("Miksi Business Central -vastine puuttuu?", "fi", ["business-central-mapping"]);
  assert.ok(found.some((item) => item.id === "business-central-mapping"));
  assert.ok(found.length <= 4);
  assert.match(supportKnowledgeExcerpt(found), /ARTICLE ID: business-central-mapping/);
  assert.equal(articleById("en", "business-central-mapping")?.id, "business-central-mapping");
});

test("S6: no matching articles do not fabricate source knowledge", () => {
  const found = searchSupportArticles("xyzzyflorpzz", "fi");
  assert.deepEqual(found, []);
  assert.match(supportKnowledgeExcerpt(found), /No relevant approved article/);
});

test("S6: recommendations never exceed article limit and only reference known content", () => {
  const all = helpArticles.fi.map((a) => a.id);
  const found = searchSupportArticles("...", "fi", all, 99);
  assert.ok(found.length <= 4);
  for (const item of found) assert.ok(articleById("fi", item.id));
});
