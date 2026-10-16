import Link from "next/link";
import { signOut } from "@/app/app/actions";
import { LocaleSwitcher } from "@/components/LocaleSwitcher";
import { getDictionary } from "@/lib/i18n";
import type { Locale } from "@/lib/locale";
import { AppNav } from "@/components/AppNav";
import { AppLocation } from "@/components/AppLocation";
import { SupportCenter } from "@/components/support/SupportCenter";
import { RivoraMark } from "@/components/marketing/RivoraMark";
import { WorkspaceFrame } from "@/components/workspace/WorkspaceFrame";
import { WorkspaceSupportTrigger } from "@/components/workspace/WorkspaceSupportTrigger";

export function AppShell({
  children,
  workspaceName,
  workspaceId,
  workspaceRole,
  userEmail,
  locale,
  leadsEnabled,
  supportOperator,
  supportRecordEnabled,
}: {
  children: React.ReactNode;
  workspaceName: string;
  workspaceId?: string;
  workspaceRole: string;
  userEmail?: string;
  locale: Locale;
  leadsEnabled: boolean;
  supportOperator: boolean;
  supportRecordEnabled: boolean;
}) {
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
    <WorkspaceFrame
      locale={locale}
      workspaceId={workspaceId}
      sidebar={
        <aside className="app-sidebar-v2">
          <div className="app-sidebar-v2-top">
            <Link href="/app" className="app-sidebar-v2-brand" aria-label="Averomira">
              <RivoraMark withSymbol />
            </Link>
            <div className="app-sidebar-v2-product">{copy.product}</div>
          </div>
          <AppNav items={nav} locale={locale} />
          <div className="ml-sidebar-bottom">
            <WorkspaceSupportTrigger locale={locale} />
            <details className="ml-workspace-account-menu">
              <summary aria-label={fiLabel(locale, "Avaa työtilin asetukset", "Open workspace account settings")}>
                <span className="ml-account-avatar" aria-hidden="true">{workspaceName.slice(0, 1).toLocaleUpperCase()}</span>
                <span className="ml-account-text">
                  <strong>{workspaceName}</strong>
                  <small>{workspaceRole}</small>
                </span>
                <span className="ml-account-chevron" aria-hidden="true">⌄</span>
              </summary>
              <div className="ml-workspace-account-details">
                <span className="ml-account-details-title">{copy.workspace}</span>
                {userEmail ? <span className="ml-account-details-email">{userEmail}</span> : null}
                <LocaleSwitcher locale={locale} label={copy.language} />
                <form action={signOut}>
                  <button className="app-sidebar-v2-signout">{copy.signOut}</button>
                </form>
              </div>
            </details>
          </div>
        </aside>
      }
      mobileHeader={
        <header className="app-mobile-topbar">
          <Link href="/app" className="app-mobile-brand" aria-label="Averomira">
            <RivoraMark withSymbol />
          </Link>
          <details className="ml-mobile-account">
            <summary aria-label={fiLabel(locale, "Avaa yritystilivalikko", "Open account menu")}>
              <span className="ml-mobile-account-name">{workspaceName}</span>
              <span aria-hidden="true">⌄</span>
            </summary>
            <div className="ml-mobile-account-menu">
              <span className="ml-mobile-account-role">{workspaceRole}</span>
              {userEmail ? <span className="ml-mobile-account-email">{userEmail}</span> : null}
              <WorkspaceSupportTrigger locale={locale} />
              <LocaleSwitcher locale={locale} label={copy.language} />
              <form action={signOut}>
                <button className="app-sidebar-v2-signout">{copy.signOut}</button>
              </form>
            </div>
          </details>
        </header>
      }
      mobileNavigation={<div className="app-mobile-bottom-nav"><AppNav items={nav} compact locale={locale} /></div>}
      support={<SupportCenter locale={locale} recordContextAvailable={supportRecordEnabled} />}
    >
      <AppLocation locale={locale} />
      {children}
    </WorkspaceFrame>
  );
}

function fiLabel(locale: Locale, fi: string, en: string) {
  return locale === "fi" ? fi : en;
}
