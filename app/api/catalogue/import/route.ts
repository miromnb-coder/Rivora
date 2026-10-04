import { NextResponse } from "next/server";
import { requireWorkspace } from "@/lib/rivora/workspace";
import { parseTabularFile, toCatalogueRows } from "@/lib/rivora/imports";

function redirectTo(request: Request, path: string) {
  return NextResponse.redirect(new URL(path, request.url), 303);
}

function message(error: unknown) {
  return error instanceof Error ? error.message : "Unexpected catalogue import error.";
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("catalogue");
    if (!(file instanceof File) || file.size === 0) {
      throw new Error("Choose a catalogue file.");
    }

    const { supabase, workspace } = await requireWorkspace();
    if (!["owner", "admin"].includes(workspace.role)) {
      throw new Error("Owner or admin access is required to import the product catalogue.");
    }

    const rows = toCatalogueRows(await parseTabularFile(file));
    const existingStock = new Map<string, number | null>();
    const skus = [...new Set(rows.map((row) => row.sku))];

    for (let index = 0; index < skus.length; index += 200) {
      const batch = skus.slice(index, index + 200);
      const { data: existingProducts, error } = await supabase
        .from("products")
        .select("sku,stock_quantity")
        .eq("organization_id", workspace.id)
        .in("sku", batch);
      if (error) throw error;

      for (const product of existingProducts ?? []) {
        existingStock.set(
          String(product.sku).toLowerCase(),
          product.stock_quantity == null ? null : Number(product.stock_quantity),
        );
      }
    }

    const payload = rows.map((row) => ({
      sku: row.sku,
      name: row.name,
      manufacturer: row.manufacturer,
      manufacturer_part_number: row.manufacturerPartNumber,
      unit: row.unit,
      unit_price: row.unitPrice,
      stock_quantity: row.stockQuantityProvided
        ? row.stockQuantity
        : existingStock.get(row.sku.toLowerCase()) ?? null,
    }));

    const { data, error } = await supabase.rpc("import_catalogue_rows", {
      target_organization_id: workspace.id,
      payload,
    });
    if (error) throw error;

    const result = (data ?? {}) as {
      total?: number;
      created?: number;
      updated?: number;
      missing_price?: number;
      deactivated?: number;
    };

    const params = new URLSearchParams({
      catalogueImported: String(result.total ?? rows.length),
      catalogueCreated: String(result.created ?? 0),
      catalogueUpdated: String(result.updated ?? 0),
      catalogueMissingPrice: String(
        result.missing_price ?? rows.filter((row) => row.unitPrice == null).length,
      ),
      catalogueDeactivated: String(result.deactivated ?? 0),
    });

    return redirectTo(request, `/app/upload?${params.toString()}`);
  } catch (error) {
    return redirectTo(
      request,
      `/app/upload?catalogueError=${encodeURIComponent(message(error))}`,
    );
  }
}
