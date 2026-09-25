import Link from "next/link";
import { requireWorkspace } from "@/lib/rivora/workspace";

const money = new Intl.NumberFormat("en-FI", { style: "currency", currency: "EUR" });

function stockTone(stock: number | null) {
  if (stock == null) return "unknown";
  if (stock <= 0) return "out";
  if (stock <= 20) return "low";
  return "ready";
}

export default async function ProductsPage() {
  const { supabase, workspace } = await requireWorkspace();

  const [{ data: products }, { count: totalCount }] = await Promise.all([
    supabase
      .from("products")
      .select("id, sku, manufacturer, manufacturer_part_number, name, unit, unit_price, stock_quantity")
      .eq("active", true)
      .order("sku")
      .limit(500),
    supabase
      .from("products")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", workspace.id)
      .eq("active", true),
  ]);

  const rows = products ?? [];
  const priced = rows.filter((product: any) => product.unit_price != null).length;
  const stocked = rows.filter((product: any) => product.stock_quantity != null).length;
  const manufacturers = new Set(
    rows.map((product: any) => product.manufacturer).filter(Boolean)
  ).size;

  return (
    <div className="app-page-v2 products-v2">
      <header className="products-v2-head">
        <div>
          <div className="app-kicker-v2">Product catalogue</div>
          <h1>Your canonical product source for every RFQ match.</h1>
          <p>
            Rivora resolves customer language against this catalogue. Re-importing an existing SKU updates
            commercial data without breaking learned customer mappings.
          </p>
        </div>

        <Link href="/app/upload" className="products-v2-primary">
          Update catalogue <span aria-hidden="true">→</span>
        </Link>
      </header>

      <section className="products-v2-summary" aria-label="Catalogue summary">
        <div>
          <span>Active products</span>
          <strong>{totalCount ?? rows.length}</strong>
          <small>available for matching</small>
        </div>
        <div>
          <span>Manufacturers</span>
          <strong>{manufacturers}</strong>
          <small>in current view</small>
        </div>
        <div>
          <span>With pricing</span>
          <strong>{priced}</strong>
          <small>of {rows.length} loaded rows</small>
        </div>
        <div>
          <span>With stock data</span>
          <strong>{stocked}</strong>
          <small>of {rows.length} loaded rows</small>
        </div>
      </section>

      <section className="products-v2-list">
        <div className="products-v2-list-head">
          <div>
            <div className="upload-v2-section-label">Catalogue rows</div>
            <h2>Products Rivora can resolve to.</h2>
          </div>
          <span>Showing up to 500 active products</span>
        </div>

        {rows.length ? (
          <div className="products-v2-rows">
            {rows.map((product: any) => {
              const stock = product.stock_quantity == null ? null : Number(product.stock_quantity);
              const tone = stockTone(stock);

              return (
                <article key={product.id} className="products-v2-row">
                  <div className="products-v2-identity">
                    <div className="products-v2-meta">
                      <span>{product.manufacturer || "Manufacturer not set"}</span>
                      {product.manufacturer_part_number ? (
                        <span>MPN {product.manufacturer_part_number}</span>
                      ) : null}
                    </div>
                    <h3>{product.sku}</h3>
                    <p>{product.name}</p>
                  </div>

                  <div className="products-v2-commercial">
                    <span>Unit price</span>
                    <strong>
                      {product.unit_price == null ? "Not set" : money.format(Number(product.unit_price))}
                    </strong>
                    <small>{product.unit || "unit not set"}</small>
                  </div>

                  <div className="products-v2-commercial">
                    <span>Stock</span>
                    <strong>{stock == null ? "Not set" : stock.toLocaleString("en-US")}</strong>
                    <small>{product.unit || "units"}</small>
                  </div>

                  <div className={`products-v2-stock ${tone}`}>
                    {tone === "ready"
                      ? "In stock"
                      : tone === "low"
                        ? "Low stock"
                        : tone === "out"
                          ? "Out of stock"
                          : "No stock data"}
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <div className="products-v2-empty">
            <div className="upload-v2-section-label">Catalogue empty</div>
            <h3>Import the products your team actually sells.</h3>
            <p>CSV or XLSX is enough to start. SKU and product name are required.</p>
            <Link href="/app/upload" className="products-v2-primary">
              Import catalogue <span aria-hidden="true">→</span>
            </Link>
          </div>
        )}
      </section>
    </div>
  );
}
