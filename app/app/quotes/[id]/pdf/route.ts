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
    .select("organization_id")
    .eq("user_id", claims.sub)
    .limit(1)
    .maybeSingle();

  if (!membership) {
    return new Response("Workspace required", { status: 403 });
  }

  const document = await loadQuoteDocumentData(supabase, id);

  if (!document) {
    return new Response("Quote not found", { status: 404 });
  }

  const pdf = await renderQuotePdf(document);

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
