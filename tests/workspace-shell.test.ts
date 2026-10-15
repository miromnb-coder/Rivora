import { readFileSync } from "node:fs";
import { test } from "node:test";
import assert from "node:assert/strict";
import { activeWorkspaceItem } from "../lib/workspace-navigation.ts";
test("one navigation destination wins query, hash and detail precedence", () => {
  for (const [path,view,hash,want] of [
    ["/app",null,"","dashboard"], ["/app",null,"#dashboard-tasks-heading","tasks"],
    ["/app/settings",null,"#users","team"], ["/app/settings/operations",null,"","settings"],
    ["/app/orders","erp","","erp"], ["/app/orders","attention","","reviews"],
    ["/app/orders","unknown","","orders"], ["/app/orders/case/rfq/123","erp","","orders"],
    ["/app/orders-impostor",null,"",null], ["/app/quotes/123",null,"","orders"],
    ["/app/products/123",null,"","products"], ["/app/upload",null,"","rfq"],
  ] as const) assert.equal(activeWorkspaceItem(path,view,hash),want);
});
test("CSS and modal mode share the measured shell-width contract", () => {
  const shell=readFileSync("components/AppShell.tsx","utf8");
  const layout=readFileSync("components/workspace/useWorkspaceLayout.ts","utf8");
  assert.match(layout,/ResizeObserver/); assert.match(layout,/width < 1200/);
  assert.match(shell,/data-shell-mode=\{mode\}/);assert.match(shell,/mode=\{mode\}/);
  assert.doesNotMatch(shell,/key=\{pathname\}/);
});
