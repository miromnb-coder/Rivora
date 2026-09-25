import { AppShell } from "@/components/AppShell";
import { requireWorkspace } from "@/lib/rivora/workspace";

export const dynamic = "force-dynamic";

export default async function ProductLayout({ children }: { children: React.ReactNode }) {
  const { claims, workspace, supabase } = await requireWorkspace();
  const showSales = workspace.role === "owner" || workspace.role === "admin";
  let leadAlertCount = 0;

  if (showSales) {
    const today = new Date().toISOString().slice(0, 10);
    const { data: leadAlerts } = await supabase
      .from("marketing_leads")
      .select("id, notification_read_at, follow_up_on, status")
      .limit(500);

    const alertIds = new Set(
      (leadAlerts ?? [])
        .filter(
          (lead) =>
            !lead.notification_read_at ||
            (lead.status !== "closed" &&
              typeof lead.follow_up_on === "string" &&
              lead.follow_up_on <= today)
        )
        .map((lead) => lead.id)
    );

    leadAlertCount = alertIds.size;
  }

  return (
    <AppShell
      workspaceName={workspace.name}
      workspaceRole={workspace.role}
      userEmail={typeof claims.email === "string" ? claims.email : undefined}
      leadAlertCount={leadAlertCount}
    >
      {children}
    </AppShell>
  );
}
