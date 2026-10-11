import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getAuthContext } from "@/lib/rivora/workspace";
import {
  readCatalogueFile,
  mapCatalogueTable,
  suggestCatalogueMapping,
  validateCatalogueMapping,
  type CatalogueMapping,
} from "@/lib/rivora/catalogue-file";
import { suggestCatalogueAiMapping } from "@/lib/rivora/catalogue-ai";
import {
  catalogueIssueSample,
  catalogueReportPage,
} from "@/lib/rivora/catalogue-report";

export const runtime = "nodejs";
const processing = new Set<string>();
// Hosted Vercel Functions have a 4.5 MB request ceiling; reserve multipart overhead.
const MAX_FILE_MB = process.env.VERCEL ? 4 : 10;
const MAX_BODY = MAX_FILE_MB * 1024 * 1024 + 64 * 1024;
const uuid = (value: unknown) =>
  typeof value === "string" &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
function databaseMessage(message: string) {
  if (message.includes("CATALOGUE_PREVIEW_STALE"))
    return "Katalogi muuttui esikatselun jälkeen. Palaa kartoitukseen ja luo uusi esikatselu.";
  if (message.includes("CATALOGUE_PREVIEW_EXPIRED"))
    return "Esikatselu on vanhentunut. Luo uusi esikatselu.";
  if (message.includes("CATALOGUE_REPLACE_CONFIRMATION_REQUIRED"))
    return "Vahvista koko katalogin korvaaminen erikseen.";
  if (message.includes("CATALOGUE_TOO_MANY_PREVIEWS"))
    return "Organisaatiolla on jo viisi voimassa olevaa esikatselua. Käytä olemassa olevaa esikatselua tai odota sen vanhenemista (1 tunti).";
  if (/CATALOGUE_|SKU_CONFLICT/.test(message))
    return "Tuontipyyntöä ei voitu vahvistaa. Tarkista tiedot ja luo uusi esikatselu.";
  return "Tietokantatoiminto epäonnistui. Muutoksia ei vahvistettu. Voit yrittää uudelleen samalla tuontitunnisteella.";
}
async function boundedBody(request: Request) {
  if (Number(request.headers.get("content-length")) > MAX_BODY)
    throw new Error(
      `Tiedosto ylittää tämän ympäristön ${MAX_FILE_MB} MB kokorajan.`,
    );
  const reader = request.body?.getReader();
  if (!reader) throw new Error("Tuontipyyntö puuttuu.");
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_BODY) {
        await reader.cancel();
        throw new Error(
          `Tiedosto ylittää tämän ympäristön ${MAX_FILE_MB} MB kokorajan.`,
        );
      }
      chunks.push(value);
    }
  } catch (error) {
    throw error instanceof Error
      ? error
      : new Error("Tiedoston lataus keskeytyi. Valitse tiedosto uudelleen.");
  }
  return new Response(Buffer.concat(chunks), {
    headers: { "content-type": request.headers.get("content-type") ?? "" },
  }).formData();
}
export async function GET() {
  const { supabase, workspace } = await getAuthContext();
  if (!workspace || !["owner", "admin"].includes(workspace.role))
    return NextResponse.json(
      { error: "Tuonti vaatii omistajan tai ylläpitäjän oikeudet." },
      { status: 403 },
    );
  const { data, error } = await supabase
    .from("catalogue_field_maps")
    .select("id,name,format,headers,mapping")
    .eq("organization_id", workspace.id)
    .order("updated_at", { ascending: false })
    .limit(50);
  return NextResponse.json(
    error
      ? {
          error:
            "Tallennettuja karttoja ei voitu lukea. Manuaalinen kartoitus toimii silti.",
        }
      : { maps: data },
    { status: error ? 503 : 200, headers: { "Cache-Control": "no-store" } },
  );
}
export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin || origin !== new URL(request.url).origin)
    return NextResponse.json(
      { error: "Virheellinen pyynnön alkuperä." },
      { status: 403 },
    );
  const { supabase, workspace } = await getAuthContext();
  if (!workspace || !["owner", "admin"].includes(workspace.role))
    return NextResponse.json(
      { error: "Tuonti vaatii omistajan tai ylläpitäjän oikeudet." },
      { status: 403 },
    );
  if (processing.has(workspace.id) || processing.size >= 2)
    return NextResponse.json(
      { error: "Tuontia käsitellään jo. Odota hetki ja yritä uudelleen." },
      { status: 429 },
    );
  processing.add(workspace.id);
  try {
    const form = await boundedBody(request);
    const action = String(form.get("action") ?? "inspect");
    if (action === "page" || action === "discard") {
      const importId = form.get("importId"),
        page = Number(form.get("page") ?? 0);
      if (
        !uuid(importId) ||
        !Number.isInteger(page) ||
        page < 0 ||
        page > 25000
      )
        throw new Error("Virheellinen esikatselupyyntö.");
      const { data, error } = await supabase.rpc("catalogue_preview_action", {
        target_organization_id: workspace.id,
        import_id: importId,
        page_number: page,
        discard: action === "discard",
      });
      if (error)
        return NextResponse.json(
          { error: databaseMessage(error.message) },
          { status: 409 },
        );
      return NextResponse.json(data);
    }
    if (action === "commit") {
      const importId = form.get("importId");
      if (!uuid(importId)) throw new Error("Tuontitunniste puuttuu.");
      const { data, error } = await supabase.rpc("commit_catalogue_import", {
        target_organization_id: workspace.id,
        import_id: importId,
        confirm_replace: form.get("confirmReplace") === "true",
      });
      if (error)
        return NextResponse.json(
          { error: databaseMessage(error.message) },
          { status: 409 },
        );
      revalidatePath("/app/products");
      revalidatePath("/app/upload");
      return NextResponse.json({ result: data });
    }
    if (action === "deleteMap") {
      const id = form.get("mapId");
      if (!uuid(id)) throw new Error("Karttatunniste puuttuu.");
      const { error } = await supabase
        .from("catalogue_field_maps")
        .delete()
        .eq("id", id)
        .eq("organization_id", workspace.id);
      if (error)
        return NextResponse.json(
          { error: "Karttaa ei voitu poistaa." },
          { status: 503 },
        );
      return NextResponse.json({ deleted: true });
    }
    if (action === "suggestAi") {
      const headers = JSON.parse(
        String(form.get("headers") ?? "[]"),
      ) as unknown;
      if (
        !Array.isArray(headers) ||
        headers.length > 100 ||
        !headers.every((h) => typeof h === "string" && h.length <= 200)
      )
        throw new Error("Virheelliset otsikot.");
      return NextResponse.json(await suggestCatalogueAiMapping(headers));
    }
    if (!["inspect", "preview", "saveMap", "report"].includes(action))
      throw new Error("Tuntematon tuontitoiminto.");
    const file = form.get("catalogue");
    if (!(file instanceof File))
      throw new Error("Valitse CSV- tai XLSX-tiedosto.");
    const table = await readCatalogueFile(
      file,
      String(form.get("delimiter") ?? "auto"),
    );
    if (action === "inspect")
      return NextResponse.json({
        headers: table.headers,
        samples: table.rows
          .slice(0, 5)
          .map((row) =>
            row.map((value) =>
              value.length > 200 ? value.slice(0, 200) + "…" : value,
            ),
          ),
        count: table.rows.length,
        format: table.format,
        delimiter: table.delimiter,
        mapping: suggestCatalogueMapping(table.headers),
      });
    const mapping = JSON.parse(
      String(form.get("mapping") ?? "{}"),
    ) as CatalogueMapping;
    validateCatalogueMapping(table.headers, mapping);
    if (action === "saveMap") {
      const name = String(form.get("mapName") ?? "").trim();
      if (!name || name.length > 100)
        throw new Error("Anna kartalle nimi (1–100 merkkiä).");
      const { error } = await supabase.from("catalogue_field_maps").upsert(
        {
          organization_id: workspace.id,
          name,
          format: table.format,
          headers: table.headers,
          mapping,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "organization_id,name,format" },
      );
      if (error)
        return NextResponse.json(
          { error: "Karttaa ei voitu tallentaa." },
          { status: 503 },
        );
      return NextResponse.json({ saved: true });
    }
    const skuIndex = table.headers.indexOf(mapping.sku!);
    const { data: skuKeys, error: skuError } = await supabase.rpc(
      "catalogue_sku_keys",
      { skus: table.rows.map((row) => row[skuIndex].trim()) },
    );
    if (
      skuError ||
      !Array.isArray(skuKeys) ||
      skuKeys.length !== table.rows.length
    )
      return NextResponse.json(
        {
          error:
            "SKU-identiteettejä ei voitu varmentaa. Katalogia ei muutettu.",
        },
        { status: 503 },
      );
    const { rows, issues } = mapCatalogueTable(table, mapping, skuKeys);

    if (action === "report") {
      const { csv, nextOffset } = catalogueReportPage(
        issues,
        Number(form.get("reportOffset") ?? 0),
      );
      return new Response(csv, {
        headers: {
          "content-type": "text/csv; charset=utf-8",
          "content-disposition": 'attachment; filename="katalogin-virheet.csv"',
          "Cache-Control": "no-store",
          "X-Catalogue-Next-Offset":
            nextOffset === null ? "" : String(nextOffset),
        },
      });
    }
    if (issues.length)
      return NextResponse.json(
        { issues: catalogueIssueSample(issues), issueCount: issues.length },
        { status: 422 },
      );
    const importId = form.get("importId");
    const mode = String(form.get("mode") ?? "merge");
    if (!uuid(importId) || !["merge", "replace"].includes(mode))
      throw new Error("Virheellinen tuontitunniste tai tila.");
    const payload = rows.map((r) => ({
      sku: r.sku,
      name: r.name,
      manufacturer: r.manufacturer,
      manufacturer_part_number: r.manufacturerPartNumber,
      unit: r.unit,
      unit_price: r.unitPrice,
      stock_quantity: r.stockQuantity,
      stock_quantity_provided: r.stockQuantityProvided,
    }));
    const { data, error } = await supabase.rpc("prepare_catalogue_import", {
      target_organization_id: workspace.id,
      import_id: importId,
      payload,
      import_mode: mode,
      file_hash: table.hash,
    });
    if (error)
      return NextResponse.json(
        { error: databaseMessage(error.message) },
        { status: 409 },
      );
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message.slice(0, 600)
            : "Tiedostoa ei voitu käsitellä. Tarkista tiedosto ja yritä uudelleen.",
      },
      { status: 400 },
    );
  } finally {
    processing.delete(workspace.id);
  }
}
