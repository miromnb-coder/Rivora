import crypto from "node:crypto";

const REQUEST_ID_RE = /^[A-Za-z0-9._:-]{1,120}$/;

export function requestIdFor(request?: Request) {
  const candidates = request
    ? [
        request.headers.get("x-request-id"),
        request.headers.get("x-vercel-id"),
      ]
    : [];

  for (const candidate of candidates) {
    const value = String(candidate || "").trim();
    if (REQUEST_ID_RE.test(value)) return value;
  }

  return crypto.randomUUID();
}

export function operationalLog(
  level: "info" | "warn" | "error",
  event: string,
  fields: Record<string, unknown> = {},
) {
  const payload = JSON.stringify({
    ts: new Date().toISOString(),
    event,
    ...fields,
  });

  if (level === "error") console.error(payload);
  else if (level === "warn") console.warn(payload);
  else console.info(payload);
}

export function safeErrorMessage(error: unknown, fallback = "Unexpected error") {
  return (error instanceof Error ? error.message : fallback).slice(0, 2000);
}

export function requestIdHeaders(requestId: string) {
  return {
    "X-Request-Id": requestId,
    "Cache-Control": "no-store",
  };
}
