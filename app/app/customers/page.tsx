import Link from "next/link";
import { requireWorkspace } from "@/lib/rivora/workspace";
import { createCustomer } from "./actions";

export default async function CustomersPage() {
  const { supabase, workspace } = await requireWorkspace();

  const { data: customers } = await supabase
    .from("customers")
    .select("id,name,external_id,email_domain,created_at")
    .eq("organization_id", workspace.id)
    .order("name")
    .limit(500);

  const rows = await Promise.all(
    (customers ?? []).map(async (customer) => {
      const [{ count: contactCount }, { count: quoteCount }, { count: rfqCount }, { count: memoryCount }] =
        await Promise.all([
          supabase.from("customer_contacts").select("id", { count: "exact", head: true }).eq("customer_id", customer.id),
          supabase.from("quotes").select("id", { count: "exact", head: true }).eq("customer_id", customer.id),
          supabase.from("rfqs").select("id", { count: "exact", head: true }).eq("customer_id", customer.id),
          supabase.from("customer_product_mappings").select("id", { count: "exact", head: true }).eq("customer_id", customer.id),
        ]);

      return {
        ...customer,
        contactCount: contactCount ?? 0,
        quoteCount: quoteCount ?? 0,
        rfqCount: rfqCount ?? 0,
        memoryCount: memoryCount ?? 0,
      };
    })
  );

  return (
    <div className="app-page-v2">
      <header className="mb-8 flex flex-wrap items-end justify-between gap-6">
        <div className="max-w-3xl">
          <div className="app-kicker-v2">Customer CRM</div>
          <h1 className="mt-2 text-4xl font-extrabold tracking-[-.04em]">Customers, commercial history and memory in one place.</h1>
          <p className="mt-3 text-sm leading-6 text-[var(--muted)]">
            Every RFQ, quote, contact and learned product mapping stays attached to the customer that created it.
          </p>
        </div>
      </header>

      <section className="surface mb-6 p-6">
        <div className="upload-v2-section-label">Add customer</div>
        <form action={createCustomer} className="mt-4 grid gap-3 md:grid-cols-[2fr_1fr_1fr_auto]">
          <input name="name" required placeholder="Customer company name" className="rounded-xl border border-[var(--line)] px-3 py-3" />
          <input name="externalId" placeholder="ERP/customer ID" className="rounded-xl border border-[var(--line)] px-3 py-3" />
          <input name="emailDomain" placeholder="customer.com" className="rounded-xl border border-[var(--line)] px-3 py-3" />
          <button className="btn-primary">Add customer</button>
        </form>
      </section>

      <section className="surface overflow-hidden">
        <div className="border-b border-[var(--line)] p-6">
          <div className="upload-v2-section-label">Customers</div>
          <h2 className="mt-1 text-2xl font-bold">{rows.length} customer{rows.length === 1 ? "" : "s"}</h2>
        </div>

        {rows.length ? (
          <div className="divide-y divide-[var(--line)]">
            {rows.map((customer) => (
              <Link key={customer.id} href={`/app/customers/${customer.id}`} className="grid gap-4 p-5 transition hover:bg-black/[.025] md:grid-cols-[2fr_repeat(4,110px)_40px] md:items-center">
                <div>
                  <h3 className="font-bold">{customer.name}</h3>
                  <p className="mt-1 text-sm text-[var(--muted)]">
                    {customer.external_id || "No external ID"}{customer.email_domain ? ` · ${customer.email_domain}` : ""}
                  </p>
                </div>
                <div><span className="text-xs text-[var(--muted)]">Contacts</span><strong className="block text-lg">{customer.contactCount}</strong></div>
                <div><span className="text-xs text-[var(--muted)]">Quotes</span><strong className="block text-lg">{customer.quoteCount}</strong></div>
                <div><span className="text-xs text-[var(--muted)]">RFQs</span><strong className="block text-lg">{customer.rfqCount}</strong></div>
                <div><span className="text-xs text-[var(--muted)]">Memory</span><strong className="block text-lg">{customer.memoryCount}</strong></div>
                <span aria-hidden="true">→</span>
              </Link>
            ))}
          </div>
        ) : (
          <div className="p-8">
            <div className="upload-v2-section-label">No customers yet</div>
            <h3 className="mt-2 text-2xl font-bold">The first processed RFQ can create the first customer automatically.</h3>
            <p className="mt-2 text-sm text-[var(--muted)]">You can also add a customer above before the first RFQ arrives.</p>
          </div>
        )}
      </section>
    </div>
  );
}
