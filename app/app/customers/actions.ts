"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireWorkspace } from "@/lib/rivora/workspace";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function clean(value: FormDataEntryValue | null, max: number) {
  return String(value ?? "").trim().slice(0, max);
}

async function assertCustomer(supabase: Awaited<ReturnType<typeof requireWorkspace>>["supabase"], organizationId: string, customerId: string) {
  const { data: customer } = await supabase
    .from("customers")
    .select("id")
    .eq("id", customerId)
    .eq("organization_id", organizationId)
    .maybeSingle();

  if (!customer) throw new Error("Customer not found.");
  return customer;
}

export async function createCustomer(formData: FormData) {
  const { supabase, workspace } = await requireWorkspace();
  const name = clean(formData.get("name"), 200);
  const externalId = clean(formData.get("externalId"), 120);
  const emailDomain = clean(formData.get("emailDomain"), 200).toLowerCase();

  if (!name) throw new Error("Customer name is required.");

  const { data, error } = await supabase
    .from("customers")
    .insert({
      organization_id: workspace.id,
      name,
      external_id: externalId || null,
      email_domain: emailDomain || null,
    })
    .select("id")
    .single();

  if (error || !data) throw new Error(error?.message || "Could not create customer.");

  revalidatePath("/app/customers");
  redirect(`/app/customers/${data.id}`);
}

export async function addCustomerContact(formData: FormData) {
  const { supabase, workspace } = await requireWorkspace();
  const customerId = String(formData.get("customerId") ?? "");
  const name = clean(formData.get("name"), 160);
  const email = clean(formData.get("email"), 320).toLowerCase();
  const phone = clean(formData.get("phone"), 80);
  const title = clean(formData.get("title"), 120);
  const isPrimary = String(formData.get("isPrimary") ?? "") === "on";

  if (!customerId) throw new Error("Customer is required.");
  if (!name) throw new Error("Contact name is required.");
  if (!EMAIL_RE.test(email)) throw new Error("Enter a valid contact email.");

  await assertCustomer(supabase, workspace.id, customerId);

  if (isPrimary) {
    await supabase
      .from("customer_contacts")
      .update({ is_primary: false, updated_at: new Date().toISOString() })
      .eq("customer_id", customerId);
  }

  const { error } = await supabase.from("customer_contacts").insert({
    organization_id: workspace.id,
    customer_id: customerId,
    name,
    email,
    phone: phone || null,
    title: title || null,
    is_primary: isPrimary,
  });

  if (error) throw new Error(error.message);

  revalidatePath(`/app/customers/${customerId}`);
}

export async function setPrimaryContact(formData: FormData) {
  const { supabase, workspace } = await requireWorkspace();
  const customerId = String(formData.get("customerId") ?? "");
  const contactId = String(formData.get("contactId") ?? "");
  if (!customerId || !contactId) throw new Error("Contact is required.");

  await assertCustomer(supabase, workspace.id, customerId);

  const { data: contact } = await supabase
    .from("customer_contacts")
    .select("id")
    .eq("id", contactId)
    .eq("customer_id", customerId)
    .eq("organization_id", workspace.id)
    .maybeSingle();

  if (!contact) throw new Error("Contact not found.");

  await supabase
    .from("customer_contacts")
    .update({ is_primary: false, updated_at: new Date().toISOString() })
    .eq("customer_id", customerId);

  const { error } = await supabase
    .from("customer_contacts")
    .update({ is_primary: true, updated_at: new Date().toISOString() })
    .eq("id", contactId);

  if (error) throw new Error(error.message);
  revalidatePath(`/app/customers/${customerId}`);
}

export async function deleteCustomerContact(formData: FormData) {
  const { supabase, workspace } = await requireWorkspace();
  const customerId = String(formData.get("customerId") ?? "");
  const contactId = String(formData.get("contactId") ?? "");
  if (!customerId || !contactId) throw new Error("Contact is required.");

  await assertCustomer(supabase, workspace.id, customerId);

  const { error } = await supabase
    .from("customer_contacts")
    .delete()
    .eq("id", contactId)
    .eq("customer_id", customerId)
    .eq("organization_id", workspace.id);

  if (error) throw new Error(error.message);
  revalidatePath(`/app/customers/${customerId}`);
}
