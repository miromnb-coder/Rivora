import crypto from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";

function hmacSecret() {
  const secret =
    process.env.RATE_LIMIT_HMAC_SECRET?.trim() ||
    process.env.SUPABASE_SECRET_KEY?.trim() ||
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

  if (!secret) {
    throw new Error("Server rate-limit secret is not configured.");
  }

  return secret;
}

function keyHash(scope: string, value: string) {
  return crypto
    .createHmac("sha256", hmacSecret())
    .update(`${scope}:\0${value}`)
    .digest("hex");
}

export function clientAddress(request: Request) {
  const forwarded = request.headers.get("x-forwarded-for");
  const first = forwarded?.split(",")[0]?.trim();
  if (first) return first.slice(0, 120);

  const vercelForwarded = request.headers.get("x-real-ip")?.trim();
  if (vercelForwarded) return vercelForwarded.slice(0, 120);

  return "unknown";
}

export async function consumePublicRateLimit({
  scope,
  value,
  windowSeconds,
  limit,
}: {
  scope: string;
  value: string;
  windowSeconds: number;
  limit: number;
}) {
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("consume_public_rate_limit_server", {
    target_scope: scope,
    target_key_hash: keyHash(scope, value),
    target_window_seconds: windowSeconds,
    target_limit: limit,
  });

  if (error) {
    throw new Error(`Rate-limit check failed: ${error.message}`);
  }

  const result = Array.isArray(data) ? data[0] : data;
  return {
    allowed: result?.allowed === true,
    count: Number(result?.request_count ?? 0),
    retryAfterSeconds: Math.max(
      1,
      Number(result?.retry_after_seconds ?? windowSeconds),
    ),
  };
}
