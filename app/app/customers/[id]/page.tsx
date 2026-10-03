import Link from "next/link";
import { notFound } from "next/navigation";
import { requireWorkspace } from "@/lib/rivora/workspace";
import { addCustomerContact, deleteCustomerContact, setPrimaryContact, updateCustomer } from "../actions";
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

export default async function CustomerDetailPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ saved?: string }> }) {
  const [{ id }, query, locale, context] = await Promise.all([params, searchParams, getLocale(), requireWorkspace()]);
  const { supabase, workspace } = context;
  const fi = locale === "fi";
  const displayLocale = formatLocale(locale);
  const text = {
    customers: fi ? "Asiakkaat" : "Customers", profile: fi ? "Asiakasprofiili" : "Customer profile",
    noExternal: fi ? "Ei ulkoista tunnusta" : "No external ID", contacts: fi ? "Yhteyshenkilöt" : "Contacts",
    primary: fi ? "ENSISIJAINEN" : "PRIMARY", contact: fi ? "Yhteyshenkilö" : "Contact",
    makePrimary: fi ? "Aseta ensisijaiseksi" : "Make primary", remove: fi ? "Poista" : "Remove",
    noContacts: fi ? "Ei tallennettuja yhteyshenkilöitä vielä." : "No saved contacts yet.",
    contactName: fi ? "Yhteyshenkilön nimi" : "Contact name", email: fi ? "Sähköposti" : "Email",
    titleRole: fi ? "Tehtävänimike / rooli" : "Title / role", phone: fi ? "Puhelin" : "Phone",
    primaryRecipient: fi ? "Ensisijainen tarjouksen vastaanottaja" : "Primary quote recipient",
    addContact: fi ? "Lisää yhteyshenkilö" : "Add contact", quoteHistory: fi ? "Tarjoushistoria" : "Quote history",
    quotes: fi ? "tarjousta" : "quotes", draftQuote: fi ? "Tarjousluonnos" : "Draft quote",
    notSent: fi ? "Ei lähetetty" : "Not sent", noQuotes: fi ? "Ei tarjouksia vielä." : "No quotes yet.",
    rfqHistory: fi ? "Tarjouspyyntöhistoria" : "RFQ history", requests: fi ? "pyyntöä" : "requests",
    untitledRfq: fi ? "Nimetön tarjouspyyntö" : "Untitled RFQ", noRfqs: fi ? "Ei tarjouspyyntöjä vielä." : "No RFQs yet.",
    memory: fi ? "Asiakaskohtainen muisti" : "Customer memory", mappings: fi ? "opittua vastinetta" : "learned mappings",
    customerLanguage: fi ? "Asiakkaan tuotekieli" : "Customer language", noSku: fi ? "Ei SKU:ta" : "No SKU",
    noDescription: fi ? "Ei kuvausta" : "No description", canonical: fi ? "Kanoninen tuote" : "Canonical product",
    unavailable: fi ? "Ei saatavilla" : "Unavailable", uses: fi ? "Käytöt" : "Uses",
    noMappings: fi ? "Ei opittuja tuotevastineita vielä." : "No learned product mappings yet.",
    details: fi ? "Asiakastiedot" : "Customer details", save: fi ? "Tallenna tiedot" : "Save details",
    saved: fi ? "Asiakastiedot tallennettiin." : "Customer details saved.",
    externalId: fi ? "ERP-/asiakastunnus" : "ERP / customer ID", domain: fi ? "Sähköpostidomain" : "Email domain",
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
    <div className="app-page-v2 customer-detail-page">
      <div className="mb-5">
        <Link href="/app/customers" className="text-[13px] font-semibold text-[#5f645f] hover:text-[var(--app-ink)]">
          ← {text.customers}
        </Link>
      </div>

      <header className="mb-7 max-w-[760px]">
        <div className="app-kicker-v2">{text.profile}</div>
        <h1 className="mt-2 break-words !text-[34px] !font-semibold !leading-10 tracking-[-.035em] max-lg:!text-[30px] max-lg:!leading-9">
          {customer.name}
        </h1>
        <p className="mt-2 break-words text-[13px] leading-5 text-[var(--muted)]">
          {customer.external_id || text.noExternal}{customer.email_domain ? ` · ${customer.email_domain}` : ""}
        </p>
      </header>

      {query.saved ? (
        <div className="mb-5 rounded-xl border border-[#dfe7df] bg-[#f7faf7] p-4 text-sm text-[#426048]">
          {text.saved}
        </div>
      ) : null}

      <section className="mb-[30px] border-y border-[var(--app-line)] py-5 max-sm:mb-[26px] max-sm:py-[18px]">
        <div className="mb-3.5">
          <div className="upload-v2-section-label">{text.details}</div>
          <h2 className="mt-1 text-lg font-semibold leading-6 tracking-[-.018em]">{text.details}</h2>
        </div>
        <form
          action={updateCustomer}
          className="grid gap-2.5 md:grid-cols-2 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)_minmax(0,1fr)_auto] lg:items-end"
        >
          <input type="hidden" name="customerId" value={customer.id} />
          <label>
            <span className="settings-field-label !text-[10px] !font-semibold !tracking-[.035em] !text-[#6e736f]">
              {fi ? "Asiakasyrityksen nimi" : "Customer company name"}
            </span>
            <input name="name" required defaultValue={customer.name} />
          </label>
          <label>
            <span className="settings-field-label !text-[10px] !font-semibold !tracking-[.035em] !text-[#6e736f]">
              {text.externalId}
            </span>
            <input name="externalId" defaultValue={customer.external_id || ""} />
          </label>
          <label>
            <span className="settings-field-label !text-[10px] !font-semibold !tracking-[.035em] !text-[#6e736f]">
              {text.domain}
            </span>
            <input name="emailDomain" defaultValue={customer.email_domain || ""} placeholder="customer.com" />
          </label>
          <button className="btn-primary max-sm:w-full md:justify-self-start lg:justify-self-auto">
            {text.save}
          </button>
        </form>
      </section>

      <div className="grid items-start gap-[30px] xl:grid-cols-[360px_minmax(0,1fr)]">
        <aside>
          <section className="min-w-0 border-t border-[var(--app-line)] pt-[18px]">
            <div className="upload-v2-section-label">{text.contacts}</div>
            <div className="mt-2.5">
              {(contacts ?? []).map((contact) => (
                <article key={contact.id} className="border-t border-[#ecede9] py-3.5 first:border-t-0">
                  <div className="min-w-0">
                    <strong className="break-words text-sm font-semibold leading-5 text-[var(--app-ink)]">
                      {contact.name}
                    </strong>
                    {contact.is_primary ? (
                      <span className="ml-2 rounded-full bg-[var(--green-soft)] px-2 py-1 text-[10px] font-bold text-[var(--green)]">
                        {text.primary}
                      </span>
                    ) : null}
                    <p className="mt-0.5 break-words text-[11px] leading-4 text-[var(--muted)]">
                      {contact.title || text.contact}
                    </p>
                  </div>

                  <a
                    href={`mailto:${contact.email}`}
                    className="mt-2 block break-words text-xs font-semibold leading-[18px] text-[#3b403c]"
                  >
                    {contact.email}
                  </a>

                  {contact.phone ? (
                    <p className="mt-0.5 break-words text-[11px] leading-4 text-[var(--muted)]">{contact.phone}</p>
                  ) : null}

                  <div className="mt-2.5 flex flex-wrap gap-2.5">
                    {!contact.is_primary ? (
                      <form action={setPrimaryContact}>
                        <input type="hidden" name="customerId" value={customer.id} />
                        <input type="hidden" name="contactId" value={contact.id} />
                        <button className="text-[11px] font-semibold">{text.makePrimary}</button>
                      </form>
                    ) : null}
                    <form action={deleteCustomerContact}>
                      <input type="hidden" name="customerId" value={customer.id} />
                      <input type="hidden" name="contactId" value={contact.id} />
                      <button className="text-[11px] font-semibold text-[var(--red)]">{text.remove}</button>
                    </form>
                  </div>
                </article>
              ))}

              {!(contacts ?? []).length ? (
                <p className="py-3 text-xs text-[var(--muted)]">{text.noContacts}</p>
              ) : null}
            </div>

            <form action={addCustomerContact} className="mt-1.5 grid gap-2.5 border-t border-[var(--app-line)] pt-[18px]">
              <input type="hidden" name="customerId" value={customer.id} />
              <input name="name" required placeholder={text.contactName} className="w-full min-w-0" />
              <input name="email" type="email" required placeholder={text.email} className="w-full min-w-0" />
              <input name="title" placeholder={text.titleRole} className="w-full min-w-0" />
              <input name="phone" placeholder={text.phone} className="w-full min-w-0" />
              <label className="flex items-start gap-2 text-[11px] leading-4 text-[var(--muted)]">
                <input type="checkbox" name="isPrimary" className="mt-0.5" />
                {text.primaryRecipient}
              </label>
              <button className="btn-primary max-sm:w-full">{text.addContact}</button>
            </form>
          </section>
        </aside>

        <main className="grid min-w-0 gap-8 max-sm:gap-7">
          <section className="min-w-0">
            <div className="border-b border-[var(--app-line)] pb-3">
              <div className="upload-v2-section-label">{text.quoteHistory}</div>
              <h2 className="mt-1 text-lg font-semibold leading-6 tracking-[-.018em]">
                {quotes?.length ?? 0} {text.quotes}
              </h2>
            </div>

            {(quotes ?? []).length ? (
              <div className="min-w-0">
                {(quotes ?? []).map((quote) => (
                  <Link
                    key={quote.id}
                    href={`/app/quotes/${quote.id}`}
                    className="group grid min-h-16 grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1.5 border-b border-[#ecede9] px-0.5 py-3 transition hover:bg-white/70 md:grid-cols-[minmax(0,1fr)_120px_140px_20px] md:gap-4"
                  >
                    <div className="min-w-0">
                      <strong className="block truncate text-sm font-semibold leading-5 text-[var(--app-ink)]">
                        {quote.quote_number || text.draftQuote}
                      </strong>
                      <p className="mt-0.5 text-[11px] leading-4 text-[var(--muted)]">
                        {new Date(quote.created_at).toLocaleDateString(displayLocale)}
                      </p>
                    </div>
                    <span className="text-xs font-medium leading-[18px] text-[#686d69] capitalize">
                      {statusLabel(quote.status, fi)}
                    </span>
                    <span className="text-xs font-medium leading-[18px] text-[#686d69] capitalize">
                      {quote.delivery_status ? statusLabel(quote.delivery_status, fi) : text.notSent}
                    </span>
                    <span className="justify-self-end text-[#8e938f] transition group-hover:translate-x-0.5 group-hover:text-[var(--app-ink)]">
                      →
                    </span>
                  </Link>
                ))}
              </div>
            ) : (
              <p className="px-0.5 py-4 text-xs text-[var(--muted)]">{text.noQuotes}</p>
            )}
          </section>

          <section className="min-w-0">
            <div className="border-b border-[var(--app-line)] pb-3">
              <div className="upload-v2-section-label">{text.rfqHistory}</div>
              <h2 className="mt-1 text-lg font-semibold leading-6 tracking-[-.018em]">
                {rfqs?.length ?? 0} {text.requests}
              </h2>
            </div>

            {(rfqs ?? []).length ? (
              <div className="min-w-0">
                {(rfqs ?? []).map((rfq) => (
                  <Link
                    key={rfq.id}
                    href={`/app/rfq/${rfq.id}`}
                    className="group grid min-h-16 grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1.5 border-b border-[#ecede9] px-0.5 py-3 transition hover:bg-white/70 md:grid-cols-[minmax(0,1fr)_110px_120px_20px] md:gap-4"
                  >
                    <div className="min-w-0">
                      <strong className="block truncate text-sm font-semibold leading-5 text-[var(--app-ink)]">
                        {rfq.reference || text.untitledRfq}
                      </strong>
                      <p className="mt-0.5 text-[11px] leading-4 text-[var(--muted)]">
                        {new Date(rfq.received_at).toLocaleString(displayLocale)}
                      </p>
                    </div>
                    <span className="text-xs font-medium uppercase leading-[18px] text-[#686d69]">
                      {rfq.source_type}
                    </span>
                    <span className="text-xs font-medium leading-[18px] text-[#686d69] capitalize">
                      {statusLabel(rfq.status, fi)}
                    </span>
                    <span className="justify-self-end text-[#8e938f] transition group-hover:translate-x-0.5 group-hover:text-[var(--app-ink)]">→</span>
                  </Link>
                ))}
              </div>
            ) : (
              <p className="px-0.5 py-4 text-xs text-[var(--muted)]">{text.noRfqs}</p>
            )}
          </section>

          <section className="min-w-0">
            <div className="border-b border-[var(--app-line)] pb-3">
              <div className="upload-v2-section-label">{text.memory}</div>
              <h2 className="mt-1 text-lg font-semibold leading-6 tracking-[-.018em]">
                {mappings?.length ?? 0} {text.mappings}
              </h2>
            </div>

            {(mappings ?? []).length ? (
              <div className="min-w-0">
                {(mappings ?? []).map((mapping: any) => {
                  const product = Array.isArray(mapping.products) ? mapping.products[0] : mapping.products;
                  return (
                    <div
                      key={mapping.id}
                      className="grid min-h-[72px] grid-cols-[1fr_auto] items-center gap-x-3.5 gap-y-2.5 border-b border-[#ecede9] px-0.5 py-[13px] md:grid-cols-[minmax(0,1fr)_20px_minmax(0,1fr)_80px] md:gap-4"
                    >
                      <div className="min-w-0">
                        <span className="block text-[10px] font-semibold leading-[14px] text-[#858a86]">{text.customerLanguage}</span>
                        <strong className="mt-0.5 block break-words text-[13px] font-semibold leading-[18px] text-[var(--app-ink)]">
                          {mapping.customer_sku || text.noSku}
                        </strong>
                        <p className="mt-0.5 break-words text-[11px] leading-4 text-[var(--muted)]">
                          {mapping.customer_description || text.noDescription}
                        </p>
                      </div>

                      <span className="justify-self-end text-[#8e938f]">→</span>

                      <div className="min-w-0">
                        <span className="block text-[10px] font-semibold leading-[14px] text-[#858a86]">{text.canonical}</span>
                        <strong className="mt-0.5 block break-words text-[13px] font-semibold leading-[18px] text-[var(--app-ink)]">
                          {product?.sku || text.unavailable}
                        </strong>
                        <p className="mt-0.5 break-words text-[11px] leading-4 text-[var(--muted)]">{product?.name || ""}</p>
                      </div>

                      <div className="text-right md:text-left">
                        <span className="block text-[10px] font-semibold leading-[14px] text-[#858a86]">{text.uses}</span>
                        <strong className="mt-0.5 block text-[18px] font-semibold leading-6 text-[var(--app-ink)]">
                          {Number(mapping.times_used ?? 0)}
                        </strong>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="px-0.5 py-4 text-xs text-[var(--muted)]">{text.noMappings}</p>
            )}
          </section>
        </main>
      </div>
    </div>
  );
}
