import Link from "next/link";
import { notFound } from "next/navigation";
import { requireWorkspace } from "@/lib/rivora/workspace";
import { addCustomerContact, deleteCustomerContact, setPrimaryContact } from "../actions";
import { formatLocale, getLocale } from "@/lib/locale";

function statusLabel(value: string, fi: boolean) {
  const labels: Record<string, [string, string]> = {
    draft: ["Luonnos", "Draft"], ready: ["Valmis", "Ready"], approved: ["Hyväksytty", "Approved"],
    sent: ["Lähetetty", "Sent"], expired: ["Vanhentunut", "Expired"], delivered: ["Toimitettu", "Delivered"],
    bounced: ["Palautunut", "Bounced"], failed: ["Epäonnistui", "Failed"], needs_review: ["Vaatii tarkistuksen", "Needs review"],
    quoted: ["Tarjottu", "Quoted"],
  };
  return labels[value]?.[fi ? 0 : 1] ?? value.replaceAll("_", " ");
}

export default async function CustomerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const [{ id }, locale, context] = await Promise.all([params, getLocale(), requireWorkspace()]);
  const { supabase, workspace } = context;
  const fi = locale === "fi";
  const displayLocale = formatLocale(locale);
  const text = {
    customers: fi ? "Asiakkaat" : "Customers", profile: fi ? "Asiakasprofiili" : "{text.profile}",
    noExternal: fi ? "Ei ulkoista tunnusta" : "No external ID", contacts: fi ? "Yhteyshenkilöt" : "Contacts",
    primary: fi ? "ENSISIJAINEN" : "PRIMARY", contact: fi ? "Yhteyshenkilö" : "Contact",
    makePrimary: fi ? "Aseta ensisijaiseksi" : "Make primary", remove: fi ? "Poista" : "Remove",
    noContacts: fi ? "Ei tallennettuja yhteyshenkilöitä vielä." : "{text.noContacts}",
    contactName: fi ? "Yhteyshenkilön nimi" : "Contact name", email: fi ? "Sähköposti" : "Email",
    titleRole: fi ? "Tehtävänimike / rooli" : "Title / role", phone: fi ? "Puhelin" : "Phone",
    primaryRecipient: fi ? "Ensisijainen tarjouksen vastaanottaja" : "Primary quote recipient",
    addContact: fi ? "Lisää yhteyshenkilö" : "Add contact", quoteHistory: fi ? "Tarjoushistoria" : "Quote history",
    quotes: fi ? "tarjousta" : "quotes", draftQuote: fi ? "Tarjousluonnos" : "Draft quote",
    notSent: fi ? "Ei lähetetty"  : text.notSent, noQuotes: fi ? "Ei tarjouksia vielä." : "{text.noQuotes}",
    rfqHistory: fi ? "Tarjouspyyntöhistoria" : "RFQ history", requests: fi ? "pyyntöä" : "requests",
    untitledRfq: fi ? "Nimetön tarjouspyyntö" : "Untitled RFQ", noRfqs: fi ? "Ei tarjouspyyntöjä vielä." : "{text.noRfqs}",
    memory: fi ? "Asiakaskohtainen muisti" : "Customer memory", mappings: fi ? "opittua vastinetta" : "learned mappings",
    customerLanguage: fi ? "Asiakkaan tuotekieli" : "Customer language", noSku: fi ? "Ei SKU:ta" : "No SKU",
    noDescription: fi ? "Ei kuvausta" : "No description", canonical: fi ? "Kanoninen tuote" : "Canonical product",
    unavailable: fi ? "Ei saatavilla" : "Unavailable", uses: fi ? "Käytöt" : "Uses",
    noMappings: fi ? "Ei opittuja tuotevastineita vielä." : "{text.noMappings}",
  };

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
      <div className="mb-5"><Link href="/app/customers" className="text-sm font-semibold">← {text.customers}</Link></div>

      <header className="mb-8">
        <div className="app-kicker-v2">{text.profile}</div>
        <h1 className="mt-2 text-4xl font-extrabold tracking-[-.04em]">{customer.name}</h1>
        <p className="mt-2 text-sm text-[var(--muted)]">
          {customer.external_id || text.noExternal}{customer.email_domain ? ` · ${customer.email_domain}` : ""}
        </p>
      </header>

      <div className="grid gap-6 xl:grid-cols-[360px_1fr]">
        <aside className="space-y-6">
          <section className="surface p-6">
            <div className="upload-v2-section-label">{text.contacts}</div>
            <div className="mt-4 space-y-3">
              {(contacts ?? []).map((contact) => (
                <article key={contact.id} className="rounded-xl border border-[var(--line)] p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <strong>{contact.name}</strong>
                      {contact.is_primary ? <span className="ml-2 rounded-full bg-[var(--green-soft)] px-2 py-1 text-[10px] font-bold text-[var(--green)]">{text.primary}</span> : null}
                      <p className="mt-1 text-sm text-[var(--muted)]">{contact.title || text.contact}</p>
                    </div>
                  </div>
                  <a href={`mailto:${contact.email}`} className="mt-3 block text-sm font-semibold">{contact.email}</a>
                  {contact.phone ? <p className="mt-1 text-sm text-[var(--muted)]">{contact.phone}</p> : null}
                  <div className="mt-3 flex gap-2">
                    {!contact.is_primary ? (
                      <form action={setPrimaryContact}>
                        <input type="hidden" name="customerId" value={customer.id} />
                        <input type="hidden" name="contactId" value={contact.id} />
                        <button className="text-xs font-semibold">{text.makePrimary}</button>
                      </form>
                    ) : null}
                    <form action={deleteCustomerContact}>
                      <input type="hidden" name="customerId" value={customer.id} />
                      <input type="hidden" name="contactId" value={contact.id} />
                      <button className="text-xs font-semibold text-[var(--red)]">{text.remove}</button>
                    </form>
                  </div>
                </article>
              ))}
              {!(contacts ?? []).length ? <p className="text-sm text-[var(--muted)]">{text.noContacts}</p> : null}
            </div>

            <form action={addCustomerContact} className="mt-6 grid gap-3 border-t border-[var(--line)] pt-5">
              <input type="hidden" name="customerId" value={customer.id} />
              <input name="name" required placeholder={text.contactName} className="rounded-xl border border-[var(--line)] px-3 py-3" />
              <input name="email" type="email" required placeholder={text.email} className="rounded-xl border border-[var(--line)] px-3 py-3" />
              <input name="title" placeholder={text.titleRole} className="rounded-xl border border-[var(--line)] px-3 py-3" />
              <input name="phone" placeholder={text.phone} className="rounded-xl border border-[var(--line)] px-3 py-3" />
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="isPrimary" /> {text.primaryRecipient}</label>
              <button className="btn-primary">{text.addContact}</button>
            </form>
          </section>
        </aside>

        <main className="space-y-6">
          <section className="surface overflow-hidden">
            <div className="border-b border-[var(--line)] p-5">
              <div className="upload-v2-section-label">{text.quoteHistory}</div>
              <h2 className="mt-1 text-xl font-bold">{quotes?.length ?? 0} {text.quotes}</h2>
            </div>
            {(quotes ?? []).length ? (
              <div className="divide-y divide-[var(--line)]">
                {(quotes ?? []).map((quote) => (
                  <Link key={quote.id} href={`/app/quotes/${quote.id}`} className="grid gap-3 p-4 hover:bg-black/[.025] md:grid-cols-[1fr_120px_140px_30px] md:items-center">
                    <div><strong>{quote.quote_number || text.draftQuote}</strong><p className="text-xs text-[var(--muted)]">{new Date(quote.created_at).toLocaleDateString(displayLocale)}</p></div>
                    <span className="text-sm capitalize">{statusLabel(quote.status, fi)}</span>
                    <span className="text-sm capitalize">{quote.delivery_status ? statusLabel(quote.delivery_status, fi)  : text.notSent}</span>
                    <span>→</span>
                  </Link>
                ))}
              </div>
            ) : <p className="p-5 text-sm text-[var(--muted)]">{text.noQuotes}</p>}
          </section>

          <section className="surface overflow-hidden">
            <div className="border-b border-[var(--line)] p-5">
              <div className="upload-v2-section-label">{text.rfqHistory}</div>
              <h2 className="mt-1 text-xl font-bold">{rfqs?.length ?? 0} {text.requests}</h2>
            </div>
            {(rfqs ?? []).length ? (
              <div className="divide-y divide-[var(--line)]">
                {(rfqs ?? []).map((rfq) => (
                  <Link key={rfq.id} href={`/app/rfq/${rfq.id}`} className="grid gap-3 p-4 hover:bg-black/[.025] md:grid-cols-[1fr_120px_120px_30px] md:items-center">
                    <div><strong>{rfq.reference || text.untitledRfq}</strong><p className="text-xs text-[var(--muted)]">{new Date(rfq.received_at).toLocaleString(displayLocale)}</p></div>
                    <span className="text-sm uppercase">{rfq.source_type}</span>
                    <span className="text-sm capitalize">{statusLabel(rfq.status, fi)}</span>
                    <span>→</span>
                  </Link>
                ))}
              </div>
            ) : <p className="p-5 text-sm text-[var(--muted)]">{text.noRfqs}</p>}
          </section>

          <section className="surface overflow-hidden">
            <div className="border-b border-[var(--line)] p-5">
              <div className="upload-v2-section-label">{text.memory}</div>
              <h2 className="mt-1 text-xl font-bold">{mappings?.length ?? 0} {text.mappings}</h2>
            </div>
            {(mappings ?? []).length ? (
              <div className="divide-y divide-[var(--line)]">
                {(mappings ?? []).map((mapping: any) => {
                  const product = Array.isArray(mapping.products) ? mapping.products[0] : mapping.products;
                  return (
                    <div key={mapping.id} className="grid gap-4 p-4 md:grid-cols-[1fr_30px_1fr_100px] md:items-center">
                      <div><span className="text-xs text-[var(--muted)]">{text.customerLanguage}</span><strong className="block">{mapping.customer_sku || text.noSku}</strong><p className="text-sm text-[var(--muted)]">{mapping.customer_description || text.noDescription}</p></div>
                      <span>→</span>
                      <div><span className="text-xs text-[var(--muted)]">{text.canonical}</span><strong className="block">{product?.sku || text.unavailable}</strong><p className="text-sm text-[var(--muted)]">{product?.name || ""}</p></div>
                      <div><span className="text-xs text-[var(--muted)]">{text.uses}</span><strong className="block text-xl">{Number(mapping.times_used ?? 0)}</strong></div>
                    </div>
                  );
                })}
              </div>
            ) : <p className="p-5 text-sm text-[var(--muted)]">{text.noMappings}</p>}
          </section>
        </main>
      </div>
    </div>
  );
}
