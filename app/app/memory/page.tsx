import { requireWorkspace } from "@/lib/rivora/workspace";

export default async function MemoryPage() {
  const { supabase } = await requireWorkspace();
  const { data: mappings } = await supabase
    .from("customer_product_mappings")
    .select("id, customer_sku, customer_description, source, times_used, customers(name), products(sku,name)")
    .order("updated_at", { ascending: false })
    .limit(500);

  return (
    <div className="mx-auto max-w-6xl px-5 py-8 sm:px-8 lg:px-10 lg:py-10">
      <div className="kicker">Product memory</div>
      <h1 className="mt-2 text-3xl font-extrabold tracking-[-.035em]">Verified customer language becomes reusable data.</h1>
      <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--muted)]">
        Confirming a correction with “remember” creates a deterministic customer-specific mapping for future RFQs.
      </p>

      <div className="surface mt-7 overflow-hidden">
        {(mappings ?? []).length ? (
          <div className="divide-y divide-[var(--line)]">
            {(mappings ?? []).map((mapping: any) => {
              const customer = Array.isArray(mapping.customers) ? mapping.customers[0] : mapping.customers;
              const product = Array.isArray(mapping.products) ? mapping.products[0] : mapping.products;
              return (
                <div key={mapping.id} className="grid gap-3 px-5 py-4 text-sm sm:grid-cols-[1.5fr_1fr_1.5fr_.7fr] sm:items-center">
                  <div className="font-semibold">{customer?.name ?? "Unknown customer"}</div>
                  <div className="font-extrabold">{mapping.customer_sku}</div>
                  <div><div className="font-bold text-[var(--green)]">{product?.sku ?? "—"}</div><div className="mt-1 text-xs text-[var(--muted)]">{product?.name ?? mapping.customer_description ?? ""}</div></div>
                  <div><span className="status green">{mapping.times_used} uses</span></div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="px-5 py-12 text-center text-sm text-[var(--muted)]">No learned mappings yet. Confirm a reviewed RFQ line and choose “remember for customer”.</div>
        )}
      </div>
    </div>
  );
}
