import { redirect } from "next/navigation";
import { requireWorkspace } from "@/lib/rivora/workspace";
import { canManageWorkspaceFeature } from "@/lib/rivora/features";

export async function requireSalesAdmin() {
  const context = await requireWorkspace();
  if (!(await canManageWorkspaceFeature(context, "leads"))) {
    redirect("/app");
  }
  return context;
}
