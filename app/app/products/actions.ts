"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireWorkspace } from "@/lib/rivora/workspace";

export async function updateProduct(formData: FormData) {
  const { supabase, workspace } = await requireWorkspace();
  const productId = String(formData.get("productId") ?? "").trim();
  const sku = String(formData.get("sku") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();

  if (!productId || !sku || !name) throw new Error("Required product fields are missing.");

  const { error } = await supabase
    .from("products")
    .update({ sku, name, updated_at: new Date().toISOString() })
    .eq("id", productId)
    .eq("organization_id", workspace.id);

  if (error) throw new Error(error.message);

  revalidatePath("/app/products");
  revalidatePath("/app/products/" + productId);
  redirect("/app/products/" + productId + "?saved=1");
}
