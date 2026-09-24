"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function createWorkspace(formData: FormData) {
  const workspaceName = String(formData.get("workspaceName") ?? "").trim();
  if (!workspaceName) redirect("/onboarding?error=Workspace%20name%20is%20required");

  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  if (!claimsData?.claims?.sub) redirect("/login");

  const { error } = await supabase.rpc("bootstrap_rivora_workspace", {
    workspace_name: workspaceName,
  });

  if (error) {
    redirect(`/onboarding?error=${encodeURIComponent(error.message)}`);
  }

  redirect("/app/upload");
}
