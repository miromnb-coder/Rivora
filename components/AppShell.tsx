import { getDictionary } from "@/lib/i18n";
import type { Locale } from "@/lib/locale";
import { AppNav } from "@/components/AppNav";
import { AppSidebar } from "@/components/AppSidebar";
import { AppHeader } from "@/components/AppHeader";
import { SupportCenter } from "@/components/support/SupportCenter";

export function AppShell({
  children,
  workspaceName,
  workspaceRole,
  userEmail,
  locale,
  leadsEnabled,
  supportOperator,
}: {
  children: React.ReactNode;
  workspaceName: string;
  workspaceRole: string;
  userEmail?: string;
  locale: Locale;
  leadsEnabled: boolean;
  supportOperator: boolean;
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
    ...(supportOperator
      ? ([[locale === "fi" ? "Tukipyynnöt" : "Support inbox", "/app/settings/support"]] as Array<readonly [string, string]>)
      : []),
  ];

  return (
    <div className="app-shell-v2 atelier-app min-h-screen">
      <a className="atelier-skip-link" href="#app-main-content">
        {locale === "fi" ? "Siirry sisältöön" : "Skip to content"}
      </a>
      <AppSidebar
        productLabel={copy.product}
        workspaceLabel={copy.workspace}
        workspaceName={workspaceName}
        workspaceRole={workspaceRole}
        locale={locale}
      >
        <AppNav items={nav} orderSubItems={orderSubItems} settingsSubItems={settingsSubItems} locale={locale} />
      </AppSidebar>
      <AppHeader
        workspaceName={workspaceName}
        workspaceLabel={copy.workspace}
        userEmail={userEmail}
        locale={locale}
        languageLabel={copy.language}
        signOutLabel={copy.signOut}
      />

      <main id="app-main-content" className="app-main-v2" tabIndex={-1}>{children}</main>

      <SupportCenter locale={locale} />

      <div className="app-mobile-bottom-nav">
        <AppNav items={nav} orderSubItems={[]} settingsSubItems={[]} compact locale={locale} />
      </div>
    </div>
  );
}
