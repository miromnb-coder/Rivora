"use server";

import { revalidatePath } from "next/cache";
import { requireWorkspace } from "@/lib/rivora/workspace";

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

  const { error } = await supabase
    .from("customer_product_mappings")
    .update({
      product_id: product.id,
      confidence: 100,
      source: "user_confirmed",
      confirmed_by_user_id: claims.sub,
      updated_at: new Date().toISOString(),
    })
    .eq("id",mapping.id)
    .eq("organization_id",workspace.id);

  if (error) throw new Error(error.message);

  revalidatePath("/app/memory");
  revalidatePath(`/app/customers/${mapping.customer_id}`);
}

export async function deleteCustomerMemoryMapping(formData: FormData) {
  const mappingId = String(formData.get("mappingId") ?? "");
  if (!mappingId) throw new Error("Mapping is required.");

  const { supabase, workspace } = await requireWorkspace();
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

  const { error } = await supabase
    .from("customer_product_mappings")
    .delete()
    .eq("id",mapping.id)
    .eq("organization_id",workspace.id);

  if (error) throw new Error(error.message);

  revalidatePath("/app/memory");
  revalidatePath(`/app/customers/${mapping.customer_id}`);
}
