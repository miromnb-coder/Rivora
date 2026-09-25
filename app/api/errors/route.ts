import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const claims = claimsData?.claims;

  if (!claims?.sub) {
    return Response.json({ ok: false }, { status: 401 });
  }

  const { data: membership } = await supabase
    .from("organization_members")
    .select("organization_id")
    .eq("user_id", claims.sub)
    .limit(1)
    .maybeSingle();

  let body: {
    route?: string;
    action?: string;
    message?: string;
    digest?: string;
  } = {};

  try {
    body = await request.json();
  } catch {
    return Response.json({ ok: false }, { status: 400 });
  }

  const message = String(body.message ?? "Unexpected application error").slice(0, 2000);
  const route = String(body.route ?? "").slice(0, 500) || null;
  const action = String(body.action ?? "").slice(0, 200) || null;
  const digest = String(body.digest ?? "").slice(0, 200) || null;

  console.error("[nodra-app-error]", {
    organizationId: membership?.organization_id ?? null,
    route,
    action,
    digest,
    message,
  });

  const { error } = await supabase.from("app_error_events").insert({
    organization_id: membership?.organization_id ?? null,
    user_id: claims.sub,
    route,
    action,
    message,
    error_digest: digest,
    metadata: { source: "next-error-boundary" },
  });

  if (error) {
    console.error("[nodra-app-error-monitor-write-failed]", error.message);
  }

  return Response.json({ ok: true });
}
