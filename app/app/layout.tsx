import { AppShell } from "@/components/AppShell";
import { requireWorkspace } from "@/lib/rivora/workspace";

export const dynamic = "force-dynamic";

export default async function ProductLayout({ children }: { children: React.ReactNode }) {
  const { claims, workspace } = await requireWorkspace();
  return (
    <AppShell workspaceName={workspace.name} userEmail={typeof claims.email === "string" ? claims.email : undefined}>
      {children}
    </AppShell>
  );
}
