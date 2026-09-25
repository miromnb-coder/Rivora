"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireWorkspace } from "@/lib/rivora/workspace";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function clean(value: FormDataEntryValue | null, max: number) {
  return String(value ?? "").trim().slice(0, max);
}

function numberValue(value: FormDataEntryValue | null) {
  const parsed = Number(String(value ?? ""));
  return Number.isFinite(parsed) ? parsed : NaN;
}

async function requireSettingsAdmin() {
  const context = await requireWorkspace();
  if (!["owner", "admin"].includes(context.workspace.role)) {
    throw new Error("Owner or admin access is required to change company settings.");
  }
  return context;
}

export async function updateWorkspaceSettings(formData: FormData) {
  const { supabase, workspace } = await requireSettingsAdmin();
  const name = clean(formData.get("name"), 200);
  const businessId = clean(formData.get("businessId"), 64);
  const addressLine1 = clean(formData.get("addressLine1"), 200);
  const addressLine2 = clean(formData.get("addressLine2"), 200);
  const postalCode = clean(formData.get("postalCode"), 32);
  const city = clean(formData.get("city"), 120);
  const country = clean(formData.get("country"), 120) || "Finland";
  const email = clean(formData.get("email"), 320).toLowerCase();
  const phone = clean(formData.get("phone"), 80);
  const defaultTaxRate = numberValue(formData.get("defaultTaxRate"));
  const defaultQuoteValidityDays = Math.trunc(
    numberValue(formData.get("defaultQuoteValidityDays"))
  );

  if (!name) throw new Error("Company name is required.");
  if (email && !EMAIL_RE.test(email)) throw new Error("Enter a valid company email.");
  if (!Number.isFinite(defaultTaxRate) || defaultTaxRate < 0 || defaultTaxRate > 100) {
    throw new Error("Default VAT must be between 0 and 100.");
  }
  if (
    !Number.isFinite(defaultQuoteValidityDays) ||
    defaultQuoteValidityDays < 1 ||
    defaultQuoteValidityDays > 365
  ) {
    throw new Error("Quote validity must be between 1 and 365 days.");
  }

  const logo = formData.get("logo");
  let logoPath: string | undefined;

  if (logo instanceof File && logo.size > 0) {
    if (!["image/png", "image/jpeg"].includes(logo.type)) {
      throw new Error("Logo must be a PNG or JPEG image.");
    }
    if (logo.size > 2 * 1024 * 1024) {
      throw new Error("Logo must be smaller than 2 MB.");
    }

    const extension = logo.type === "image/png" ? "png" : "jpg";
    logoPath = `${workspace.id}/logo.${extension}`;

    const { data: current } = await supabase
      .from("organizations")
      .select("logo_path")
      .eq("id", workspace.id)
      .maybeSingle();

    if (current?.logo_path && current.logo_path !== logoPath) {
      await supabase.storage.from("workspace-assets").remove([current.logo_path]);
    }

    const { error: uploadError } = await supabase.storage
      .from("workspace-assets")
      .upload(logoPath, logo, {
        upsert: true,
        contentType: logo.type,
        cacheControl: "3600",
      });

    if (uploadError) throw new Error(`Logo upload failed: ${uploadError.message}`);
  }

  const update: Record<string, unknown> = {
    name,
    business_id: businessId || null,
    address_line1: addressLine1 || null,
    address_line2: addressLine2 || null,
    postal_code: postalCode || null,
    city: city || null,
    country,
    email: email || null,
    phone: phone || null,
    default_tax_rate: defaultTaxRate,
    default_quote_validity_days: defaultQuoteValidityDays,
    onboarding_completed_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  if (logoPath) update.logo_path = logoPath;

  const { error } = await supabase
    .from("organizations")
    .update(update)
    .eq("id", workspace.id);

  if (error) throw new Error(error.message);

  revalidatePath("/app/settings");
  revalidatePath("/app/setup");
  revalidatePath("/app/quotes");
  redirect("/app/settings?saved=1");
}

export async function removeWorkspaceLogo() {
  const { supabase, workspace } = await requireSettingsAdmin();
  const { data: organization } = await supabase
    .from("organizations")
    .select("logo_path")
    .eq("id", workspace.id)
    .maybeSingle();

  if (organization?.logo_path) {
    await supabase.storage.from("workspace-assets").remove([organization.logo_path]);
  }

  const { error } = await supabase
    .from("organizations")
    .update({ logo_path: null, updated_at: new Date().toISOString() })
    .eq("id", workspace.id);

  if (error) throw new Error(error.message);

  revalidatePath("/app/settings");
}
