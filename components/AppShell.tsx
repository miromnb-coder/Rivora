"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
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
          <button type="button" className="app-sidebar-toggle" onClick={toggleSidebar}
            aria-label={collapsed ? (locale === "fi" ? "Laajenna valikko" : "Expand sidebar") : (locale === "fi" ? "Pienennä valikko" : "Collapse sidebar")}
            aria-expanded={!collapsed} title={collapsed ? (locale === "fi" ? "Laajenna valikko" : "Expand sidebar") : (locale === "fi" ? "Pienennä valikko" : "Collapse sidebar")}>
            <span aria-hidden="true">{collapsed ? "›" : "‹"}</span>
          </button>
        </div>

        <AppNav items={nav} locale={locale} collapsed={collapsed} />

        <div className="app-sidebar-v2-account">
          <LocaleSwitcher locale={locale} label={copy.language} />
          <div className="app-sidebar-v2-account-label">{copy.workspace}</div>
          <div className="app-sidebar-v2-account-name">{workspaceName}</div>
          <div className="app-sidebar-v2-role">{workspaceRole}</div>
          {userEmail ? <div className="app-sidebar-v2-email">{userEmail}</div> : null}

          <form action={signOut}>
            <button className="app-sidebar-v2-signout">{copy.signOut}</button>
          </form>
        </div>
      </aside>

      <header className="app-mobile-topbar">
        <Link href="/app" className="app-mobile-brand" aria-label="Averomira">
          <RivoraMark withSymbol />
        </Link>
        <span>{workspaceName}</span>
        <button type="button" className="app-copilot-trigger" aria-controls="sales-copilot" aria-expanded={copilotOpen} onClick={() => setCopilotOpen(true)}>
          <span aria-hidden="true">✧</span><span>AI Copilot</span>
        </button>
      </header>

      <main className="app-main-v2">
        <div className="app-workspace-toolbar">
          <button type="button" className="app-copilot-trigger" aria-controls="sales-copilot" aria-expanded={copilotOpen} onClick={() => setCopilotOpen(true)}>
            <span aria-hidden="true">✧</span><span>AI Copilot</span>
          </button>
        </div>
        <AppLocation locale={locale} />{children}
      </main>
      <SalesCopilot open={copilotOpen} onClose={closeCopilot} locale={locale} />

      <SupportCenter locale={locale} recordContextAvailable={supportRecordEnabled} />

      <div className="app-mobile-bottom-nav">
        <AppNav items={nav} compact locale={locale} />
      </div>
    </div>
  );
}
