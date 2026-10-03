import { Inter } from "next/font/google";
import { AppShell } from "@/components/AppShell";
import { requireWorkspace } from "@/lib/rivora/workspace";
import { getLocale } from "@/lib/locale";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-app-inter",
});

export const dynamic = "force-dynamic";

export default async function ProductLayout({ children }: { children: React.ReactNode }) {
  const [{ claims, workspace }, locale] = await Promise.all([
    requireWorkspace(),
    getLocale(),
  ]);

  return (
    <div className={inter.variable}>
      <AppShell
        workspaceName={workspace.name}
        workspaceRole={workspace.role}
        userEmail={typeof claims.email === "string" ? claims.email : undefined}
        locale={locale}
      >
        {children}
      </AppShell>
    </div>
  );
}
