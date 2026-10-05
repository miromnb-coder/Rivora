"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireWorkspace } from "@/lib/rivora/workspace";
import { validateBusinessCentralManualMapping } from "@/lib/rivora/erp/business-central";

export async function saveBusinessCentralMapping(formData: FormData) {
  const context = await requireWorkspace();
  if (!["owner", "admin"].includes(context.workspace.role)) {
    throw new Error("Owner or admin access is required.");
  }
  if (context.workspace.erpProvider !== "business_central") {
    throw new Error("Business Central is not the selected ERP for this workspace.");
  }

  const { supabase, workspace, claims } = context;
  const entityType = String(formData.get("entityType") ?? "").trim();
  const localEntityId = String(formData.get("localEntityId") ?? "").trim();
  const externalNumber = String(formData.get("externalNumber") ?? "").trim().slice(0, 120);

  if (!["customer", "product"].includes(entityType) || !localEntityId || !externalNumber) {
    redirect("/app/settings/business-central?error=" + encodeURIComponent("Business Central mapping fields are required."));
  }

  let failure: string | null = null;
  let displayName = "";

  try {
    let localUnit: string | null = null;
    if (entityType === "product") {
      const { data: product, error: productError } = await supabase
        .from("products")
        .select("id,unit")
        .eq("id", localEntityId)
        .eq("organization_id", workspace.id)
        .eq("active", true)
        .maybeSingle();
      if (productError) throw productError;
      if (!product) throw new Error("Averomira product was not found.");
      localUnit = product.unit ? String(product.unit) : null;
    } else {
      const { data: customer, error: customerError } = await supabase
        .from("customers")
        .select("id")
        .eq("id", localEntityId)
        .eq("organization_id", workspace.id)
        .maybeSingle();
      if (customerError) throw customerError;
      if (!customer) throw new Error("Averomira customer was not found.");
    }

    const validated = await validateBusinessCentralManualMapping({
      workspaceId: workspace.id,
      entityType: entityType as "customer" | "product",
      externalNumber,
      localUnit,
    });
    displayName = validated.displayName || validated.externalNumber;

    const { error } = await supabase
      .from("erp_entity_mappings")
      .upsert(
        {
          organization_id: workspace.id,
          provider: "business_central",
          entity_type: entityType,
          local_entity_id: localEntityId,
          external_id: validated.externalId,
          external_number: validated.externalNumber,
          metadata: validated.metadata,
          updated_by: String(claims.sub),
        },
        { onConflict: "organization_id,provider,entity_type,local_entity_id" },
      );

    if (error) throw new Error(error.message);
  } catch (error) {
    failure = error instanceof Error ? error.message : "Business Central mapping could not be verified.";
  }

  revalidatePath("/app/settings/business-central");
  if (failure) {
    redirect("/app/settings/business-central?error=" + encodeURIComponent(failure));
  }
  redirect(
    "/app/settings/business-central?saved=1&verified=" +
      encodeURIComponent(displayName),
  );
}


export async function removeBusinessCentralMapping(formData: FormData) {
  const context = await requireWorkspace();
  if (!["owner", "admin"].includes(context.workspace.role)) {
    throw new Error("Owner or admin access is required.");
  }
  if (context.workspace.erpProvider !== "business_central") {
    throw new Error("Business Central is not the selected ERP for this workspace.");
  }

  const entityType = String(formData.get("entityType") ?? "").trim();
  const localEntityId = String(formData.get("localEntityId") ?? "").trim();

  if (!["customer", "product"].includes(entityType) || !localEntityId) {
    redirect(
      "/app/settings/business-central?error=" +
        encodeURIComponent("Business Central mapping could not be removed."),
    );
  }

  const { error } = await context.supabase.rpc("remove_erp_entity_mapping", {
    target_entity_type: entityType,
    target_local_entity_id: localEntityId,
  });

  if (error) {
    redirect(
      "/app/settings/business-central?error=" +
        encodeURIComponent(error.message),
    );
  }

  revalidatePath("/app/settings/business-central");
  revalidatePath("/app");
  revalidatePath("/app/orders");
  redirect("/app/settings/business-central?removed=1");
}
