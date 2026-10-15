// Match route segments; query order and unrelated parameters do not affect selection.
export function activeWorkspaceItem(pathname: string, view: string | null, hash: string) {
  const family = (path: string) => pathname === path || pathname.startsWith(path + "/");
  if (pathname === "/app/orders" && (view === "attention" || view === "erp")) return view === "erp" ? "erp" : "reviews";
  if (pathname === "/app" && hash === "#dashboard-tasks-heading") return "tasks";
  if (pathname === "/app/settings" && hash === "#users") return "team";
  if (pathname === "/app") return "dashboard";
  if (["/app/orders", "/app/purchase-orders", "/app/sales-orders", "/app/quotes"].some(family)) return "orders";
  if (family("/app/inbox") || family("/app/rfq") || pathname === "/app/upload") return "rfq";
  if (family("/app/settings") || family("/app/memory")) return "settings";
  for (const id of ["products", "customers", "leads"]) if (family(`/app/${id}`)) return id;
  return null;
}
