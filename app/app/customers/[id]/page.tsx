import Link from "next/link";
import { notFound } from "next/navigation";
import { requireWorkspace } from "@/lib/rivora/workspace";
import { addCustomerContact, deleteCustomerContact, setPrimaryContact } from "../actions";

function statusLabel(value: string) {
  return value.replaceAll("_", " ");
}

export default async function CustomerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, workspace } = await requireWorkspace();

  const { data: customer } = await supabase
    .from("customers")
    .select("id,name,external_id,email_domain,created_at")
    .eq("id", id)
    .eq("organization_id", workspace.id)
    .maybeSingle();

  if (!customer) notFound();

  const [{ data: contacts }, { data: quotes }, { data: rfqs }, { data: mappings }] = await Promise.all([
    supabase.from("customer_contacts").select("id,name,email,phone,title,is_primary,created_at").eq("customer_id", id).order("is_primary", { ascending: false }).order("name"),
    supabase.from("quotes").select("id,quote_number,status,currency,created_at,valid_until,sent_at,delivery_status").eq("customer_id", id).order("created_at", { ascending: false }).limit(100),
    supabase.from("rfqs").select("id,reference,status,source_type,received_at,overall_confidence").eq("customer_id", id).order("received_at", { ascending: false }).limit(100),
    supabase.from("customer_product_mappings").select("id,customer_sku,customer_description,times_used,source,updated_at,products(sku,name,manufacturer)").eq("customer_id", id).order("updated_at", { ascending: false }).limit(200),
  ]);

  return (
    <div className="app-page-v2">
      <div className="mb-5"><Link href="/app/customers" className="text-sm font-semibold">← Customers</Link></div>

      <header className="mb-8">
        <div className="app-kicker-v2">Customer profile</div>
        <h1 className="mt-2 text-4xl font-extrabold tracking-[-.04em]">{customer.name}</h1>
        <p className="mt-2 text-sm text-[var(--muted)]">
          {customer.external_id || "No external ID"}{customer.email_domain ? ` · ${customer.email_domain}` : ""}
        </p>
      </header>

      <div className="grid gap-6 xl:grid-cols-[360px_1fr]">
        <aside className="space-y-6">
          <section className="surface p-6">
            <div className="upload-v2-section-label">Contacts</div>
            <div className="mt-4 space-y-3">
              {(contacts ?? []).map((contact) => (
                <article key={contact.id} className="rounded-xl border border-[var(--line)] p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <strong>{contact.name}</strong>
                      {contact.is_primary ? <span className="ml-2 rounded-full bg-[var(--green-soft)] px-2 py-1 text-[10px] font-bold text-[var(--green)]">PRIMARY</span> : null}
                      <p className="mt-1 text-sm text-[var(--muted)]">{contact.title || "Contact"}</p>
                    </div>
                  </div>
                  <a href={`mailto:${contact.email}`} className="mt-3 block text-sm font-semibold">{contact.email}</a>
                  {contact.phone ? <p className="mt-1 text-sm text-[var(--muted)]">{contact.phone}</p> : null}
                  <div className="mt-3 flex gap-2">
                    {!contact.is_primary ? (
                      <form action={setPrimaryContact}>
                        <input type="hidden" name="customerId" value={customer.id} />
                        <input type="hidden" name="contactId" value={contact.id} />
                        <button className="text-xs font-semibold">Make primary</button>
                      </form>
                    ) : null}
                    <form action={deleteCustomerContact}>
                      <input type="hidden" name="customerId" value={customer.id} />
                      <input type="hidden" name="contactId" value={contact.id} />
                      <button className="text-xs font-semibold text-[var(--red)]">Remove</button>
                    </form>
                  </div>
                </article>
              ))}
              {!(contacts ?? []).length ? <p className="text-sm text-[var(--muted)]">No saved contacts yet.</p> : null}
            </div>

            <form action={addCustomerContact} className="mt-6 grid gap-3 border-t border-[var(--line)] pt-5">
              <input type="hidden" name="customerId" value={customer.id} />
              <input name="name" required placeholder="Contact name" className="rounded-xl border border-[var(--line)] px-3 py-3" />
              <input name="email" type="email" required placeholder="Email" className="rounded-xl border border-[var(--line)] px-3 py-3" />
              <input name="title" placeholder="Title / role" className="rounded-xl border border-[var(--line)] px-3 py-3" />
              <input name="phone" placeholder="Phone" className="rounded-xl border border-[var(--line)] px-3 py-3" />
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="isPrimary" /> Primary quote recipient</label>
              <button className="btn-primary">Add contact</button>
            </form>
          </section>
        </aside>

        <main className="space-y-6">
          <section className="surface overflow-hidden">
            <div className="border-b border-[var(--line)] p-5">
              <div className="upload-v2-section-label">Quote history</div>
              <h2 className="mt-1 text-xl font-bold">{quotes?.length ?? 0} quotes</h2>
            </div>
            {(quotes ?? []).length ? (
              <div className="divide-y divide-[var(--line)]">
                {(quotes ?? []).map((quote) => (
                  <Link key={quote.id} href={`/app/quotes/${quote.id}`} className="grid gap-3 p-4 hover:bg-black/[.025] md:grid-cols-[1fr_120px_140px_30px] md:items-center">
                    <div><strong>{quote.quote_number || "Draft quote"}</strong><p className="text-xs text-[var(--muted)]">{new Date(quote.created_at).toLocaleDateString("fi-FI")}</p></div>
                    <span className="text-sm capitalize">{statusLabel(quote.status)}</span>
                    <span className="text-sm capitalize">{quote.delivery_status ? statusLabel(quote.delivery_status) : "Not sent"}</span>
                    <span>→</span>
                  </Link>
                ))}
              </div>
            ) : <p className="p-5 text-sm text-[var(--muted)]">No quotes yet.</p>}
          </section>

          <section className="surface overflow-hidden">
            <div className="border-b border-[var(--line)] p-5">
              <div className="upload-v2-section-label">RFQ history</div>
              <h2 className="mt-1 text-xl font-bold">{rfqs?.length ?? 0} requests</h2>
            </div>
            {(rfqs ?? []).length ? (
              <div className="divide-y divide-[var(--line)]">
                {(rfqs ?? []).map((rfq) => (
                  <Link key={rfq.id} href={`/app/rfq/${rfq.id}`} className="grid gap-3 p-4 hover:bg-black/[.025] md:grid-cols-[1fr_120px_120px_30px] md:items-center">
                    <div><strong>{rfq.reference || "Untitled RFQ"}</strong><p className="text-xs text-[var(--muted)]">{new Date(rfq.received_at).toLocaleString("fi-FI")}</p></div>
                    <span className="text-sm uppercase">{rfq.source_type}</span>
                    <span className="text-sm capitalize">{statusLabel(rfq.status)}</span>
                    <span>→</span>
                  </Link>
                ))}
              </div>
            ) : <p className="p-5 text-sm text-[var(--muted)]">No RFQs yet.</p>}
          </section>

          <section className="surface overflow-hidden">
            <div className="border-b border-[var(--line)] p-5">
              <div className="upload-v2-section-label">Customer memory</div>
              <h2 className="mt-1 text-xl font-bold">{mappings?.length ?? 0} learned mappings</h2>
            </div>
            {(mappings ?? []).length ? (
              <div className="divide-y divide-[var(--line)]">
                {(mappings ?? []).map((mapping: any) => {
                  const product = Array.isArray(mapping.products) ? mapping.products[0] : mapping.products;
                  return (
                    <div key={mapping.id} className="grid gap-4 p-4 md:grid-cols-[1fr_30px_1fr_100px] md:items-center">
                      <div><span className="text-xs text-[var(--muted)]">Customer language</span><strong className="block">{mapping.customer_sku || "No SKU"}</strong><p className="text-sm text-[var(--muted)]">{mapping.customer_description || "No description"}</p></div>
                      <span>→</span>
                      <div><span className="text-xs text-[var(--muted)]">Canonical product</span><strong className="block">{product?.sku || "Unavailable"}</strong><p className="text-sm text-[var(--muted)]">{product?.name || ""}</p></div>
                      <div><span className="text-xs text-[var(--muted)]">Uses</span><strong className="block text-xl">{Number(mapping.times_used ?? 0)}</strong></div>
                    </div>
                  );
                })}
              </div>
            ) : <p className="p-5 text-sm text-[var(--muted)]">No learned product mappings yet.</p>}
          </section>
        </main>
      </div>
    </div>
  );
}
