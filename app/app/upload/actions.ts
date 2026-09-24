"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireWorkspace } from "@/lib/rivora/workspace";
import {
  parseTabularFile,
  sourceTypeFromName,
  toCatalogueRows,
  toRfqRows,
} from "@/lib/rivora/imports";

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Unexpected import error.";
}

export async function importCatalogue(formData: FormData) {
  const file = formData.get("catalogue");
  let imported = 0;
  let failure: string | null = null;

  try {
    if (!(file instanceof File)) throw new Error("Choose a catalogue file.");
    const { supabase, workspace } = await requireWorkspace();
    const rows = toCatalogueRows(await parseTabularFile(file));

    for (let start = 0; start < rows.length; start += 500) {
      const batch = rows.slice(start, start + 500).map((row) => ({
        organization_id: workspace.id,
        sku: row.sku,
        name: row.name,
        manufacturer: row.manufacturer,
        manufacturer_part_number: row.manufacturerPartNumber,
        unit: row.unit,
        unit_price: row.unitPrice,
        stock_quantity: row.stockQuantity,
        active: true,
        updated_at: new Date().toISOString(),
      }));

      const { error } = await supabase
        .from("products")
        .upsert(batch, { onConflict: "organization_id,sku" });

      if (error) throw error;
      imported += batch.length;
    }
  } catch (error) {
    failure = errorMessage(error);
  }

  if (failure) redirect(`/app/upload?catalogueError=${encodeURIComponent(failure)}`);

  revalidatePath("/app/products");
  redirect(`/app/upload?catalogueImported=${imported}`);
}

export async function processRfq(formData: FormData) {
  const file = formData.get("rfq");
  const customerName = String(formData.get("customerName") ?? "").trim();
  const reference = String(formData.get("reference") ?? "").trim();
  let rfqId: string | null = null;
  let failure: string | null = null;

  try {
    if (!(file instanceof File)) throw new Error("Choose an RFQ file.");
    if (!customerName) throw new Error("Customer name is required.");

    const { supabase, workspace } = await requireWorkspace();
    const lines = toRfqRows(await parseTabularFile(file));

    const { data: customer, error: customerError } = await supabase
      .from("customers")
      .upsert(
        { organization_id: workspace.id, name: customerName },
        { onConflict: "organization_id,name" }
      )
      .select("id")
      .single();

    if (customerError) throw customerError;

    const { data: rfq, error: rfqError } = await supabase
      .from("rfqs")
      .insert({
        organization_id: workspace.id,
        customer_id: customer.id,
        reference: reference || file.name,
        source_type: sourceTypeFromName(file.name),
        source_file_name: file.name,
        status: "processing",
      })
      .select("id")
      .single();

    if (rfqError) throw rfqError;
    rfqId = rfq.id;

    const payload = lines.map((line, index) => ({
      organization_id: workspace.id,
      rfq_id: rfq.id,
      line_number: index + 1,
      customer_sku: line.customerSku,
      raw_description: line.description,
      quantity: line.quantity,
      unit: line.unit,
    }));

    const { error: lineError } = await supabase.from("rfq_lines").insert(payload);
    if (lineError) throw lineError;

    const { error: matchError } = await supabase.rpc("refresh_rfq_matches", {
      target_rfq_id: rfq.id,
    });
    if (matchError) throw matchError;
  } catch (error) {
    failure = errorMessage(error);
  }

  if (failure) redirect(`/app/upload?rfqError=${encodeURIComponent(failure)}`);
  if (!rfqId) redirect("/app/upload?rfqError=RFQ%20creation%20failed");

  revalidatePath("/app/inbox");
  redirect(`/app/rfq/${rfqId}`);
}
