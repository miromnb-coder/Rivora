"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireSalesAdmin } from "@/lib/rivora/sales";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCanonicalAppUrl } from "@/lib/rivora/app-url";

const ALLOWED_STATUS = new Set(["new", "contacted", "qualified", "closed"]);
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function refreshLead(id: string) {
  revalidatePath("/app/leads");
  revalidatePath(`/app/leads/${id}`);
}

export async function updateLeadStatus(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const status = String(formData.get("status") ?? "");

  if (!id || !ALLOWED_STATUS.has(status)) {
    throw new Error("Invalid lead update.");
  }

  const now = new Date().toISOString();
  const { supabase } = await requireSalesAdmin();
  const update =
    status === "closed"
      ? {
          status,
          notification_read_at: now,
          follow_up_on: null,
          next_action: null,
          follow_up_completed_at: now,
          updated_at: now,
        }
      : {
          status,
          notification_read_at: now,
          updated_at: now,
        };

  const { error } = await supabase
    .from("marketing_leads")
    .update(update)
    .eq("id", id);

  if (error) throw new Error("Could not update lead status.");
  refreshLead(id);
}

export async function updateLeadNote(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const note = String(formData.get("internal_note") ?? "").trim();

  if (!id || note.length > 5000) {
    throw new Error("Invalid lead note.");
  }

  const { supabase } = await requireSalesAdmin();
  const { error } = await supabase
    .from("marketing_leads")
    .update({
      internal_note: note || null,
      notification_read_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) throw new Error("Could not save lead note.");

  refreshLead(id);
  redirect(`/app/leads/${id}`);
}

export async function markLeadRead(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) throw new Error("Invalid lead.");

  const now = new Date().toISOString();
  const { supabase } = await requireSalesAdmin();
  const { error } = await supabase
    .from("marketing_leads")
    .update({ notification_read_at: now, updated_at: now })
    .eq("id", id);

  if (error) throw new Error("Could not mark lead as read.");
  refreshLead(id);
}

export async function updateLeadFollowUp(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const nextAction = String(formData.get("next_action") ?? "").trim();
  const followUpOn = String(formData.get("follow_up_on") ?? "").trim();

  if (!id || nextAction.length > 500 || (followUpOn && !DATE_RE.test(followUpOn))) {
    throw new Error("Invalid follow-up.");
  }

  const now = new Date().toISOString();
  const { supabase } = await requireSalesAdmin();
  const { error } = await supabase
    .from("marketing_leads")
    .update({
      next_action: nextAction || null,
      follow_up_on: followUpOn || null,
      follow_up_completed_at: null,
      notification_read_at: now,
      updated_at: now,
    })
    .eq("id", id);

  if (error) throw new Error("Could not schedule follow-up.");
  refreshLead(id);
}

export async function completeLeadFollowUp(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) throw new Error("Invalid lead.");

  const now = new Date().toISOString();
  const { supabase } = await requireSalesAdmin();
  const { error } = await supabase
    .from("marketing_leads")
    .update({
      follow_up_on: null,
      next_action: null,
      follow_up_completed_at: now,
      notification_read_at: now,
      updated_at: now,
    })
    .eq("id", id);

  if (error) throw new Error("Could not complete follow-up.");
  refreshLead(id);
}


function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

