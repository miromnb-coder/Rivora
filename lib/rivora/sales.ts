import { redirect } from "next/navigation";
import { requireWorkspace } from "@/lib/rivora/workspace";

export async function requireSalesAdmin() {
  const context = await requireWorkspace();
  if (!["owner", "admin"].includes(context.workspace.role)) {
    redirect("/app/inbox");
  }
  return context;
}
