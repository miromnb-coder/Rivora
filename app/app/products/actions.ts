"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireWorkspace } from "@/lib/rivora/workspace";

function message(error: unknown) {
  return error instanceof Error ? error.message : "Product could not be saved.";
}

export async function updateProduct(formData: FormData) {
  const productId = String(formData.get("productId") ?? "").trim();
  let failure: string | null = null;

  try {
    if (!productId) throw new Error("Product is required.");

    const { supabase, workspace } = await requireWorkspace();
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

    if (!sku || !name) throw new Error("Required product fields are missing.");
    if (unitPrice != null && (!Number.isFinite(unitPrice) || unitPrice < 0)) {
      throw new Error("Yksikköhinnan pitää olla vähintään 0.");
    }
    if (stockQuantity != null && (!Number.isFinite(stockQuantity) || stockQuantity < 0)) {
      throw new Error("Varastomäärän pitää olla vähintään 0.");
    }

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
  } catch (error) {
    failure = message(error);
  }

  revalidatePath("/app/products");
  if (productId) revalidatePath("/app/products/" + productId);

  if (failure) {
    redirect(
      productId
        ? "/app/products/" + productId + "?error=" + encodeURIComponent(failure)
        : "/app/products?error=" + encodeURIComponent(failure),
    );
  }

  redirect("/app/products/" + productId + "?saved=1");
}
