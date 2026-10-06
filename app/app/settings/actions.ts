"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireWorkspace } from "@/lib/rivora/workspace";
import { createAdminClient } from "@/lib/supabase/admin";
import { isSelectableErpProvider } from "@/lib/rivora/erp";

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

export async function updateWorkspaceErpProvider(formData: FormData) {
  const { supabase, workspace } = await requireSettingsAdmin();
  const erpProvider = clean(formData.get("erpProvider"), 40);

  if (!isSelectableErpProvider(erpProvider)) {
    throw new Error("Unsupported ERP provider.");
  }

  const { error } = await supabase
    .from("organizations")
    .update({
      erp_provider: erpProvider,
      erp_requested_name: erpProvider === "custom" ? undefined : null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", workspace.id);

  if (error) throw new Error(error.message);

  revalidatePath("/app/settings");
  revalidatePath("/app/sales-orders");
  revalidatePath("/app/orders");
  redirect("/app/settings?saved=1#erp");
}

export async function updateWorkspaceRequestedErp(formData: FormData) {
  const { supabase, workspace } = await requireSettingsAdmin();

  if (workspace.erpProvider !== "custom") {
    redirect(
      settingsUrl(
        "Muu ERP pitää valita ennen ERP-nimen tallentamista.",
        "error",
        "erp",
      ),
    );
  }

  const requestedName = clean(formData.get("erpRequestedName"), 120);
  if (!requestedName) {
    redirect(
      settingsUrl(
        "Anna käytössä olevan ERP-järjestelmän nimi.",
        "error",
        "erp",
      ),
    );
  }

  const { error } = await supabase
    .from("organizations")
    .update({
      erp_requested_name: requestedName,
      updated_at: new Date().toISOString(),
    })
    .eq("id", workspace.id);

  if (error) throw new Error(error.message);

  revalidatePath("/app/settings");
  revalidatePath("/app/sales-orders");
  revalidatePath("/app/orders");
  redirect(
    settingsUrl(
      "ERP-nimi tallennettiin. Tämä ei aktivoi automaattista ERP-integraatiota.",
      "ok",
      "erp",
    ),
  );
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


function settingsUrl(message: string, tone: "ok" | "error" = "ok", anchor = "") {
  const query = new URLSearchParams({ message, tone });
  return `/app/settings?${query.toString()}${anchor ? `#${anchor}` : ""}`;
}

export async function inviteWorkspaceMember(formData: FormData) {
  const context = await requireSettingsAdmin();
  const { workspace } = context;
  const email = clean(formData.get("email"), 320).toLowerCase();
  const role = clean(formData.get("role"), 30) || "member";

  if (!EMAIL_RE.test(email)) {
    redirect(settingsUrl("Anna kelvollinen sähköpostiosoite.", "error", "users"));
  }
  if (!["admin", "member", "reviewer"].includes(role)) {
    redirect(settingsUrl("Valitse sallittu käyttäjärooli.", "error", "users"));
  }

  let failure: string | null = null;

  try {
    const admin = createAdminClient();
    const { data: listed, error: listError } = await admin.auth.admin.listUsers({
      page: 1,
      perPage: 1000,
    });
    if (listError) throw listError;

    let user = listed.users.find(
      (candidate) => String(candidate.email || "").toLowerCase() === email,
    );

    if (!user) {
      const { data: invited, error: inviteError } = await admin.auth.admin.inviteUserByEmail(
        email,
        {
          data: {
            invited_to_workspace_id: workspace.id,
            invited_to_workspace_name: workspace.name,
          },
        },
      );
      if (inviteError) throw inviteError;
      user = invited.user;
    }

    if (!user?.id) throw new Error("Käyttäjää ei voitu luoda.");

    const { data: memberships, error: membershipError } = await admin
      .from("organization_members")
      .select("organization_id,role")
      .eq("user_id", user.id);

    if (membershipError) throw membershipError;

    const otherWorkspace = (memberships ?? []).find(
      (membership: any) => String(membership.organization_id) !== workspace.id,
    );
    if (otherWorkspace) {
      throw new Error(
        "Tämä käyttäjä kuuluu jo toiseen työtilaan. Nykyinen työtilamalli tukee yhtä työtilaa käyttäjää kohden.",
      );
    }

    const { error: upsertError } = await admin
      .from("organization_members")
      .upsert(
        {
          organization_id: workspace.id,
          user_id: user.id,
          role,
        },
        { onConflict: "organization_id,user_id" },
      );

    if (upsertError) throw upsertError;

    revalidatePath("/app/settings");
  } catch (error) {
    failure =
      error instanceof Error ? error.message : "Käyttäjän kutsuminen epäonnistui.";
  }

  redirect(
    settingsUrl(
      failure ?? "Käyttäjä kutsuttiin työtilaan.",
      failure ? "error" : "ok",
      "users",
    ),
  );
}

export async function updateWorkspaceMemberRole(formData: FormData) {
  const context = await requireSettingsAdmin();
  const { workspace, claims } = context;
  const userId = clean(formData.get("userId"), 80);
  const role = clean(formData.get("role"), 30);

  if (!userId || !["owner", "admin", "member", "reviewer"].includes(role)) {
    redirect(settingsUrl("Käyttäjäroolin päivitys epäonnistui.", "error", "users"));
  }

  if (String(claims.sub) === userId && role !== workspace.role) {
    redirect(
      settingsUrl(
        "Et voi vaihtaa omaa rooliasi tästä näkymästä.",
        "error",
        "users",
      ),
    );
  }

  let failure: string | null = null;

  try {
    const admin = createAdminClient();
    const { data: target, error: targetError } = await admin
      .from("organization_members")
      .select("role")
      .eq("organization_id", workspace.id)
      .eq("user_id", userId)
      .maybeSingle();

    if (targetError) throw targetError;
    if (!target) throw new Error("Käyttäjää ei löytynyt työtilasta.");

    if (target.role === "owner" && workspace.role !== "owner") {
      throw new Error("Vain omistaja voi muuttaa omistajan roolia.");
    }
    if (role === "owner" && workspace.role !== "owner") {
      throw new Error("Vain omistaja voi antaa omistajan roolin.");
    }

    const { error } = await admin
      .from("organization_members")
      .update({ role })
      .eq("organization_id", workspace.id)
      .eq("user_id", userId);

    if (error) throw error;

    revalidatePath("/app/settings");
  } catch (error) {
    failure =
      error instanceof Error ? error.message : "Roolin päivitys epäonnistui.";
  }

  redirect(
    settingsUrl(
      failure ?? "Käyttäjän rooli päivitettiin.",
      failure ? "error" : "ok",
      "users",
    ),
  );
}
