import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function getAuthContext() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  const claims = data?.claims;

  if (error || !claims?.sub) {
    return { supabase, claims: null, workspace: null };
  }

  const { data: membership } = await supabase
    .from("organization_members")
    .select("organization_id, role, organizations(name)")
    .eq("user_id", claims.sub)
    .limit(1)
    .maybeSingle();

  const organization = Array.isArray(membership?.organizations)
    ? membership?.organizations[0]
    : membership?.organizations;

  return {
    supabase,
    claims,
    workspace: membership
      ? {
          id: membership.organization_id as string,
          role: membership.role as string,
          name: (organization as { name?: string } | null)?.name ?? "Rivora workspace",
        }
      : null,
  };
}

export async function requireWorkspace() {
  const context = await getAuthContext();
  if (!context.claims) redirect("/login");
  if (!context.workspace) redirect("/onboarding");
  return {
    supabase: context.supabase,
    claims: context.claims,
    workspace: context.workspace,
  };
}
