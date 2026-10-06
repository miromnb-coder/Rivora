import { createAdminClient } from "@/lib/supabase/admin";
import {
  operationalLog,
  requestIdFor,
  requestIdHeaders,
} from "@/lib/rivora/observability";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const requestId = requestIdFor(request);
  const payload = await request.text();
  const svixId = request.headers.get("svix-id");
  const svixTimestamp = request.headers.get("svix-timestamp");
  const svixSignature = request.headers.get("svix-signature");

  if (!payload || !svixId || !svixTimestamp || !svixSignature) {
    operationalLog("warn", "resend_webhook_signature_missing", { requestId });
    return Response.json(
      { error: "Missing webhook signature.", requestId },
      { status: 400, headers: requestIdHeaders(requestId) },
    );
  }

  const supabase = createAdminClient();

  const { data, error } = await supabase.rpc("process_resend_webhook", {
    p_payload: payload,
    p_svix_id: svixId,
    p_svix_timestamp: svixTimestamp,
    p_svix_signature: svixSignature,
  });

  if (error) {
    operationalLog("warn", "resend_webhook_rejected", {
      requestId,
      message: error.message,
    });
    return Response.json(
      { error: "Webhook rejected.", requestId },
      { status: 400, headers: requestIdHeaders(requestId) },
    );
  }

  operationalLog("info", "resend_webhook_processed", { requestId });
  return Response.json(
    data ?? { status: "ok" },
    { headers: requestIdHeaders(requestId) },
  );
}
