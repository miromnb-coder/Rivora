import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { AppShell } from "@/components/AppShell";
import { requireWorkspace } from "@/lib/rivora/workspace";
import { getLocale } from "@/lib/locale";
import { canManageWorkspaceFeature } from "@/lib/rivora/features";
import { isSupportOperatorEmail } from "@/lib/rivora/support-operator";

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

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-app-inter",
});

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

  return (
    <div className={inter.variable}>
      <AppShell
        workspaceName={workspace.name}
        workspaceRole={workspace.role}
        userEmail={typeof claims.email === "string" ? claims.email : undefined}
        locale={locale}
        leadsEnabled={leadsEnabled}
        supportOperator={supportOperator}
      >
        {children}
      </AppShell>
    </div>
  );
}
