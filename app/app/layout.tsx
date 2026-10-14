import type { Metadata } from "next";
import { AppShell } from "@/components/AppShell";
import "./navigation.css";
import "./support-s5.css";
import "./field-focus.css";
import { requireWorkspace } from "@/lib/rivora/workspace";
import { getLocale } from "@/lib/locale";
import { canManageWorkspaceFeature } from "@/lib/rivora/features";
import { isSupportOperatorEmail } from "@/lib/rivora/support-operator";
import { cookies } from "next/headers";

export const metadata: Metadata = {
  robots: {
    index: false,
    follow: false,
    googleBot: {
      index: false,
      follow: false,
    },
  },
};

export const dynamic = "force-dynamic";

export default async function ProductLayout({ children }: { children: React.ReactNode }) {
  const [context, locale] = await Promise.all([
    requireWorkspace(),
    getLocale(),
  ]);
  const { claims, workspace } = context;
  const leadsEnabled = await canManageWorkspaceFeature(context, "leads");
  const supportOperator = isSupportOperatorEmail(
    typeof claims.email === "string" ? claims.email : null,
  );
  const sidebarCollapsed = (await cookies()).get("averomira-sidebar-collapsed")?.value === "1";

  return (
    <div>
      <AppShell
        workspaceName={workspace.name}
        workspaceRole={workspace.role}
        userEmail={typeof claims.email === "string" ? claims.email : undefined}
        locale={locale}
        leadsEnabled={leadsEnabled}
        supportOperator={supportOperator}
        supportRecordEnabled={process.env.AVEROMIRA_SUPPORT_RECORD_CONTEXT_ENABLED === "true"}
        initialSidebarCollapsed={sidebarCollapsed}
      >
        {children}
      </AppShell>
    </div>
  );
}
