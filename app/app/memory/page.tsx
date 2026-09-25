import { requireWorkspace } from "@/lib/rivora/workspace";
import { getLocale } from "@/lib/locale";
import { getMemoryCopy } from "@/lib/i18n/extra";

export default async function MemoryPage() {
  const [{ supabase }, locale] = await Promise.all([requireWorkspace(), getLocale()]);
  const copy = getMemoryCopy(locale);

  const { data: mappings } = await supabase
    .from("customer_product_mappings")
    .select("id, customer_sku, customer_description, source, times_used, updated_at, customers(name), products(sku,name,manufacturer)")
    .order("updated_at", { ascending: false })
    .limit(500);

  const rows = mappings ?? [];
  const totalUses = rows.reduce((sum: number, mapping: any) => sum + Number(mapping.times_used ?? 0), 0);
  const customerNames = new Set(rows.map((mapping: any) => {
    const customer = Array.isArray(mapping.customers) ? mapping.customers[0] : mapping.customers;
    return customer?.name;
  }).filter(Boolean));
  const reused = rows.filter((mapping: any) => Number(mapping.times_used ?? 0) > 1).length;

  return (
    <div className="app-page-v2 memory-app-v2">
      <header className="memory-app-v2-head">
        <div><div className="app-kicker-v2">{copy.kicker}</div><h1>{copy.title}</h1><p>{copy.description}</p></div>
      </header>

      <section className="memory-app-v2-summary" aria-label="Customer memory summary">
        <div><span>{copy.saved}</span><strong>{rows.length}</strong><small>{copy.aliases}</small></div>
        <div><span>{copy.learned}</span><strong>{customerNames.size}</strong><small>{copy.language}</small></div>
        <div><span>{copy.totalUses}</span><strong>{totalUses}</strong><small>{copy.applications}</small></div>
        <div><span>{copy.reused}</span><strong>{reused}</strong><small>{copy.moreThanOnce}</small></div>
      </section>

      <section className="memory-app-v2-list">
        <div className="memory-app-v2-list-head">
          <div><div className="upload-v2-section-label">{copy.mappings}</div><h2>{copy.listTitle}</h2></div>
          <span>{copy.newest}</span>
        </div>

        {rows.length ? (
          <div className="memory-app-v2-rows">
            {rows.map((mapping: any) => {
              const customer = Array.isArray(mapping.customers) ? mapping.customers[0] : mapping.customers;
              const product = Array.isArray(mapping.products) ? mapping.products[0] : mapping.products;
              const uses = Number(mapping.times_used ?? 0);
              return (
                <article key={mapping.id} className="memory-app-v2-row">
                  <div className="memory-app-v2-customer"><span>{copy.customer}</span><strong>{customer?.name ?? copy.unknown}</strong><small>{mapping.source ? String(mapping.source).replaceAll("_", " ") : copy.human}</small></div>
                  <div className="memory-app-v2-input"><span>{copy.customerLanguage}</span><h3>{mapping.customer_sku || copy.noSku}</h3><p>{mapping.customer_description || copy.noDescription}</p></div>
                  <div className="memory-app-v2-arrow" aria-hidden="true">→</div>
                  <div className="memory-app-v2-product"><span>{copy.canonical}</span><h3>{product?.sku ?? copy.unavailable}</h3><p>{product?.name ?? copy.mapped}</p>{product?.manufacturer ? <small>{product.manufacturer}</small> : null}</div>
                  <div className="memory-app-v2-uses"><span>{copy.uses}</span><strong>{uses}</strong><small>{uses > 1 ? copy.reusedLabel : copy.once}</small></div>
                </article>
              );
            })}
          </div>
        ) : (
          <div className="memory-app-v2-empty">
            <div className="upload-v2-section-label">{copy.empty}</div><h3>{copy.emptyTitle}</h3><p>{copy.emptyBody}</p>
          </div>
        )}
      </section>

      <section className="memory-app-v2-explainer">
        <div><span>1</span><b>{copy.humanConfirms}</b><small>{copy.humanCopy}</small></div><i aria-hidden="true">→</i>
        <div><span>2</span><b>{copy.savedTitle}</b><small>{copy.savedCopy}</small></div><i aria-hidden="true">→</i>
        <div><span>3</span><b>{copy.reuseTitle}</b><small>{copy.reuseCopy}</small></div>
      </section>
    </div>
  );
}
