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
    <div className="app-page-v2 products-v2 ml-unified-page ml-unified-products">
      <header className="ml-page-head">
        <div className="ml-page-head-copy">
          <div className="ml-page-eyebrow">{locale === "fi" ? "Työtila / Tuotteet" : "Workspace / Products"}</div>
          <h1>{locale === "fi" ? "Tuotteet" : "Products"}</h1>
          <p>{locale === "fi" ? "Hallitse tuoteluetteloa, hintoja, varastotietoja ja tuotetunnisteita." : "Manage your catalogue, prices, inventory information and product identifiers."}</p>
        </div>
        <Link href="/app/upload" className="ml-page-primary">{copy.update}<span aria-hidden="true">→</span></Link>
      </header>

      <section className="ml-summary-section" aria-label={locale === "fi" ? "Tuotekatalogin yhteenveto" : "Product catalogue overview"}>
        <div className="ml-summary-grid">
          <div className="ml-summary-tile"><span>{copy.active}</span><strong>{totalCount ?? rows.length}</strong></div>
          <div className="ml-summary-tile"><span>{copy.manufacturers}</span><strong>{manufacturers}</strong></div>
          <div className="ml-summary-tile"><span>{copy.pricing}</span><strong>{priced}</strong></div>
          <div className="ml-summary-tile"><span>{copy.stockData}</span><strong>{stocked}</strong></div>
        </div>
        <p className="ml-page-footnote">{locale === "fi" ? "Valmistajien, hintojen ja varastotietojen yhteenveto perustuu enintään 500 ladattuun tuotteeseen." : "Manufacturer, pricing and stock summaries reflect up to 500 loaded products."}</p>
      </section>

      <section className="ml-unified-section" aria-labelledby="ml-products-list-title">
        <div className="ml-section-heading">
          <div><div className="ml-page-eyebrow">{copy.rows}</div><h2 id="ml-products-list-title">{locale === "fi" ? "Tuoteluettelo" : "Product list"}</h2></div>
          <span className="ml-order-count">{rows.length} {locale === "fi" ? "näkyvissä" : "shown"}</span>
        </div>
        {rows.length ? (
          <div className="ml-product-list">
            {rows.map((product: any) => {
              const stock = product.stock_quantity == null ? null : Number(product.stock_quantity);
              const tone = stockTone(stock);
              const stockLabel = tone === "ready" ? copy.inStock : tone === "low" ? copy.lowStock : tone === "out" ? copy.outStock : copy.noStock;
              return (
                <Link href={"/app/products/" + product.id} key={product.id} className="ml-product-item">
                  <div className="ml-product-main">
                    <strong>{product.sku}</strong>
                    <span>{product.name}</span>
                    <small>{product.manufacturer || copy.manufacturerMissing}{product.manufacturer_part_number ? " · MPN " + product.manufacturer_part_number : ""}</small>
                  </div>
                  <div className="ml-product-details">
                    <div><small>{copy.unitPrice}</small><strong>{product.unit_price == null ? getDictionary(locale).common.notSet : money.format(Number(product.unit_price))}</strong></div>
                    <div><small>{copy.stock}</small><strong>{stock == null ? getDictionary(locale).common.notSet : stock.toLocaleString(numberLocale)} <span>{product.unit || copy.units}</span></strong></div>
                    <span className={"ml-product-status is-" + tone}>{stockLabel}</span>
                  </div>
                  <span className="ml-row-arrow" aria-hidden="true">→</span>
                </Link>
              );
            })}
          </div>
        ) : (
          <div className="ml-page-empty">
            <strong>{copy.emptyTitle}</strong><p>{copy.emptyBody}</p>
            <Link href="/app/upload" className="ml-page-textlink">{copy.import} <span aria-hidden="true">→</span></Link>
          </div>
        )}
        <p className="ml-page-footnote">{locale === "fi" ? "Luettelossa näytetään enintään 500 aktiivista tuotetta." : "Up to 500 active products are shown."}</p>
      </section>
    </div>
  );
}
