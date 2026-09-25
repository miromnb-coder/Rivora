import { requireWorkspace } from "@/lib/rivora/workspace";

function sourceLabel(source: string | null) {
  if (!source) return "Human confirmed";
  return String(source).replaceAll("_", " ");
}

export default async function MemoryPage() {
  const { supabase } = await requireWorkspace();

  const { data: mappings } = await supabase
    .from("customer_product_mappings")
    .select("id, customer_sku, customer_description, source, times_used, updated_at, customers(name), products(sku,name,manufacturer)")
    .order("updated_at", { ascending: false })
    .limit(500);

  const rows = mappings ?? [];
  const totalUses = rows.reduce(
    (sum: number, mapping: any) => sum + Number(mapping.times_used ?? 0),
    0
  );
  const customerNames = new Set(
    rows.map((mapping: any) => {
      const customer = Array.isArray(mapping.customers) ? mapping.customers[0] : mapping.customers;
      return customer?.name;
    }).filter(Boolean)
  );
  const reused = rows.filter((mapping: any) => Number(mapping.times_used ?? 0) > 1).length;

  return (
    <div className="app-page-v2 memory-app-v2">
      <header className="memory-app-v2-head">
        <div>
          <div className="app-kicker-v2">Customer memory</div>
          <h1>Every confirmed correction becomes reusable customer knowledge.</h1>
          <p>
            Rivora stores customer-specific product language as deterministic mappings.
            When the same code returns, the previous human decision can be reused instead of searched again.
          </p>
        </div>
      </header>

      <section className="memory-app-v2-summary" aria-label="Customer memory summary">
        <div>
          <span>Saved mappings</span>
          <strong>{rows.length}</strong>
          <small>customer-specific aliases</small>
        </div>
        <div>
          <span>Customers learned</span>
          <strong>{customerNames.size}</strong>
          <small>with saved product language</small>
        </div>
        <div>
          <span>Total uses</span>
          <strong>{totalUses}</strong>
          <small>mapping applications</small>
        </div>
        <div>
          <span>Reused mappings</span>
          <strong>{reused}</strong>
          <small>used more than once</small>
        </div>
      </section>

      <section className="memory-app-v2-list">
        <div className="memory-app-v2-list-head">
          <div>
            <div className="upload-v2-section-label">Learned mappings</div>
            <h2>Customer language → canonical product.</h2>
          </div>
          <span>Newest confirmations first</span>
        </div>

        {rows.length ? (
          <div className="memory-app-v2-rows">
            {rows.map((mapping: any) => {
              const customer = Array.isArray(mapping.customers)
                ? mapping.customers[0]
                : mapping.customers;
              const product = Array.isArray(mapping.products)
                ? mapping.products[0]
                : mapping.products;
              const uses = Number(mapping.times_used ?? 0);

              return (
                <article key={mapping.id} className="memory-app-v2-row">
                  <div className="memory-app-v2-customer">
                    <span>Customer</span>
                    <strong>{customer?.name ?? "Unknown customer"}</strong>
                    <small>{sourceLabel(mapping.source)}</small>
                  </div>

                  <div className="memory-app-v2-input">
                    <span>Customer language</span>
                    <h3>{mapping.customer_sku || "No customer SKU"}</h3>
                    <p>{mapping.customer_description || "No saved description"}</p>
                  </div>

                  <div className="memory-app-v2-arrow" aria-hidden="true">→</div>

                  <div className="memory-app-v2-product">
                    <span>Canonical product</span>
                    <h3>{product?.sku ?? "Product unavailable"}</h3>
                    <p>{product?.name ?? "Mapped product"}</p>
                    {product?.manufacturer ? <small>{product.manufacturer}</small> : null}
                  </div>

                  <div className="memory-app-v2-uses">
                    <span>Uses</span>
                    <strong>{uses}</strong>
                    <small>{uses > 1 ? "reused" : "learned once"}</small>
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <div className="memory-app-v2-empty">
            <div className="upload-v2-section-label">No memory yet</div>
            <h3>Customer memory grows from reviewed RFQs.</h3>
            <p>
              Confirm a product match in RFQ Review and keep “Remember this mapping for this customer” enabled.
            </p>
          </div>
        )}
      </section>

      <section className="memory-app-v2-explainer">
        <div>
          <span>1</span>
          <b>Human confirms</b>
          <small>A reviewer chooses the correct catalogue product.</small>
        </div>
        <i aria-hidden="true">→</i>
        <div>
          <span>2</span>
          <b>Mapping is saved</b>
          <small>Customer-specific SKU or language is linked deterministically.</small>
        </div>
        <i aria-hidden="true">→</i>
        <div>
          <span>3</span>
          <b>Next RFQ reuses it</b>
          <small>The known mapping can resolve before fuzzy matching is needed.</small>
        </div>
      </section>
    </div>
  );
}