async function sendPilotInviteEmail({
  email,
  name,
}: {
  email: string;
  name: string;
}) {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = (process.env.NODRA_INVITE_FROM ?? process.env.NODRA_QUOTE_FROM ?? process.env.RIVORA_QUOTE_FROM)?.trim();
  const replyTo = (process.env.NODRA_QUOTE_REPLY_TO ?? process.env.RIVORA_QUOTE_REPLY_TO)?.trim();

  if (!apiKey || !from) {
    throw new Error("Invite email delivery is not configured.");
  }

  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.generateLink({
    type: "invite",
    email,
  });

  if (error || !data?.properties?.hashed_token) {
    throw new Error(error?.message || "Could not create the pilot invitation link.");
  }

  const appUrl = getCanonicalAppUrl();
  const confirmUrl = new URL("/auth/confirm", appUrl);
  confirmUrl.searchParams.set("token_hash", data.properties.hashed_token);
  confirmUrl.searchParams.set("type", "invite");
  confirmUrl.searchParams.set("next", "/onboarding");

  const greeting = name ? `Hei ${name},` : "Hei,";
  const text = [
    greeting,
    "",
    "Nodra Pilot -pääsysi on hyväksytty.",
    "Avaa alla oleva linkki vahvistaaksesi sähköpostisi, asettaaksesi salasanan ja luodaksesi yrityksesi työtilan:",
    confirmUrl.toString(),
    "",
    "Jos et odottanut tätä kutsua, voit jättää viestin huomiotta.",
    "",
    "Nodra",
  ].join("\n");

  const html = `<div style="font-family:Arial,sans-serif;color:#202520;line-height:1.65">
    <p>${escapeHtml(greeting)}</p>
    <p>Nodra Pilot -pääsysi on hyväksytty.</p>
    <p>Avaa alla oleva linkki vahvistaaksesi sähköpostisi, asettaaksesi salasanan ja luodaksesi yrityksesi työtilan.</p>
    <p><a href="${escapeHtml(confirmUrl.toString())}" style="display:inline-block;background:#171a18;color:#fff;text-decoration:none;padding:12px 18px;border-radius:999px;font-weight:700">Avaa Nodra Pilot</a></p>
    <p style="color:#747975;font-size:13px">Jos et odottanut tätä kutsua, voit jättää viestin huomiotta.</p>
  </div>`;

  const body: Record<string, unknown> = {
    from,
    to: [email],
    subject: "Nodra Pilot -kutsusi on valmis",
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

  const result = (await response.json().catch(() => ({}))) as {
    id?: string;
    message?: string;
  };

  if (!response.ok || !result.id) {
    throw new Error(result.message || "Pilot invitation email could not be sent.");
  }

  return result.id;
}

export async function approvePilotAccess(formData: FormData) {
  const id = String(formData.get("id") ?? "").trim();
  if (!id) throw new Error("Invalid lead.");

  const { supabase, claims } = await requireSalesAdmin();
  const { data: lead } = await supabase
    .from("marketing_leads")
    .select("id,name,work_email,company")
    .eq("id", id)
    .maybeSingle();

  if (!lead) throw new Error("Lead not found.");

  const email = String(lead.work_email ?? "").trim().toLowerCase();
  if (!email) throw new Error("Lead email is missing.");

  const now = new Date().toISOString();
  const { data: existing } = await supabase
    .from("pilot_access_invites")
    .select("id,accepted_at")
    .eq("email", email)
    .is("revoked_at", null)
    .maybeSingle();

  let inviteId = existing?.id ?? null;

  if (existing?.accepted_at) {
    throw new Error("This pilot invitation has already been accepted.");
  }

  if (inviteId) {
    const { error } = await supabase
      .from("pilot_access_invites")
      .update({
        lead_id: lead.id,
        company_name: lead.company,
        approved_by: claims.sub,
        approved_at: now,
        invite_error: null,
        updated_at: now,
      })
      .eq("id", inviteId);
    if (error) throw new Error(error.message);
  } else {
    const { data: created, error } = await supabase
      .from("pilot_access_invites")
      .insert({
        lead_id: lead.id,
        email,
        company_name: lead.company,
        approved_by: claims.sub,
        approved_at: now,
      })
      .select("id")
      .single();

    if (error || !created) throw new Error(error?.message || "Could not approve pilot access.");
    inviteId = created.id;
  }

  try {
    await sendPilotInviteEmail({ email, name: lead.name });
    await supabase
      .from("pilot_access_invites")
      .update({
        invite_sent_at: new Date().toISOString(),
        invite_error: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", inviteId);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Pilot invitation could not be sent.";
    await supabase
      .from("pilot_access_invites")
      .update({
        invite_error: message.slice(0, 1000),
        updated_at: new Date().toISOString(),
      })
      .eq("id", inviteId);
  }

  await supabase
    .from("marketing_leads")
    .update({
      status: "qualified",
      notification_read_at: now,
      updated_at: now,
    })
    .eq("id", id);

  refreshLead(id);
  redirect(`/app/leads/${id}`);
}
