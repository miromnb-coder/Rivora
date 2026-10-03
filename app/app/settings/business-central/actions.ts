"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireWorkspace } from "@/lib/rivora/workspace";

export async function saveBusinessCentralMapping(formData: FormData) {
  const context = await requireWorkspace();
  if (!["owner", "admin"].includes(context.workspace.role)) {
    throw new Error("Owner or admin access is required.");
  }

  const { supabase, workspace, claims } = context;
  const entityType = String(formData.get("entityType") ?? "").trim();
  const localEntityId = String(formData.get("localEntityId") ?? "").trim();
  const externalNumber = String(formData.get("externalNumber") ?? "").trim().slice(0, 120);

  if (!["customer", "product"].includes(entityType) || !localEntityId || !externalNumber) {
    throw new Error("Business Central mapping fields are required.");
  }

  const { error } = await supabase
    .from("erp_entity_mappings")
    .upsert(
      {
        organization_id: workspace.id,
        provider: "business_central",
        entity_type: entityType,
        local_entity_id: localEntityId,
        external_number: externalNumber,
        metadata: {
          autoMatched: false,
          confidence: 100,
          matchMethod: "manual_confirmation",
        },
        updated_by: String(claims.sub),
      },
      { onConflict: "organization_id,provider,entity_type,local_entity_id" },
    );

  if (error) throw new Error(error.message);

  revalidatePath("/app/settings/business-central");
  redirect("/app/settings/business-central?saved=1");
}
