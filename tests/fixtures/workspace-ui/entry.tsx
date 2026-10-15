import { createRoot } from "react-dom/client";
import { useState } from "react";
import { AppShell } from "../../../components/AppShell";
import { usePathname } from "./navigation";
// Page markup below is replaced by the actual server-rendered OrdersPage. Only
// its data provider is synthetic; no auth bypass exists in the Next application.
function Fixture() {
  const [workspace, setWorkspace] = useState("fixture-a");
  const path = usePathname();
  return <AppShell workspaceId={workspace} workspaceName="Synteettinen Teollisuus Oy" workspaceRole={new URLSearchParams(location.search).get("role") || "owner"} userEmail="fixture@example.invalid" locale="fi" leadsEnabled={!location.search.includes("leads=off")} supportOperator={false} supportRecordEnabled={false} initialSidebarCollapsed={document.cookie.includes("averomira-sidebar-collapsed=1")}>
    <button data-testid="switch-workspace" onClick={() => setWorkspace(value => value === "fixture-a" ? "fixture-b" : "fixture-a")}>Vaihda fixture-työtilaa</button>
    <div key={path} dangerouslySetInnerHTML={{ __html: window.__PAGE_HTML__[path.split("/")[2] || "orders"] || window.__PAGE_HTML__.orders }} />
  </AppShell>;
}
declare global { interface Window { __PAGE_HTML__: Record<string, string>; } }
createRoot(document.getElementById("root")!).render(<Fixture />);
