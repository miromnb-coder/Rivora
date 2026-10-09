import Link from "next/link";
import { signOut } from "@/app/app/actions";
import { LocaleSwitcher } from "@/components/LocaleSwitcher";
import { getDictionary } from "@/lib/i18n";
import type { Locale } from "@/lib/locale";
import { AppNav } from "@/components/AppNav";
import { AppLocation } from "@/components/AppLocation";
import { SupportCenter } from "@/components/support/SupportCenter";
import { RivoraMark } from "@/components/marketing/RivoraMark";

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

  return (
    <div className="app-shell-v2 min-h-screen">
      <aside className="app-sidebar-v2">
        <div className="app-sidebar-v2-top">
          <Link href="/app" className="app-sidebar-v2-brand" aria-label="Averomira">
            <RivoraMark withSymbol />
          </Link>
          <div className="app-sidebar-v2-product">{copy.product}</div>
        </div>

        <AppNav items={nav} locale={locale} />

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
      </header>

      <main className="app-main-v2"><AppLocation locale={locale} />{children}</main>

      <SupportCenter locale={locale} />

      <div className="app-mobile-bottom-nav">
        <AppNav items={nav} compact locale={locale} />
      </div>
    </div>
  );
}
