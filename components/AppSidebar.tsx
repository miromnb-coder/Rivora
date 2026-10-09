import Link from "next/link";
import type { Locale } from "@/lib/locale";

/** Desktop presentation only. AppNav remains the sole navigation owner. */
export function AppSidebar({ children, productLabel, workspaceLabel, workspaceName, workspaceRole, locale }: {
  children: React.ReactNode;
  productLabel: string;
  workspaceLabel: string;
  workspaceName: string;
  workspaceRole: string;
  locale: Locale;
}) {
  return (
    <aside className="app-sidebar-v2" aria-label={locale === "fi" ? "Työtilan sivupalkki" : "Workspace sidebar"}>
      <div className="app-sidebar-v2-top">
        <Link href="/app" className="app-sidebar-v2-brand nodra-wordmark" aria-label="Averomira">Averomira</Link>
        <div className="app-sidebar-v2-product">{productLabel}</div>
      </div>
      {children}
      <div className="app-sidebar-v2-account">
        <div className="app-sidebar-v2-account-label">{workspaceLabel}</div>
        <div className="app-sidebar-v2-account-name">{workspaceName}</div>
        <div className="app-sidebar-v2-role">{workspaceRole}</div>
      </div>
    </aside>
  );
}
