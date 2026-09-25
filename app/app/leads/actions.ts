"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireSalesAdmin } from "@/lib/rivora/sales";

const ALLOWED_STATUS = new Set(["new", "contacted", "qualified", "closed"]);

export async function updateLeadStatus(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const status = String(formData.get("status") ?? "");

  if (!id || !ALLOWED_STATUS.has(status)) {
    throw new Error("Invalid lead update.");
  }

  const { supabase } = await requireSalesAdmin();
  const { error } = await supabase
    .from("marketing_leads")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", id);

  if (error) throw new Error("Could not update lead status.");

  revalidatePath("/app/leads");
  revalidatePath(`/app/leads/${id}`);
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
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) throw new Error("Could not save lead note.");

  revalidatePath("/app/leads");
  revalidatePath(`/app/leads/${id}`);
  redirect(`/app/leads/${id}`);
}
