"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireSalesAdmin } from "@/lib/rivora/sales";

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
