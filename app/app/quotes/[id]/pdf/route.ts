import { createClient } from "@/lib/supabase/server";
import { loadQuoteDocumentData, quotePdfFilename, renderQuotePdf } from "@/lib/rivora/quote-document";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: claimsResult } = await supabase.auth.getClaims();
  const claims = claimsResult?.claims;

  if (!claims?.sub) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { data: membership } = await supabase
    .from("organization_members")
    .select("organization_id, organizations(name)")
    .eq("user_id", claims.sub)
    .limit(1)
    .maybeSingle();

  if (!membership) {
    return new Response("Workspace required", { status: 403 });
  }

  const organization = Array.isArray(membership.organizations)
    ? membership.organizations[0]
    : membership.organizations;

  const document = await loadQuoteDocumentData(
    supabase,
    id,
    (organization as { name?: string } | null)?.name || "Rivora"
  );

  if (!document) {
    return new Response("Quote not found", { status: 404 });
  }

  const pdf = renderQuotePdf(document);

  return new Response(new Uint8Array(pdf), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${quotePdfFilename(document.quoteNumber)}"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
