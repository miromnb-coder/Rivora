import { requireWorkspace } from "@/lib/rivora/workspace";

const money = new Intl.NumberFormat("en-FI", { style: "currency", currency: "EUR" });

export default async function ProductsPage() {
  const { supabase } = await requireWorkspace();
  const { data: products } = await supabase
    .from("products")
    .select("id, sku, manufacturer, manufacturer_part_number, name, unit, unit_price, stock_quantity")
    .eq("active", true)
    .order("sku")
    .limit(500);

  return (
    <div className="mx-auto max-w-6xl px-5 py-8 sm:px-8 lg:px-10 lg:py-10">
      <div className="kicker">Catalogue</div>
      <h1 className="mt-2 text-3xl font-extrabold tracking-[-.035em]">Canonical products.</h1>
      <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--muted)]">
        These products are now the source candidates for RFQ matching. Re-importing the same SKU updates price, stock and metadata.
      </p>
      <div className="surface mt-7 overflow-hidden">
        {(products ?? []).length ? (
          <div className="divide-y divide-[var(--line)]">
            {(products ?? []).map((p: any) => (
              <div key={p.id} className="grid gap-3 px-5 py-4 sm:grid-cols-[1.1fr_2fr_.7fr_.7fr] sm:items-center">
                <div><div className="text-sm font-extrabold">{p.sku}</div><div className="mt-1 text-xs text-[var(--muted)]">{p.manufacturer || "—"}{p.manufacturer_part_number ? ` · ${p.manufacturer_part_number}` : ""}</div></div>
                <div className="text-sm font-semibold">{p.name}</div>
                <div className="text-sm font-bold">{p.unit_price == null ? "—" : money.format(Number(p.unit_price))}</div>
                <div className="text-sm"><span className={`status ${Number(p.stock_quantity ?? 0) > 20 ? "green" : "amber"}`}>{p.stock_quantity ?? "—"} stock</span></div>
              </div>
            ))}
          </div>
        ) : (
          <div className="px-5 py-12 text-center text-sm text-[var(--muted)]">No catalogue imported yet.</div>
        )}
      </div>
    </div>
  );
}
