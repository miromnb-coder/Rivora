import { redirect } from "next/navigation";
import { requireWorkspace } from "@/lib/rivora/workspace";

export default async function AppHome() {
  const { supabase, workspace } = await requireWorkspace();

  const [
    { data: organization },
    { count: productCount },
    { count: rfqCount },
    { count: quoteCount },
  ] = await Promise.all([
    supabase
      .from("organizations")
      .select("name,email,address_line1,city")
      .eq("id", workspace.id)
      .maybeSingle(),
    supabase
      .from("products")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", workspace.id)
      .eq("active", true),
    supabase
      .from("rfqs")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", workspace.id),
    supabase
      .from("quotes")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", workspace.id),
  ]);

  const companyReady = Boolean(
    organization?.name &&
      organization?.email &&
      organization?.address_line1 &&
      organization?.city,
  );
  const setupComplete =
    companyReady &&
    (productCount ?? 0) > 0 &&
    (rfqCount ?? 0) > 0 &&
    (quoteCount ?? 0) > 0;

  redirect(setupComplete ? "/app/inbox" : "/app/setup");
}
