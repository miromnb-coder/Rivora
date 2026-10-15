import { createRoot } from "react-dom/client";
import { useState } from "react";
import { AppShell } from "../../../components/AppShell";
import { usePathname } from "./navigation";
// Static server-page markup verifies layout and native controls only. React
// event handlers inside this markup are not hydrated; AppShell is interactive.
function Fixture() {
  const [workspace, setWorkspace] = useState("fixture-a");
  const path = usePathname();
  const segments = path.split("/").slice(2);
  const pageKey = segments.length > 1 ? `${segments[0]}/[id]` : segments[0] || "orders";
  return <AppShell workspaceId={workspace} workspaceName="Synteettinen Teollisuus Oy" workspaceRole={new URLSearchParams(location.search).get("role") || "owner"} userEmail="fixture@example.invalid" locale="fi" leadsEnabled={!location.search.includes("leads=off")} supportOperator={false} supportRecordEnabled={false} initialSidebarCollapsed={document.cookie.includes("averomira-sidebar-collapsed=1")}>
    <button data-testid="switch-workspace" onClick={() => setWorkspace(value => value === "fixture-a" ? "fixture-b" : "fixture-a")}>Vaihda fixture-työtilaa</button>
    <div key={path} data-fixture-page={pageKey} dangerouslySetInnerHTML={{ __html: window.__PAGE_HTML__[pageKey] || window.__PAGE_HTML__.orders }} />
  </AppShell>;
}
declare global { interface Window { __PAGE_HTML__: Record<string, string>; } }
createRoot(document.getElementById("root")!).render(<Fixture />);
