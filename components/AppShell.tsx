import Link from "next/link";
import { signOut } from "@/app/app/actions";
import { LocaleSwitcher } from "@/components/LocaleSwitcher";
import { getDictionary } from "@/lib/i18n";
import type { Locale } from "@/lib/locale";
import { AppNav } from "@/components/AppNav";
import { SupportCenter } from "@/components/support/SupportCenter";

export function AppShell({
  children,
  workspaceName,
  workspaceRole,
  userEmail,
  locale,
  leadsEnabled,
}: {
  children: React.ReactNode;
  workspaceName: string;
  workspaceRole: string;
  userEmail?: string;
  locale: Locale;
  leadsEnabled: boolean;
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

  const orderSubItems: Array<readonly [string, string]> = [
    [copy.allOrders, "/app/orders"],
    [copy.attentionOrders, "/app/orders?view=attention"],
    [copy.quoteStage, "/app/orders?view=quote"],
    [copy.purchaseOrders, "/app/orders?view=po"],
    [copy.erpOrders, "/app/orders?view=erp"],
    [copy.completedOrders, "/app/orders?view=done"],
  ];

  const smartMemorySettings = locale === "fi" ? "Älykäs muisti" : "Smart memory";
  const settingsSubItems: Array<readonly [string, string]> = [
    [copy.companySettings, "/app/settings#company"],
    [copy.quoteSettings, "/app/settings#quote-settings"],
    [copy.brandSettings, "/app/settings#brand"],
    [smartMemorySettings, "/app/memory"],
    [copy.businessCentralSettings, "/app/settings#erp"],
    [copy.userSettings, "/app/settings#users"],
    ...(["owner", "admin"].includes(workspaceRole)
      ? ([[copy.operationsSettings, "/app/settings/operations"]] as Array<readonly [string, string]>)
      : []),
  ];

  return (
    <div className="app-shell-v2 min-h-screen">
      <aside className="app-sidebar-v2">
        <div className="app-sidebar-v2-top">
          <Link href="/app" className="app-sidebar-v2-brand nodra-wordmark" aria-label="Averomira">
            Averomira
          </Link>
          <div className="app-sidebar-v2-product">{copy.product}</div>
        </div>

        <AppNav items={nav} orderSubItems={orderSubItems} settingsSubItems={settingsSubItems} />

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
        <Link href="/app" className="app-mobile-brand nodra-wordmark" aria-label="Averomira">
          Averomira
        </Link>
        <span>{workspaceName}</span>
      </header>

      <main className="app-main-v2">{children}</main>

      <SupportCenter locale={locale} />

      <div className="app-mobile-bottom-nav">
        <AppNav items={nav} orderSubItems={[]} settingsSubItems={[]} compact />
      </div>
    </div>
  );
}
