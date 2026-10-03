import Link from "next/link";
import { notFound } from "next/navigation";
import { requireWorkspace } from "@/lib/rivora/workspace";
import { getLocale } from "@/lib/locale";
import { updateProduct } from "../actions";

export default async function ProductDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ saved?: string }>;
}) {
  const [{ id }, query, locale, { supabase, workspace }] = await Promise.all([
    params,
    searchParams,
    getLocale(),
    requireWorkspace(),
  ]);
  const fi = locale === "fi";

  const [{ data: product }, { data: mapping }] = await Promise.all([
    supabase
      .from("products")
      .select("id,sku,name,manufacturer,manufacturer_part_number,unit,unit_price,stock_quantity,active,updated_at")
      .eq("id", id)
      .eq("organization_id", workspace.id)
      .maybeSingle(),
    supabase
      .from("erp_entity_mappings")
      .select("external_number,metadata,updated_at")
      .eq("organization_id", workspace.id)
      .eq("provider", "business_central")
      .eq("entity_type", "product")
      .eq("local_entity_id", id)
      .maybeSingle(),
  ]);

  if (!product) notFound();

  return (
    <div className="app-page-v2">
      <div className="mb-5">
        <Link href="/app/products" className="text-sm font-semibold">
          ← {fi ? "Tuotteet" : "Products"}
        </Link>
      </div>

      <header className="mb-7">
        <div className="app-kicker-v2">{fi ? "Tuote" : "Product"}</div>
        <h1>{product.sku}</h1>
        <p>{product.name}</p>
      </header>

      {query.saved ? (
        <div className="mb-5 rounded-xl border border-[#dfe7df] bg-[#f7faf7] p-4 text-sm text-[#426048]">
          {fi ? "Tuotetiedot tallennettiin." : "Product details saved."}
        </div>
      ) : null}

      <div className="grid gap-5 xl:grid-cols-[1fr_300px]">
        <section className="surface p-6">
          <div className="mb-5">
            <div className="upload-v2-section-label">{fi ? "Tuotetiedot" : "Product details"}</div>
            <h2 className="mt-1 text-xl font-bold">
              {fi ? "Muokkaa katalogitietoja" : "Edit catalogue data"}
            </h2>
          </div>

          <form action={updateProduct} className="settings-form-grid">
            <input type="hidden" name="productId" value={product.id} />

            <label>
              <span>SKU</span>
              <input name="sku" required defaultValue={product.sku} />
            </label>

            <label>
              <span>{fi ? "Tuotenimi" : "Product name"}</span>
              <input name="name" required defaultValue={product.name} />
            </label>

            <label>
              <span>{fi ? "Valmistaja" : "Manufacturer"}</span>
              <input name="manufacturer" defaultValue={product.manufacturer || ""} />
            </label>

            <label>
              <span>MPN</span>
              <input
                name="manufacturerPartNumber"
                defaultValue={product.manufacturer_part_number || ""}
              />
            </label>

            <label>
              <span>{fi ? "Yksikkö" : "Unit"}</span>
              <input name="unit" defaultValue={product.unit || "pcs"} />
            </label>

            <label>
              <span>{fi ? "Yksikköhinta" : "Unit price"}</span>
              <input
                name="unitPrice"
                inputMode="decimal"
                defaultValue={product.unit_price == null ? "" : String(product.unit_price)}
              />
            </label>

            <label>
              <span>{fi ? "Varasto" : "Stock"}</span>
              <input
                name="stockQuantity"
                inputMode="decimal"
                defaultValue={product.stock_quantity == null ? "" : String(product.stock_quantity)}
              />
            </label>

            <label className="flex items-center gap-2 self-end pb-2">
              <input type="checkbox" name="active" defaultChecked={Boolean(product.active)} />
              <span>{fi ? "Tuote aktiivinen" : "Product active"}</span>
            </label>

            <div className="sm:col-span-2">
              <button className="btn-primary">
                {fi ? "Tallenna tuote" : "Save product"}
              </button>
            </div>
          </form>
        </section>

        <aside className="surface p-5">
          <div className="upload-v2-section-label">Business Central</div>
          <h2 className="mt-1 text-lg font-bold">
            {fi ? "ERP-vastine" : "ERP mapping"}
          </h2>

          {mapping?.external_number ? (
            <div className="mt-4 rounded-xl border border-[var(--line)] bg-[#fafaf8] p-4">
              <span className="text-xs text-[var(--muted)]">BC item no.</span>
              <strong className="mt-1 block">{mapping.external_number}</strong>
              {mapping?.metadata?.businessCentralDisplayName ? (
                <p className="mt-1 text-xs text-[var(--muted)]">
                  {String(mapping.metadata.businessCentralDisplayName)}
                </p>
              ) : null}
            </div>
          ) : (
            <p className="mt-4 text-sm leading-6 text-[var(--muted)]">
              {fi
                ? "Tälle tuotteelle ei ole vielä tallennettua Business Central -vastinetta."
                : "This product does not have a saved Business Central mapping yet."}
            </p>
          )}

          <Link href="/app/settings/business-central" className="btn-secondary mt-4">
            {fi ? "Hallitse vastineita" : "Manage mappings"} →
          </Link>
        </aside>
      </div>
    </div>
  );
}
