import Link from "next/link";
import { signOut } from "@/app/app/actions";
import { LocaleSwitcher } from "@/components/LocaleSwitcher";
import { getDictionary } from "@/lib/i18n";
import type { Locale } from "@/lib/locale";

export function AppShell({
  children,
  workspaceName,
  workspaceRole,
  userEmail,
  leadAlertCount = 0,
  locale,
}: {
  children: React.ReactNode;
  workspaceName: string;
  workspaceRole: string;
  userEmail?: string;
  leadAlertCount?: number;
  locale: Locale;
}) {
  const showSales = workspaceRole === "owner" || workspaceRole === "admin";
  const copy = getDictionary(locale).nav;
  const nav = [
    [copy.inbox, "/app/inbox", "inbox"],
    [copy.quotes, "/app/quotes", "quotes"],
    [copy.customers, "/app/customers", "customers"],
    ...(showSales ? [[copy.leads, "/app/leads", "leads"]] : []),
    [copy.processRfq, "/app/upload", "process"],
    [copy.products, "/app/products", "products"],
    [copy.memory, "/app/memory", "memory"],
    [copy.settings, "/app/settings", "settings"],
    [copy.setup, "/app/setup", "setup"],
  ] as const;

  return (
    <div className="app-shell-v2 min-h-screen">
      <aside className="app-sidebar-v2">
        <div className="app-sidebar-v2-top">
          <Link href="/app/inbox" className="app-sidebar-v2-brand">
            Nodra
          </Link>
          <div className="app-sidebar-v2-product">{copy.product}</div>
        </div>

        <nav className="app-sidebar-v2-nav" aria-label="Application navigation">
          {nav.map(([label, href, id]) => (
            <Link key={href} href={href} className="app-sidebar-v2-link">
              <span>{label}</span>
              {id === "leads" && leadAlertCount > 0 ? (
                <span className="app-sidebar-v2-badge">
                  {leadAlertCount > 99 ? "99+" : leadAlertCount}
                </span>
              ) : null}
            </Link>
          ))}
        </nav>

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

      <main className="app-main-v2">{children}</main>
    </div>
  );
}
