import Link from "next/link";
import { requireWorkspace } from "@/lib/rivora/workspace";
import { getDictionary } from "@/lib/i18n";
import { formatLocale, getLocale } from "@/lib/locale";

function stockTone(stock: number | null) {
  if (stock == null) return "unknown";
  if (stock <= 0) return "out";
  if (stock <= 20) return "low";
  return "ready";
}

export default async function ProductsPage() {
  const [{ supabase, workspace }, locale] = await Promise.all([requireWorkspace(), getLocale()]);
  const copy = getDictionary(locale).products;
  const numberLocale = formatLocale(locale);
  const money = new Intl.NumberFormat(numberLocale, { style: "currency", currency: "EUR" });

  const [{ data: products }, { count: totalCount }] = await Promise.all([
    supabase.from("products").select("id, sku, manufacturer, manufacturer_part_number, name, unit, unit_price, stock_quantity")
      .eq("active", true).order("sku").limit(500),
    supabase.from("products").select("id", { count: "exact", head: true })
      .eq("organization_id", workspace.id).eq("active", true),
  ]);

  const rows = products ?? [];
  const priced = rows.filter((product: any) => product.unit_price != null).length;
  const stocked = rows.filter((product: any) => product.stock_quantity != null).length;
  const manufacturers = new Set(rows.map((product: any) => product.manufacturer).filter(Boolean)).size;

  return (
    <div className="app-page-v2 products-v2">
      <header className="products-v2-head">
        <div><div className="app-kicker-v2">{copy.kicker}</div><h1>{copy.title}</h1><p>{copy.description}</p></div>
        <Link href="/app/upload" className="products-v2-primary">{copy.update} <span aria-hidden="true">→</span></Link>
      </header>

      <section className="products-v2-summary" aria-label="Catalogue summary">
        <div><span>{copy.active}</span><strong>{totalCount ?? rows.length}</strong><small>{copy.matching}</small></div>
        <div><span>{copy.manufacturers}</span><strong>{manufacturers}</strong><small>{copy.currentView}</small></div>
        <div><span>{copy.pricing}</span><strong>{priced}</strong><small>{priced} / {rows.length} {copy.loaded}</small></div>
        <div><span>{copy.stockData}</span><strong>{stocked}</strong><small>{stocked} / {rows.length} {copy.loaded}</small></div>
      </section>

      <section className="products-v2-list">
        <div className="products-v2-list-head">
          <div><div className="upload-v2-section-label">{copy.rows}</div><h2>{copy.listTitle}</h2></div>
          <span>{copy.showing}</span>
        </div>

        {rows.length ? (
          <div className="products-v2-rows">
            {rows.map((product: any) => {
              const stock = product.stock_quantity == null ? null : Number(product.stock_quantity);
              const tone = stockTone(stock);
              const stockLabel = tone === "ready" ? copy.inStock : tone === "low" ? copy.lowStock : tone === "out" ? copy.outStock : copy.noStock;
              return (
                <article key={product.id} className="products-v2-row">
                  <div className="products-v2-identity">
                    <div className="products-v2-meta">
                      <span>{product.manufacturer || copy.manufacturerMissing}</span>
                      {product.manufacturer_part_number ? <span>MPN {product.manufacturer_part_number}</span> : null}
                    </div>
                    <h3>{product.sku}</h3><p>{product.name}</p>
                  </div>
                  <div className="products-v2-commercial"><span>{copy.unitPrice}</span><strong>{product.unit_price == null ? getDictionary(locale).common.notSet : money.format(Number(product.unit_price))}</strong><small>{product.unit || copy.unitMissing}</small></div>
                  <div className="products-v2-commercial"><span>{copy.stock}</span><strong>{stock == null ? getDictionary(locale).common.notSet : stock.toLocaleString(numberLocale)}</strong><small>{product.unit || copy.units}</small></div>
                  <div className={`products-v2-stock ${tone}`}>{stockLabel}</div>
                </article>
              );
            })}
          </div>
        ) : (
          <div className="products-v2-empty">
            <div className="upload-v2-section-label">{copy.empty}</div><h3>{copy.emptyTitle}</h3><p>{copy.emptyBody}</p>
            <Link href="/app/upload" className="products-v2-primary">{copy.import} <span aria-hidden="true">→</span></Link>
          </div>
        )}
      </section>
    </div>
  );
}
