import { cache } from "react";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";

type WorkspaceOrganization = {
  name?: string;
  default_tax_rate?: number | string | null;
  default_quote_validity_days?: number | null;
  onboarding_completed_at?: string | null;
  erp_provider?: string | null;
  erp_requested_name?: string | null;
};

export const getAuthContext = cache(async function getAuthContext() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  const claims = data?.claims;

  if (error || !claims?.sub) {
    return { supabase, claims: null, workspace: null };
  }

  const { data: memberships, error: membershipError } = await supabase
    .from("organization_members")
    .select("organization_id,role,organizations(name,default_tax_rate,default_quote_validity_days,onboarding_completed_at,erp_provider,erp_requested_name)")
    .eq("user_id", claims.sub)
    .order("created_at", { ascending: true }).limit(51);
  const selectedId = (await cookies()).get("averomira-active-organization-id")?.value;
  const authorized = !membershipError && memberships && memberships.length<=50 ? memberships : [];
  // A cookie is only a selector, never authorization. The row must belong
  // to the currently authenticated user.
  const membership = selectedId
    ? authorized.find(m=>m.organization_id===selectedId) ?? null
    : authorized[0] ?? null;

  const organization = Array.isArray(membership?.organizations)
    ? membership?.organizations[0]
    : membership?.organizations;
  const org = organization as WorkspaceOrganization | null;

  return {
    supabase,
    claims,
    workspace: membership
      ? {
          id: membership.organization_id as string,
          role: membership.role as string,
          name: org?.name ?? "Averomira workspace",
          defaultTaxRate: Number(org?.default_tax_rate ?? 25.5),
          defaultQuoteValidityDays: Number(org?.default_quote_validity_days ?? 14),
          onboardingCompletedAt: org?.onboarding_completed_at ?? null,
          erpProvider: org?.erp_provider ?? "none",
          erpRequestedName: org?.erp_requested_name ?? null,
        }
      : null,
  };
});

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
