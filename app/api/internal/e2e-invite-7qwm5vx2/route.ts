import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCanonicalAppUrl } from "@/lib/rivora/app-url";

export const dynamic = "force-dynamic";

const TEST_EMAIL = "miromnb@icloud.com";
const TEST_TOKEN = "e2e_7qWm5Vx2Jp9Kc4Nf8Rt3Hy6Ld1Sa0UzB";

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export async function GET(request: NextRequest) {
  if (request.nextUrl.searchParams.get("token") !== TEST_TOKEN) {
    return NextResponse.json({ ok: false }, { status: 404 });
  }

  const admin = createAdminClient();
  const now = new Date().toISOString();

  const { data: existing } = await admin
    .from("pilot_access_invites")
    .select("id,accepted_at,invite_sent_at")
    .eq("email", TEST_EMAIL)
    .is("revoked_at", null)
    .maybeSingle();

  if (existing?.accepted_at) {
    return NextResponse.json({ ok: false, reason: "already_accepted" }, { status: 409 });
  }

  let inviteId = existing?.id ?? null;

  if (!inviteId) {
    const { data: created, error: createError } = await admin
      .from("pilot_access_invites")
      .insert({
        email: TEST_EMAIL,
        company_name: "Nodra E2E Test",
        approved_at: now,
      })
      .select("id")
      .single();

    if (createError || !created) {
      return NextResponse.json(
        { ok: false, stage: "invite_record", error: createError?.message ?? "create_failed" },
        { status: 500 },
      );
    }
    inviteId = created.id;
  }

  const { data, error } = await admin.auth.admin.generateLink({
    type: "invite",
    email: TEST_EMAIL,
  });

  if (error || !data?.properties?.hashed_token) {
    await admin
      .from("pilot_access_invites")
      .update({ invite_error: error?.message ?? "link_generation_failed", updated_at: now })
      .eq("id", inviteId);

    return NextResponse.json(
      { ok: false, stage: "generate_link", error: error?.message ?? "link_generation_failed" },
      { status: 500 },
    );
  }

  const confirmUrl = new URL("/auth/confirm", getCanonicalAppUrl());
  confirmUrl.searchParams.set("token_hash", data.properties.hashed_token);
  confirmUrl.searchParams.set("type", "invite");
  confirmUrl.searchParams.set("next", "/onboarding");

  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = (
    process.env.NODRA_INVITE_FROM ??
    process.env.NODRA_QUOTE_FROM ??
    process.env.RIVORA_QUOTE_FROM
  )?.trim();
  const replyTo = (
    process.env.NODRA_QUOTE_REPLY_TO ??
    process.env.RIVORA_QUOTE_REPLY_TO
  )?.trim();

  if (!apiKey || !from) {
    await admin
      .from("pilot_access_invites")
      .update({ invite_error: "Invite email delivery is not configured.", updated_at: now })
      .eq("id", inviteId);

    return NextResponse.json({ ok: false, stage: "email_config" }, { status: 500 });
  }

  const text = [
    "Hei,",
    "",
    "Tämä on Nodran E2E-testikutsu.",
    "Avaa alla oleva linkki, aseta salasana ja luo testityötila:",
    confirmUrl.toString(),
    "",
    "Nodra",
  ].join("\n");

  const html = `<div style="font-family:Arial,sans-serif;color:#202520;line-height:1.65">
    <p>Hei,</p>
    <p>Tämä on Nodran E2E-testikutsu.</p>
    <p><a href="${escapeHtml(confirmUrl.toString())}" style="display:inline-block;background:#171a18;color:#fff;text-decoration:none;padding:12px 18px;border-radius:999px;font-weight:700">Avaa Nodra Pilot</a></p>
    <p style="color:#747975;font-size:13px">Tämän testin tarkoitus on varmistaa kutsu → onboarding → kirjautuminen -ketju.</p>
  </div>`;

  const body: Record<string, unknown> = {
    from,
    to: [TEST_EMAIL],
    subject: "Nodra E2E-testikutsu",
    text,
    html,
  };
  if (replyTo) body.reply_to = [replyTo];

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const result = (await response.json().catch(() => ({}))) as { id?: string; message?: string };

  if (!response.ok || !result.id) {
    const message = result.message ?? "Pilot invitation email could not be sent.";
    await admin
      .from("pilot_access_invites")
      .update({ invite_error: message.slice(0, 1000), updated_at: now })
      .eq("id", inviteId);

    return NextResponse.json({ ok: false, stage: "send_email", error: message }, { status: 500 });
  }

  await admin
    .from("pilot_access_invites")
    .update({
      invite_sent_at: new Date().toISOString(),
      invite_error: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", inviteId);

  return NextResponse.json({
    ok: true,
    email: TEST_EMAIL,
    inviteId,
    emailId: result.id,
    confirmHost: confirmUrl.host,
    confirmPath: confirmUrl.pathname,
  });
}
