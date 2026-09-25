import { createClient } from "@supabase/supabase-js";
import { getSupabaseConfig } from "@/lib/supabase/config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const payload = await request.text();
  const svixId = request.headers.get("svix-id");
  const svixTimestamp = request.headers.get("svix-timestamp");
  const svixSignature = request.headers.get("svix-signature");

  if (!payload || !svixId || !svixTimestamp || !svixSignature) {
    return Response.json({ error: "Missing webhook signature." }, { status: 400 });
  }

  const { url, key } = getSupabaseConfig();
  const supabase = createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });

  const { data, error } = await supabase.rpc("process_resend_webhook", {
    p_payload: payload,
    p_svix_id: svixId,
    p_svix_timestamp: svixTimestamp,
    p_svix_signature: svixSignature,
  });

  if (error) {
    console.error("Resend webhook rejected:", error.message);
    return Response.json({ error: "Webhook rejected." }, { status: 400 });
  }

  return Response.json(data ?? { status: "ok" });
}
