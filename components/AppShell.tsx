import Link from "next/link";
import { signOut } from "@/app/app/actions";

export function AppShell({
  children,
  workspaceName,
  workspaceRole,
  userEmail,
  leadAlertCount = 0,
}: {
  children: React.ReactNode;
  workspaceName: string;
  workspaceRole: string;
  userEmail?: string;
  leadAlertCount?: number;
}) {
  const showSales = workspaceRole === "owner" || workspaceRole === "admin";
  const nav = [
    ["Inbox", "/app/inbox"],
    ["Quotes", "/app/quotes"],
    ...(showSales ? [["Leads", "/app/leads"]] : []),
    ["Process RFQ", "/app/upload"],
    ["Products", "/app/products"],
    ["Customer memory", "/app/memory"],
    ["Settings", "/app/settings"],
  ] as const;

  return (
    <div className="app-shell-v2 min-h-screen">
      <aside className="app-sidebar-v2">
        <div className="app-sidebar-v2-top">
          <Link href="/app/inbox" className="app-sidebar-v2-brand">
            Nodra
          </Link>
          <div className="app-sidebar-v2-product">RFQ intelligence desk</div>
        </div>

        <nav className="app-sidebar-v2-nav" aria-label="Application navigation">
          {nav.map(([label, href]) => (
            <Link key={href} href={href} className="app-sidebar-v2-link">
              <span>{label}</span>
              {label === "Leads" && leadAlertCount > 0 ? (
                <span className="app-sidebar-v2-badge">
                  {leadAlertCount > 99 ? "99+" : leadAlertCount}
                </span>
              ) : null}
            </Link>
          ))}
        </nav>

        <div className="app-sidebar-v2-account">
          <div className="app-sidebar-v2-account-label">Workspace</div>
          <div className="app-sidebar-v2-account-name">{workspaceName}</div>
          <div className="app-sidebar-v2-role">{workspaceRole}</div>
          {userEmail ? <div className="app-sidebar-v2-email">{userEmail}</div> : null}

          <form action={signOut}>
            <button className="app-sidebar-v2-signout">Sign out</button>
          </form>
        </div>
      </aside>

      <main className="app-main-v2">{children}</main>
    </div>
  );
}
