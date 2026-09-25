import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const INTENTS = new Set(["demo", "pricing", "pilot"]);
const VOLUMES = new Set(["1-10", "11-50", "51-200", "200+"]);

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export async function POST(request: Request) {
  try {
    const contentType = request.headers.get("content-type") ?? "";
    if (!contentType.includes("application/json")) {
      return NextResponse.json({ error: "Unsupported request." }, { status: 415 });
    }

    const body = await request.json();

    // Honeypot: silently accept bot submissions without storing them.
    if (text(body.website)) {
      return NextResponse.json({ ok: true }, { status: 201 });
    }

    const name = text(body.name);
    const workEmail = text(body.workEmail).toLowerCase();
    const company = text(body.company);
    const role = text(body.role);
    const intent = text(body.intent) || "demo";
    const rfqVolume = text(body.rfqVolume);
    const message = text(body.message);

    if (name.length < 2 || name.length > 120) {
      return NextResponse.json({ error: "Please enter your name." }, { status: 400 });
    }

    if (!EMAIL_RE.test(workEmail) || workEmail.length > 320) {
      return NextResponse.json({ error: "Please enter a valid work email." }, { status: 400 });
    }

    if (company.length < 2 || company.length > 160) {
      return NextResponse.json({ error: "Please enter your company." }, { status: 400 });
    }

    if (role.length > 120 || message.length > 2000) {
      return NextResponse.json({ error: "One of the fields is too long." }, { status: 400 });
    }

    if (!INTENTS.has(intent)) {
      return NextResponse.json({ error: "Invalid request type." }, { status: 400 });
    }

    if (rfqVolume && !VOLUMES.has(rfqVolume)) {
      return NextResponse.json({ error: "Invalid RFQ volume." }, { status: 400 });
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
      console.error("[lead-capture]", error.code, error.message);
      return NextResponse.json(
        { error: "We could not save your request. Please try again." },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
}
