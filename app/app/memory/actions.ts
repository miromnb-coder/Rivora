"use server";

import { revalidatePath } from "next/cache";
import { requireWorkspace } from "@/lib/rivora/workspace";
import { createAdminClient } from "@/lib/supabase/admin";

export async function updateCustomerMemoryMapping(formData: FormData) {
  const mappingId = String(formData.get("mappingId") ?? "");
  const productSku = String(formData.get("productSku") ?? "").trim();

  if (!mappingId || !productSku) throw new Error("Mapping and product SKU are required.");

  const { supabase, workspace, claims } = await requireWorkspace();
  if (!["owner","admin","member"].includes(workspace.role)) {
    throw new Error("Reviewer access is read-only.");
  }

  const [{ data: mapping }, { data: product }] = await Promise.all([
    supabase
      .from("customer_product_mappings")
      .select("id,organization_id,customer_id")
      .eq("id",mappingId)
      .eq("organization_id",workspace.id)
      .maybeSingle(),
    supabase
      .from("products")
      .select("id,sku")
      .eq("organization_id",workspace.id)
      .eq("sku",productSku)
      .eq("active",true)
      .maybeSingle(),
  ]);

  if (!mapping) throw new Error("Customer Memory mapping not found.");
  if (!product) throw new Error("Active catalogue product with that SKU was not found.");

  const admin = createAdminClient();
  const { error } = await admin.rpc("update_customer_product_memory_server", {
    target_mapping_id: mapping.id,
    target_product_id: product.id,
    target_actor_id: claims.sub,
  });

  if (error) throw new Error(error.message);

  revalidatePath("/app/memory");
  revalidatePath(`/app/customers/${mapping.customer_id}`);
}

export async function deleteCustomerMemoryMapping(formData: FormData) {
  const mappingId = String(formData.get("mappingId") ?? "");
  const confirmed = formData.get("confirmDelete") === "on";
  if (!mappingId) throw new Error("Mapping is required.");
  if (!confirmed) throw new Error("Confirm Customer Memory deletion before continuing.");

  const { supabase, workspace, claims } = await requireWorkspace();
  if (!["owner","admin"].includes(workspace.role)) {
    throw new Error("Owner or admin access is required to delete Customer Memory.");
  }

  const { data: mapping } = await supabase
    .from("customer_product_mappings")
    .select("id,customer_id")
    .eq("id",mappingId)
    .eq("organization_id",workspace.id)
    .maybeSingle();

  if (!mapping) throw new Error("Customer Memory mapping not found.");

  const admin = createAdminClient();
  const { error } = await admin.rpc("disable_customer_product_memory_server", {
    target_mapping_id: mapping.id,
    target_actor_id: claims.sub,
  });

  if (error) throw new Error(error.message);

  revalidatePath("/app/memory");
  revalidatePath(`/app/customers/${mapping.customer_id}`);
}
