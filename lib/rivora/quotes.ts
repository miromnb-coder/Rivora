import { redirect } from "next/navigation";
import { requireWorkspace } from "@/lib/rivora/workspace";

export async function requireQuoteAdmin() {
  const context = await requireWorkspace();

  if (!["owner", "admin"].includes(context.workspace.role)) {
    redirect("/app/quotes");
  }

  return context;
}
