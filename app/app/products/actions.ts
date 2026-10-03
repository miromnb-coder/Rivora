"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireWorkspace } from "@/lib/rivora/workspace";

export async function updateProduct(formData: FormData) {
  const { supabase, workspace } = await requireWorkspace();
  const productId = String(formData.get("productId") ?? "").trim();
  const sku = String(formData.get("sku") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  const manufacturer = String(formData.get("manufacturer") ?? "").trim();
  const manufacturerPartNumber = String(formData.get("manufacturerPartNumber") ?? "").trim();
  const unit = String(formData.get("unit") ?? "").trim() || "pcs";
  const unitPriceRaw = String(formData.get("unitPrice") ?? "").trim().replace(",", ".");
  const stockRaw = String(formData.get("stockQuantity") ?? "").trim().replace(",", ".");
  const unitPrice = unitPriceRaw ? Number(unitPriceRaw) : null;
  const stockQuantity = stockRaw ? Number(stockRaw) : null;
  const active = String(formData.get("active") ?? "") === "on";

  if (!productId || !sku || !name) throw new Error("Required product fields are missing.");
  if (unitPrice != null && (!Number.isFinite(unitPrice) || unitPrice < 0)) throw new Error("Invalid unit price.");
  if (stockQuantity != null && (!Number.isFinite(stockQuantity) || stockQuantity < 0)) throw new Error("Invalid stock quantity.");

  const { error } = await supabase
    .from("products")
    .update({
      sku,
      name,
      manufacturer: manufacturer || null,
      manufacturer_part_number: manufacturerPartNumber || null,
      unit,
      unit_price: unitPrice,
      stock_quantity: stockQuantity,
      active,
      updated_at: new Date().toISOString(),
    })
    .eq("id", productId)
    .eq("organization_id", workspace.id);

  if (error) throw new Error(error.message);

  revalidatePath("/app/products");
  revalidatePath("/app/products/" + productId);
  redirect("/app/products/" + productId + "?saved=1");
}
