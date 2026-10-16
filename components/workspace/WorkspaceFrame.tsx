"use client";

import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { SUPPORT_OPEN_EVENT } from "@/components/support/ContextHelpTrigger";

type WorkspaceFrameProps = {
  children: ReactNode;
  sidebar: ReactNode;
  mobileHeader: ReactNode;
  mobileNavigation: ReactNode;
  support: ReactNode;
  locale: "fi" | "en";
};

function PanelIcon({ kind }: { kind: "menu" | "spark" | "close" }) {
  const paths: Record<typeof kind, ReactNode> = {
    menu: <><rect x="3.5" y="4" width="17" height="16" rx="2" /><path d="M9 4v16" /></>,
    spark: <><path d="m12 2 2.1 6.9L21 11l-6.9 2.1L12 20l-2.1-6.9L3 11l6.9-2.1L12 2Z" /><path d="m19 18 .7 1.3L21 20l-1.3.7L19 22l-.7-1.3L17 20l1.3-.7L19 18Z" /></>,
    close: <><path d="M5 5l14 14M19 5 5 19" /></>,
  };
  return <svg aria-hidden="true" width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{paths[kind]}</svg>;
}

export function WorkspaceFrame({
  children, sidebar, mobileHeader, mobileNavigation, support, locale,
}: WorkspaceFrameProps) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [tabletExpanded, setTabletExpanded] = useState(false);
  const [copilotDismissed, setCopilotDismissed] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const drawerClose = useRef<HTMLButtonElement>(null);
  const opener = useRef<HTMLButtonElement>(null);
  const pathname = usePathname();
  const fi = locale === "fi";

  useEffect(() => { setDrawerOpen(false); }, [pathname]);
  useEffect(() => {
    // Help Center is a separate modal experience; never leave a Copilot
    // drawer or desktop pane competing with it.
    const onSupportOpen = () => {
      setDrawerOpen(false);
      setCopilotDismissed(true);
    };
    window.addEventListener(SUPPORT_OPEN_EVENT, onSupportOpen);
    return () => window.removeEventListener(SUPPORT_OPEN_EVENT, onSupportOpen);
  }, []);
  useEffect(() => {
    const breakpoint = window.matchMedia("(max-width: 1359px)");
    const syncMode = () => { if (!breakpoint.matches) setDrawerOpen(false); };
    breakpoint.addEventListener("change", syncMode);
    return () => breakpoint.removeEventListener("change", syncMode);
  }, []);
  useEffect(() => {
    if (!drawerOpen) return;
    if (!window.matchMedia("(max-width: 1359px)").matches) return;
    const oldOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    drawerClose.current?.focus();
    return () => { document.body.style.overflow = oldOverflow; opener.current?.focus(); };
  }, [drawerOpen]);

  function toggleSidebar() {
    if (window.matchMedia("(max-width: 1023px)").matches) {
      setTabletExpanded(value => !value);
    } else {
      setSidebarCollapsed(value => !value);
    }
  }
  function openCopilot() {
    setCopilotDismissed(false);
    // Desktop uses a regular complementary pane, not a modal dialog.
    setDrawerOpen(window.matchMedia("(max-width: 1359px)").matches);
  }
  function closeCopilot() {
    const wasModal = drawerOpen;
    setCopilotDismissed(true);
    setDrawerOpen(false);
    if (!wasModal) opener.current?.focus();
  }
  function onPanelKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (!drawerOpen) return;
    if (event.key === "Escape") {
      event.preventDefault();
      closeCopilot();
      return;
    }
    if (event.key !== "Tab") return;
    const root = event.currentTarget;
    const focusable = Array.from(root.querySelectorAll<HTMLElement>('button:not([disabled]),a[href],input:not([disabled]),[tabindex]:not([tabindex="-1"])'))
      .filter(node => node.getClientRects().length > 0);
    if (!focusable.length) return;
    const first = focusable[0], last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  }

  return (
    <div className={[
      "app-shell-v2", "ml-theme", "ml-workspace-shell",
      sidebarCollapsed ? "ml-sidebar-collapsed" : "",
      tabletExpanded ? "ml-tablet-expanded" : "",
      copilotDismissed ? "ml-copilot-dismissed" : "",
      drawerOpen ? "ml-drawer-open" : "",
    ].filter(Boolean).join(" ")}>
      {sidebar}
      {mobileHeader}
      <div className="ml-workspace-stage">
        <div className="ml-workspace-toolbar">
          <button className="ml-workspace-icon-button ml-sidebar-toggle" type="button"
            onClick={toggleSidebar} aria-label={fi ? "Vaihda navigaation leveyttä" : "Toggle navigation width"}
            title={fi ? "Vaihda navigaation leveyttä" : "Toggle navigation width"}>
            <PanelIcon kind="menu" />
          </button>
          <span className="ml-workspace-toolbar-title">{fi ? "Työtila" : "Workspace"}</span>
          <button className="ml-workspace-copilot-trigger" type="button" ref={opener}
            onClick={openCopilot} aria-controls="ml-copilot-shell"
            aria-label={fi ? "Avaa Intelligent Copilot" : "Open Intelligent Copilot"}>
            <PanelIcon kind="spark" />
            <span>Copilot</span>
          </button>
        </div>
        <main className="app-main-v2">{children}</main>
      </div>
      <button type="button" className="ml-copilot-backdrop" aria-label={fi ? "Sulje Copilot" : "Close Copilot"} onClick={closeCopilot} tabIndex={drawerOpen ? 0 : -1} aria-hidden={!drawerOpen} />
      <aside id="ml-copilot-shell" className="ml-copilot-shell" aria-label="Intelligent Copilot"
        role={drawerOpen ? "dialog" : "complementary"} aria-modal={drawerOpen ? true : undefined}
        onKeyDown={onPanelKeyDown}>
        <header className="ml-copilot-head">
          <span className="ml-copilot-symbol"><PanelIcon kind="spark" /></span>
          <span className="ml-copilot-headline"><strong>Averomira Copilot</strong>
            <small>{fi ? "Työtilan älykäs avustaja" : "Intelligent workspace assistant"}</small>
          </span>
          <button className="ml-workspace-icon-button ml-copilot-close" type="button" ref={drawerClose}
            onClick={closeCopilot} aria-label={fi ? "Sulje Copilot" : "Close Copilot"}>
            <PanelIcon kind="close" />
          </button>
        </header>
        <div className="ml-copilot-body">
          <div className="ml-copilot-placeholder">
            <span className="ml-copilot-placeholder-icon"><PanelIcon kind="spark" /></span>
            <h2>{fi ? "Älykkäämpi työskentely alkaa tästä." : "A smarter workflow starts here."}</h2>
            <p>{fi
              ? "Uuden Copilotin keskustelu, työvaiheet ja tietotyökalut rakennetaan seuraavissa vaiheissa."
              : "The conversation, live progress and data tools will be built in later phases."}</p>
          </div>
        </div>
        <footer className="ml-copilot-footer">
          <div className="ml-copilot-unavailable">
            <span>{fi ? "Keskustelu ei ole vielä käytössä" : "Conversation is not yet available"}</span>
            <span className="ml-copilot-unavailable-mark" aria-hidden="true"><PanelIcon kind="spark" /></span>
          </div>
          <p>{fi ? "Phase 2 · käyttöliittymän rakenne" : "Phase 2 · layout preview"}</p>
        </footer>
      </aside>
      {support}
      {mobileNavigation}
    </div>
  );
}
