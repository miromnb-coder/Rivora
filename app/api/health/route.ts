import { createAdminClient } from "@/lib/supabase/admin";
import {
  operationalLog,
  requestIdFor,
  requestIdHeaders,
  safeErrorMessage,
} from "@/lib/rivora/observability";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const requestId = requestIdFor(request);

  try {
    const admin = createAdminClient();
    const { error } = await admin
      .from("organizations")
      .select("id")
      .limit(1);

    if (error) throw error;

    return Response.json(
      {
        status: "ok",
        service: "averomira",
        requestId,
      },
      {
        status: 200,
        headers: requestIdHeaders(requestId),
      },
    );
  } catch (error) {
    operationalLog("error", "health_check_failed", {
      requestId,
      message: safeErrorMessage(error),
    });

    return Response.json(
      {
        status: "degraded",
        service: "averomira",
        requestId,
      },
      {
        status: 503,
        headers: requestIdHeaders(requestId),
      },
    );
  }
}
