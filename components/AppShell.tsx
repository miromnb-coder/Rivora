"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { signOut } from "@/app/app/actions";
import { LocaleSwitcher } from "@/components/LocaleSwitcher";
import { getDictionary } from "@/lib/i18n";
import type { Locale } from "@/lib/locale";
import { AppNav, type NavItem } from "@/components/AppNav";
import { AppLocation } from "@/components/AppLocation";
import { SupportCenter } from "@/components/support/SupportCenter";
import { RivoraMark } from "@/components/marketing/RivoraMark";
import { useWorkspaceLayout, usePanelPresence } from "@/components/workspace/useWorkspaceLayout";
import { useModal } from "@/components/workspace/useModal";
import { SalesCopilot } from "@/components/copilot/SalesCopilot";

function CopilotGlyph() {
  return <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m12 3 1.5 5.5L19 10l-5.5 1.5L12 17l-1.5-5.5L5 10l5.5-1.5ZM19 17l.6 1.4L21 19l-1.4.6L19 21l-.6-1.4L17 19l1.4-.6Z" /></svg>;
}

export function AppShell({
  children,
  workspaceId,
  workspaceName,
  workspaceRole,
  userEmail,
  locale,
  leadsEnabled,
  supportOperator,
  supportRecordEnabled,
  initialSidebarCollapsed,
}: {
  children: React.ReactNode;
  workspaceId: string;
  workspaceName: string;
  workspaceRole: string;
  userEmail?: string;
  locale: Locale;
  leadsEnabled: boolean;
  supportOperator: boolean;
  supportRecordEnabled: boolean;
  initialSidebarCollapsed: boolean;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const mainRef = useRef<HTMLElement>(null);
  const { width, mode, rail } = useWorkspaceLayout(rootRef);
  const pathname = usePathname();
  const initialized = useRef(false);
  const [collapsed, setCollapsed] = useState(initialSidebarCollapsed);
  const [copilotOpen, setCopilotOpen] = useState(false);
  useEffect(() => {
    if (width === null || initialized.current) return;
    initialized.current = true;
    if (mode === "desktop") setCopilotOpen(true);
  }, [width, mode]);
  const { phase, present } = usePanelPresence(copilotOpen);
  const [accountOpen, setAccountOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [shortcutLabel, setShortcutLabel] = useState("⌘K");
  const searchRef = useRef<HTMLInputElement>(null);
  const searchContainerRef = useRef<HTMLDivElement>(null);
  const mobileMenuButtonRef = useRef<HTMLButtonElement>(null);
  const mobileCloseRef = useRef<HTMLButtonElement>(null);
  const sidebarRef = useRef<HTMLElement>(null);
  const router = useRouter();
  const accountRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const shortcut = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        const mode = rootRef.current?.dataset.shellMode;
        if (mode !== "desktop") setCopilotOpen(false);
        if (mode === "mobile" || mode === "tablet") setMobileMenuOpen(true);
        setSearchOpen(true);
      }
    };
    document.addEventListener("keydown", shortcut);
    return () => document.removeEventListener("keydown", shortcut);
  }, []);
  useEffect(() => { if (searchOpen) searchRef.current?.focus(); }, [searchOpen]);
  useEffect(() => {
    if (!searchOpen) return;
    const dismiss = (event: PointerEvent) => { if (!searchContainerRef.current?.contains(event.target as Node)) setSearchOpen(false); };
    document.addEventListener("pointerdown", dismiss);
    return () => document.removeEventListener("pointerdown", dismiss);
  }, [searchOpen]);
  useEffect(() => { if (!/Mac|iPhone|iPad/.test(navigator.platform)) setShortcutLabel("Ctrl K"); }, []);
  const drawerActive = mobileMenuOpen && (mode === "mobile" || mode === "tablet");
  useModal({ active: drawerActive, panel: sidebarRef, initialFocus: searchOpen ? searchRef : mobileCloseRef,
    onClose: () => { setMobileMenuOpen(false); setSearchOpen(false); },
    returnFocus: () => Array.from(document.querySelectorAll<HTMLButtonElement>(".app-mobile-menu-button,.app-tablet-menu-button")).find(button => button.getClientRects().length) ?? mainRef.current });
  useEffect(() => {
    if (mode === "desktop" || mode === "overlay") { setMobileMenuOpen(false); setSearchOpen(false); }
  }, [mode]);
  const previousPath = useRef(pathname);
  useEffect(() => {
    if (previousPath.current !== pathname) {
      previousPath.current = pathname;
      setMobileMenuOpen(false); setSearchOpen(false); setAccountOpen(false);
      if (mode !== "desktop") setCopilotOpen(false);
      const frame = requestAnimationFrame(() => mainRef.current?.focus({ preventScroll: true }));
      return () => cancelAnimationFrame(frame);
    }
  }, [pathname, mode]);
  useEffect(() => {
    if (!accountOpen) return;
    const dismiss = (event: PointerEvent) => {
      if (!accountRef.current?.contains(event.target as Node)) setAccountOpen(false);
    };
    document.addEventListener("pointerdown", dismiss);
    return () => document.removeEventListener("pointerdown", dismiss);
  }, [accountOpen]);
  useEffect(() => {
    try {
      const saved = localStorage.getItem("averomira-sidebar-collapsed");
      if (saved !== null && (saved === "1") !== initialSidebarCollapsed) {
        setCollapsed(saved === "1");
        document.cookie = `averomira-sidebar-collapsed=${saved === "1" ? "1" : "0"}; path=/app; max-age=31536000; SameSite=Lax`;
      }
    } catch { /* Storage can be disabled; the cookie still preserves the choice. */ }
  }, [initialSidebarCollapsed]);
  function toggleSidebar() {
    const next = !collapsed;
    setCollapsed(next);
    document.cookie = `averomira-sidebar-collapsed=${next ? "1" : "0"}; path=/app; max-age=31536000; SameSite=Lax`;
    try { localStorage.setItem("averomira-sidebar-collapsed", next ? "1" : "0"); } catch { /* Cookie remains available. */ }
  }
  const closeCopilot = useCallback(() => {
    const restoreDesktopFocus = rootRef.current?.dataset.shellMode === "desktop" && document.querySelector("#sales-copilot")?.contains(document.activeElement);
    setCopilotOpen(false);
    if (restoreDesktopFocus) requestAnimationFrame(() => {
      Array.from(document.querySelectorAll<HTMLButtonElement>(".app-copilot-trigger")).find(button => button.getClientRects().length)?.focus({ preventScroll: true });
    });
  }, []);
  function toggleCopilot() {
    setMobileMenuOpen(false); setSearchOpen(false); setAccountOpen(false);
    setCopilotOpen(value => !value);
  }
  const copy = getDictionary(locale).nav;
  const nav: NavItem[] = [
    [locale === "fi" ? "Yleiskatsaus" : "Overview", "/app", "dashboard", "main"],
    [copy.orders, "/app/orders", "orders", "main"],
    [locale === "fi" ? "Tarjouspyynnöt" : "RFQs", "/app/inbox", "rfq", "main"],
    [copy.products, "/app/products", "products", "main"],
    [copy.customers, "/app/customers", "customers", "main"],
    ...(leadsEnabled ? [[copy.leads, "/app/leads", "leads", "main"] as const] : []),
    [locale === "fi" ? "Tarkistukset" : "Reviews", "/app/orders?view=attention", "reviews", "process"],
    [locale === "fi" ? "ERP-siirrot" : "ERP transfers", "/app/orders?view=erp", "erp", "process"],
    [locale === "fi" ? "Tehtävät" : "Tasks", "/app#dashboard-tasks-heading", "tasks", "process"],
    ...(["owner", "admin"].includes(workspaceRole) ? [[locale === "fi" ? "Tiimi" : "Team", "/app/settings#users", "team", "manage"] as const] : []),
    [copy.settings, "/app/settings", "settings", "manage"],
  ];
  const searchItems = [...nav, [locale === "fi" ? "Uusi tarjouspyyntö" : "New RFQ", "/app/upload", "upload", "action"] as const,
    [locale === "fi" ? "Tarjoukset" : "Quotes", "/app/quotes", "quotes", "action"] as const,
    [locale === "fi" ? "Ostotilaukset" : "Purchase orders", "/app/purchase-orders", "purchase", "action"] as const,
    [locale === "fi" ? "Myyntitilaukset" : "Sales orders", "/app/sales-orders", "sales", "action"] as const];
  const results = searchItems.filter(([label]) => label.toLocaleLowerCase(locale).includes(query.trim().toLocaleLowerCase(locale)));
  function navigate(href: string) { setSearchOpen(false); setMobileMenuOpen(false); setQuery(""); router.push(href); window.dispatchEvent(new CustomEvent("averomira:workspace-navigation", { detail: { href } })); }

  return (
    <div ref={rootRef} data-shell-mode={mode} data-shell-width={width === null ? undefined : Math.round(width)}
      style={{ "--workspace-rail": rail } as React.CSSProperties}
      className={`app-shell-v2${collapsed ? " is-sidebar-collapsed" : ""}${present ? " is-copilot-open" : ""}`}>

      {drawerActive ? <button type="button" className="app-mobile-menu-backdrop" data-modal-backdrop="workspace-navigation" tabIndex={-1} aria-label={locale === "fi" ? "Sulje valikko" : "Close menu"} onClick={() => { setMobileMenuOpen(false); setSearchOpen(false); }} /> : null}
      <aside id="workspace-navigation" tabIndex={-1} ref={sidebarRef} role={drawerActive ? "dialog" : undefined} aria-modal={drawerActive ? true : undefined} aria-label={drawerActive ? (locale === "fi" ? "Työtilan valikko" : "Workspace menu") : undefined} className={`app-sidebar-v2${drawerActive ? " is-mobile-open" : ""}`}>
        <div className="app-sidebar-v2-top">
          <button ref={mobileCloseRef} type="button" className="app-mobile-menu-close" aria-label={locale === "fi" ? "Sulje valikko" : "Close menu"} onClick={() => { setMobileMenuOpen(false); setSearchOpen(false); }}>×</button>
          <Link href="/app" className="app-sidebar-v2-brand" aria-label="Averomira">
            <RivoraMark withSymbol />
          </Link>
          <div className="app-sidebar-v2-product">{locale === "fi" ? "Yrityksen työtila" : "Company workspace"}</div>
        </div>
        <div className="app-workspace-search" ref={searchContainerRef}>
          <button type="button" className="app-search-trigger" aria-label={locale === "fi" ? "Hae työtilasta" : "Search workspace"} aria-expanded={searchOpen} onClick={() => setSearchOpen(true)}>
            <svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true"><circle cx="10.8" cy="10.8" r="6.5" /><path d="m16 16 4 4" /></svg>
            <span>{locale === "fi" ? "Hae työtilasta..." : "Search workspace..."}</span><kbd>{shortcutLabel}</kbd>
          </button>
          {searchOpen ? <div className="app-search-popover" onKeyDown={event => { if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); setSearchOpen(false); searchContainerRef.current?.querySelector("button")?.focus(); } }}>
            <label className="sr-only" htmlFor="app-workspace-search-input">{locale === "fi" ? "Hae sivuja ja toimintoja" : "Search pages and actions"}</label>
            <input id="app-workspace-search-input" ref={searchRef} value={query} onChange={event => setQuery(event.target.value)} onKeyDown={event => { if (event.key === "Enter" && query.trim() && results[0]) navigate(results[0][1]); }} placeholder={locale === "fi" ? "Hae sivuja ja toimintoja" : "Search pages and actions"} />
            <div className="app-search-results">{results.length ? results.map(([label, href, id]) => <button key={id} type="button" onClick={() => navigate(href)}>{label}</button>) : <p>{locale === "fi" ? "Ei tuloksia" : "No results"}</p>}</div>
          </div> : null}
        </div>
        <div className="app-nav-scroll" onClick={() => { if (mobileMenuOpen) { setMobileMenuOpen(false); setSearchOpen(false); } }}><AppNav items={nav} locale={locale} collapsed={collapsed && !mobileMenuOpen} /></div>
        <div className={`app-sidebar-v2-account${collapsed ? " is-collapsed" : ""}`} ref={accountRef}>
              <button type="button" className="app-sidebar-account-trigger"
                aria-label={locale === "fi" ? "Työtili ja tiliasetukset" : "Workspace and account"}
                aria-expanded={accountOpen} aria-controls="app-sidebar-account-menu"
                title={locale === "fi" ? "Työtili" : "Workspace"}
                onClick={() => setAccountOpen(value => !value)}>
                <span className="app-account-avatar" aria-hidden="true">{workspaceName.trim().charAt(0).toLocaleUpperCase(locale) || "A"}</span>
                <span className="app-account-summary"><strong>{workspaceName}</strong><small>{workspaceRole}</small></span>
                <svg className="app-account-chevron" viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true"><path d="m7 10 5 5 5-5" /></svg>
              </button>
              {accountOpen ? (
                <div className="app-sidebar-account-menu" id="app-sidebar-account-menu" onKeyDown={event => { if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); setAccountOpen(false); accountRef.current?.querySelector("button")?.focus(); } }}>
                  <div className="app-sidebar-v2-account-label">{copy.workspace}</div>
                  <div className="app-sidebar-v2-account-name">{workspaceName}</div>
                  <div className="app-sidebar-v2-role">{workspaceRole}</div>
                  {userEmail ? <div className="app-sidebar-v2-email">{userEmail}</div> : null}
                  <Link href="/app/settings" onClick={() => { setAccountOpen(false); setMobileMenuOpen(false); }}>{copy.settings}</Link>
                  <LocaleSwitcher locale={locale} label={copy.language} />
                  <form action={signOut}><button className="app-sidebar-v2-signout">{copy.signOut}</button></form>
                </div>
              ) : null}
        </div>
      </aside>

      <header className="app-mobile-topbar">
        <button ref={mobileMenuButtonRef} type="button" className="app-mobile-menu-button" aria-label={locale === "fi" ? "Avaa valikko" : "Open menu"} aria-expanded={mobileMenuOpen} aria-controls="workspace-navigation" onClick={() => { setCopilotOpen(false); setMobileMenuOpen(true); }}><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16" /></svg></button>
        <Link href="/app" className="app-mobile-brand" aria-label="Averomira">
          <RivoraMark withSymbol />
        </Link>
        <button type="button" className="app-mobile-search-button" aria-label={locale === "fi" ? "Hae työtilasta" : "Search workspace"} onClick={() => { setCopilotOpen(false); setMobileMenuOpen(true); setSearchOpen(true); }}>⌕</button>
        <button type="button" className="app-copilot-trigger" aria-controls="sales-copilot" aria-expanded={copilotOpen} onClick={toggleCopilot}>
          <span className="app-copilot-icon"><CopilotGlyph /></span><span>AI Copilot</span>
        </button>
      </header>

      <main ref={mainRef} tabIndex={-1} className="app-main-v2">
        <div className="app-workspace-toolbar">
          <button type="button" className="app-tablet-menu-button" aria-controls="workspace-navigation" aria-expanded={drawerActive} aria-label={locale === "fi" ? "Avaa valikko" : "Open menu"} onClick={() => { setCopilotOpen(false); setMobileMenuOpen(true); }}>☰</button>
          <button type="button" className="app-sidebar-toggle"
            aria-label={collapsed ? (locale === "fi" ? "Laajenna valikko" : "Expand sidebar") : (locale === "fi" ? "Pienennä valikko" : "Collapse sidebar")}
            aria-expanded={!collapsed}
            title={collapsed ? (locale === "fi" ? "Laajenna valikko" : "Expand sidebar") : (locale === "fi" ? "Pienennä valikko" : "Collapse sidebar")}
            onClick={toggleSidebar}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"
              strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <rect x="3.5" y="4.5" width="17" height="15" rx="2.4" /><path d="M9.5 4.5v15" />
              {!collapsed ? <path d="m15 10-2 2 2 2" /> : <path d="m13 10 2 2-2 2" />}
            </svg>
          </button>
          <div className="app-workspace-toolbar-context"><AppLocation locale={locale} /></div>
          <button type="button" className="app-copilot-trigger" aria-controls="sales-copilot"
            aria-expanded={copilotOpen} onClick={toggleCopilot}>
            <span className="app-copilot-icon"><CopilotGlyph /></span><span>AI Copilot</span>
          </button>
        </div>
        <div className="app-content-v2">{children}</div>
      </main>
      <SalesCopilot open={copilotOpen} present={present} phase={phase} mode={mode} onClose={closeCopilot} locale={locale} workspaceId={workspaceId} />

      <SupportCenter locale={locale} recordContextAvailable={supportRecordEnabled} />


    </div>
  );
}
