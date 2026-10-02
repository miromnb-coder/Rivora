"use server";

import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCanonicalAppUrl } from "@/lib/rivora/app-url";

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

async function sendRecoveryEmail(email: string) {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from =
    (
      process.env.AVEROMIRA_INVITE_FROM ??
      process.env.AVEROMIRA_QUOTE_FROM
    )?.trim() || "Averomira <miro@averomira.com>";
  const replyTo =
    process.env.AVEROMIRA_QUOTE_REPLY_TO?.trim() || "miro@averomira.com";

  if (!apiKey) return;

  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.generateLink({
    type: "recovery",
    email,
  });

  if (error || !data?.properties?.hashed_token) {
    return;
  }

  const recoveryUrl = new URL("/auth/confirm", getCanonicalAppUrl());
  recoveryUrl.searchParams.set("token_hash", data.properties.hashed_token);
  recoveryUrl.searchParams.set("type", "recovery");
  recoveryUrl.searchParams.set("next", "/reset-password");

  const text = [
    "Hei,",
    "",
    "Averomira-tilillesi pyydettiin salasanan palautusta.",
    "Aseta uusi salasana tästä linkistä:",
    recoveryUrl.toString(),
    "",
    "Jos et pyytänyt salasanan palautusta, voit jättää tämän viestin huomiotta.",
    "",
    "Averomira",
  ].join("\n");

  const html = `<div style="font-family:Arial,sans-serif;color:#202520;line-height:1.65">
    <p>Hei,</p>
    <p>Averomira-tilillesi pyydettiin salasanan palautusta.</p>
    <p><a href="${escapeHtml(recoveryUrl.toString())}" style="display:inline-block;background:#171a18;color:#fff;text-decoration:none;padding:12px 18px;border-radius:999px;font-weight:700">Aseta uusi salasana</a></p>
    <p style="color:#747975;font-size:13px">Jos et pyytänyt salasanan palautusta, voit jättää tämän viestin huomiotta.</p>
  </div>`;

  const body: Record<string, unknown> = {
    from,
    to: [email],
    subject: "Palauta Averomira-salasanasi",
    text,
    html,
  };

  if (replyTo) body.reply_to = [replyTo];

  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  }).catch(() => undefined);
}

export async function requestPasswordReset(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();

  if (email && email.length <= 320) {
    try {
      await sendRecoveryEmail(email);
    } catch {
      // Intentionally return the same response whether the account exists or not.
    }
  }

  redirect("/forgot-password?sent=1");
}
