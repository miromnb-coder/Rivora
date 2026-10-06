import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  clientAddress,
  consumePublicRateLimit,
} from "@/lib/rivora/rate-limit";
import {
  operationalLog,
  requestIdFor,
  requestIdHeaders,
  safeErrorMessage,
} from "@/lib/rivora/observability";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const INTENTS = new Set(["demo", "pricing", "pilot"]);
const VOLUMES = new Set(["1-10", "11-50", "51-200", "200+"]);

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export async function POST(request: Request) {
  const requestId = requestIdFor(request);

  try {
    const contentType = request.headers.get("content-type") ?? "";
    if (!contentType.includes("application/json")) {
      return NextResponse.json(
        { error: "Unsupported request.", requestId },
        { status: 415, headers: requestIdHeaders(requestId) },
      );
    }

    const body = await request.json();

    // Honeypot: silently accept bot submissions without storing them.
    if (text(body.website)) {
      return NextResponse.json(
        { ok: true },
        { status: 201, headers: requestIdHeaders(requestId) },
      );
    }

    const ipLimit = await consumePublicRateLimit({
      scope: "lead_ip",
      value: clientAddress(request),
      windowSeconds: 10 * 60,
      limit: 10,
    });

    if (!ipLimit.allowed) {
      operationalLog("warn", "lead_rate_limited", {
        requestId,
        scope: "ip",
        retryAfterSeconds: ipLimit.retryAfterSeconds,
      });
      return NextResponse.json(
        { error: "Too many requests. Please try again later.", requestId },
        {
          status: 429,
          headers: {
            ...requestIdHeaders(requestId),
            "Retry-After": String(ipLimit.retryAfterSeconds),
          },
        },
      );
    }

    const name = text(body.name);
    const workEmail = text(body.workEmail).toLowerCase();
    const company = text(body.company);
    const role = text(body.role);
    const intent = text(body.intent) || "demo";
    const rfqVolume = text(body.rfqVolume);
    const message = text(body.message);

    if (EMAIL_RE.test(workEmail)) {
      const emailLimit = await consumePublicRateLimit({
        scope: "lead_email",
        value: workEmail,
        windowSeconds: 60 * 60,
        limit: 4,
      });

      if (!emailLimit.allowed) {
        operationalLog("warn", "lead_rate_limited", {
          requestId,
          scope: "email",
          retryAfterSeconds: emailLimit.retryAfterSeconds,
        });
        return NextResponse.json(
          { error: "Too many requests. Please try again later.", requestId },
          {
            status: 429,
            headers: {
              ...requestIdHeaders(requestId),
              "Retry-After": String(emailLimit.retryAfterSeconds),
            },
          },
        );
      }
    }

    if (name.length < 2 || name.length > 120) {
      return NextResponse.json({ error: "Please enter your name.", requestId }, { status: 400, headers: requestIdHeaders(requestId) });
    }

    if (!EMAIL_RE.test(workEmail) || workEmail.length > 320) {
      return NextResponse.json({ error: "Please enter a valid work email.", requestId }, { status: 400, headers: requestIdHeaders(requestId) });
    }

    if (company.length < 2 || company.length > 160) {
      return NextResponse.json({ error: "Please enter your company.", requestId }, { status: 400, headers: requestIdHeaders(requestId) });
    }

    if (role.length > 120 || message.length > 2000) {
      return NextResponse.json({ error: "One of the fields is too long.", requestId }, { status: 400, headers: requestIdHeaders(requestId) });
    }

    if (!INTENTS.has(intent)) {
      return NextResponse.json({ error: "Invalid request type.", requestId }, { status: 400, headers: requestIdHeaders(requestId) });
    }

    if (rfqVolume && !VOLUMES.has(rfqVolume)) {
      return NextResponse.json({ error: "Invalid RFQ volume.", requestId }, { status: 400, headers: requestIdHeaders(requestId) });
    }

    const supabase = await createClient();
    const { error } = await supabase.from("marketing_leads").insert({
      name,
      work_email: workEmail,
      company,
      role: role || null,
      intent,
      rfq_volume: rfqVolume || null,
      message: message || null,
      source: intent === "pricing" ? "pricing" : intent === "demo" ? "demo" : "homepage",
      status: "new",
    });

    if (error) {
      operationalLog("error", "lead_capture_write_failed", {
        requestId,
        code: error.code,
        message: error.message,
      });
      return NextResponse.json(
        { error: "We could not save your request. Please try again.", requestId },
        { status: 500, headers: requestIdHeaders(requestId) },
      );
    }

    operationalLog("info", "lead_capture_created", { requestId, intent });
    return NextResponse.json(
      { ok: true },
      { status: 201, headers: requestIdHeaders(requestId) },
    );
  } catch (error) {
    operationalLog("error", "lead_capture_failed", {
      requestId,
      message: safeErrorMessage(error),
    });
    return NextResponse.json(
      { error: "Request could not be processed.", requestId },
      { status: 503, headers: requestIdHeaders(requestId) },
    );
  }
}
