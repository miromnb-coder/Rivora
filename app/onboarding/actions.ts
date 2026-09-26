"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function createWorkspace(formData: FormData) {
  const workspaceName = String(formData.get("workspaceName") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const passwordConfirm = String(formData.get("passwordConfirm") ?? "");

  if (!workspaceName) {
    redirect("/onboarding?error=Workspace%20name%20is%20required");
  }

  if (password.length < 8) {
    redirect("/onboarding?error=Password%20must%20be%20at%20least%208%20characters");
  }

  if (password !== passwordConfirm) {
    redirect("/onboarding?error=Passwords%20do%20not%20match");
  }

  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  if (!claimsData?.claims?.sub) redirect("/login");

  const email = String(claimsData.claims.email ?? "").trim().toLowerCase();
  if (!email) {
    redirect("/onboarding?error=Verified%20email%20is%20required");
  }

  const { data: invite } = await supabase
    .from("pilot_access_invites")
    .select("id")
    .eq("email", email)
    .is("revoked_at", null)
    .maybeSingle();

  if (!invite) {
    redirect("/onboarding?error=An%20approved%20Nodra%20Pilot%20invitation%20is%20required");
  }

  const { error: passwordError } = await supabase.auth.updateUser({ password });
  const passwordAlreadySet =
    passwordError?.message.toLowerCase().includes("different from the old password") ?? false;

  if (passwordError && !passwordAlreadySet) {
    redirect(`/onboarding?error=${encodeURIComponent(passwordError.message)}`);
  }

  const { error } = await supabase.rpc("bootstrap_rivora_workspace", {
    workspace_name: workspaceName,
  });

  if (error) {
    redirect(`/onboarding?error=${encodeURIComponent(error.message)}`);
  }

  redirect("/app/setup");
}
