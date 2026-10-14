"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { signOut } from "@/app/app/actions";
import { LocaleSwitcher } from "@/components/LocaleSwitcher";
import { getDictionary } from "@/lib/i18n";
import type { Locale } from "@/lib/locale";
import { AppNav } from "@/components/AppNav";
import { AppLocation } from "@/components/AppLocation";
import { SupportCenter } from "@/components/support/SupportCenter";
import { RivoraMark } from "@/components/marketing/RivoraMark";
import { SalesCopilot } from "@/components/copilot/SalesCopilot";

export function AppShell({
  children,
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
  workspaceName: string;
  workspaceRole: string;
  userEmail?: string;
  locale: Locale;
  leadsEnabled: boolean;
  supportOperator: boolean;
  supportRecordEnabled: boolean;
  initialSidebarCollapsed: boolean;
}) {
  const [collapsed, setCollapsed] = useState(initialSidebarCollapsed);
  const [copilotOpen, setCopilotOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const accountRef = useRef<HTMLDivElement>(null);
  useEffect(() => { if (!collapsed) setAccountOpen(false); }, [collapsed]);
  useEffect(() => {
    if (!accountOpen) return;
    const dismiss = (event: PointerEvent) => {
      if (!accountRef.current?.contains(event.target as Node)) setAccountOpen(false);
    };
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape") setAccountOpen(false); };
    document.addEventListener("pointerdown", dismiss);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", dismiss);
      document.removeEventListener("keydown", escape);
    };
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
    setCopilotOpen(false);
    requestAnimationFrame(() => {
      const triggers = document.querySelectorAll<HTMLButtonElement>(".app-copilot-trigger");
      Array.from(triggers).find((button) => button.getClientRects().length > 0)?.focus();
    });
  }, []);
  const copy = getDictionary(locale).nav;
  const nav: Array<readonly [string, string, string]> = [
    [copy.dashboard, "/app", "dashboard"],
    ...(leadsEnabled
      ? ([[copy.leads, "/app/leads", "leads"]] as Array<readonly [string, string, string]>)
      : []),
    [copy.orders, "/app/orders", "orders"],
    [copy.customers, "/app/customers", "customers"],
    [copy.products, "/app/products", "products"],
    [copy.settings, "/app/settings", "settings"],
  ];

  return (
    <div className={`app-shell-v2 min-h-screen${collapsed ? " is-sidebar-collapsed" : ""}${copilotOpen ? " is-copilot-open" : ""}`}>
      <aside className="app-sidebar-v2">
        <div className="app-sidebar-v2-top">
          <Link href="/app" className="app-sidebar-v2-brand" aria-label="Averomira">
            <RivoraMark withSymbol />
          </Link>
          <div className="app-sidebar-v2-product">{copy.product}</div>
        </div>

        <AppNav items={nav} locale={locale} collapsed={collapsed} />
        <div className={`app-sidebar-v2-account${collapsed ? " is-collapsed" : ""}`} ref={accountRef}>
          {collapsed ? (
            <>
              <button type="button" className="app-sidebar-account-trigger"
                aria-label={locale === "fi" ? "Työtili ja tiliasetukset" : "Workspace and account"}
                aria-expanded={accountOpen} aria-controls="app-sidebar-account-menu"
                title={locale === "fi" ? "Työtili" : "Workspace"}
                onClick={() => setAccountOpen(value => !value)}>
                <svg viewBox="0 0 24 24" width="20" height="20" fill="none"
                  stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" aria-hidden="true">
                  <circle cx="12" cy="8" r="3" /><path d="M5.5 20c.6-4 2.9-6 6.5-6s5.9 2 6.5 6" />
                </svg>
              </button>
              {accountOpen ? (
                <div className="app-sidebar-account-menu" id="app-sidebar-account-menu">
                  <div className="app-sidebar-v2-account-label">{copy.workspace}</div>
                  <div className="app-sidebar-v2-account-name">{workspaceName}</div>
                  <div className="app-sidebar-v2-role">{workspaceRole}</div>
                  {userEmail ? <div className="app-sidebar-v2-email">{userEmail}</div> : null}
                  <LocaleSwitcher locale={locale} label={copy.language} />
                  <form action={signOut}><button className="app-sidebar-v2-signout">{copy.signOut}</button></form>
                </div>
              ) : null}
            </>
          ) : (
            <>
              <LocaleSwitcher locale={locale} label={copy.language} />
              <div className="app-sidebar-v2-account-label">{copy.workspace}</div>
              <div className="app-sidebar-v2-account-name">{workspaceName}</div>
              <div className="app-sidebar-v2-role">{workspaceRole}</div>
              {userEmail ? <div className="app-sidebar-v2-email">{userEmail}</div> : null}
              <form action={signOut}><button className="app-sidebar-v2-signout">{copy.signOut}</button></form>
            </>
          )}
        </div>
      </aside>

      <header className="app-mobile-topbar">
        <Link href="/app" className="app-mobile-brand" aria-label="Averomira">
          <RivoraMark withSymbol />
        </Link>
        <button type="button" className="app-copilot-trigger" aria-controls="sales-copilot" aria-expanded={copilotOpen} onClick={() => copilotOpen ? closeCopilot() : setCopilotOpen(true)}>
          <span className="app-copilot-icon" aria-hidden="true">✧</span><span>AI Copilot</span>
        </button>
      </header>

      <main className="app-main-v2">
        <div className="app-workspace-toolbar">
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
            aria-expanded={copilotOpen} onClick={() => copilotOpen ? closeCopilot() : setCopilotOpen(true)}>
            <span className="app-copilot-icon" aria-hidden="true">✧</span><span>AI Copilot</span>
          </button>
        </div>
        {children}
      </main>
      <SalesCopilot open={copilotOpen} onClose={closeCopilot} locale={locale} />

      <SupportCenter locale={locale} recordContextAvailable={supportRecordEnabled} />

      <div className="app-mobile-bottom-nav">
        <AppNav items={nav} compact locale={locale} />
      </div>
    </div>
  );
}
