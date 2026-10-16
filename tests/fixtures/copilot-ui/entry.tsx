import { createRoot } from "react-dom/client";
import { CopilotConversation } from "../../../components/copilot/CopilotConversation";

const locale = new URLSearchParams(location.search).get("locale") === "en" ? "en" : "fi";

createRoot(document.getElementById("root")!).render(
  <div className="app-shell-v2 ml-theme ml-workspace-shell ml-drawer-open">
    <aside className="app-sidebar-v2" aria-label="Synteettinen valikko">
      <strong>AVEROMIRA</strong>
      <div className="app-sidebar-v2-nav"><span className="app-sidebar-v2-link">Tilaukset</span></div>
    </aside>
    <div className="ml-workspace-stage"><main className="app-main-v2">
      <div className="app-page-v2"><h1>Synteettinen testityötila</h1>
        <p>Tällä näkymällä ei ole pääsyä oikeaan yritysdataan.</p></div>
    </main></div>
    <aside id="ml-copilot-shell" className="ml-copilot-shell" aria-label="Intelligent Copilot">
      <header className="ml-copilot-head"><span className="ml-copilot-headline">
        <strong>Averomira Copilot</strong>
        <small>Synteettinen suoratoistotesti</small>
      </span></header>
      <CopilotConversation locale={locale} />
    </aside>
  </div>,
);
