import Link from "next/link";
import { requireWorkspace } from "@/lib/rivora/workspace";
import { createCustomer } from "./actions";
import { getDictionary } from "@/lib/i18n";
import { getLocale } from "@/lib/locale";

export default async function CustomersPage() {
  const [{ supabase, workspace }, locale] = await Promise.all([requireWorkspace(), getLocale()]);
  const copy = getDictionary(locale).customers;
  const common = getDictionary(locale).common;

  const { data: customers } = await supabase
    .from("customers").select("id,name,external_id,email_domain,created_at, customer_contacts(count), quotes(count), rfqs(count), customer_product_mappings(count)")
    .eq("organization_id", workspace.id).order("name").limit(500);

  const relationCount = (value: unknown) =>
    Array.isArray(value) ? Number((value[0] as { count?: number } | undefined)?.count ?? 0) : 0;

  const rows = (customers ?? []).map((customer: any) => ({
    ...customer,
    contactCount: relationCount(customer.customer_contacts),
    quoteCount: relationCount(customer.quotes),
    rfqCount: relationCount(customer.rfqs),
    memoryCount: relationCount(customer.customer_product_mappings),
  }));

  return (
    <div className="app-page-v2 customers-page ml-unified-page ml-unified-customers">
      <header className="ml-page-head">
        <div className="ml-page-head-copy">
          <div className="ml-page-eyebrow">{locale === "fi" ? "Työtila / Asiakkaat" : "Workspace / Customers"}</div>
          <h1>{locale === "fi" ? "Asiakkaat" : "Customers"}</h1>
          <p>{locale === "fi" ? "Asiakastiedot, yhteyshenkilöt ja myyntiprosessin historia yhdessä paikassa." : "Customer records, contacts and sales history in one place."}</p>
        </div>
      </header>

      <details className="ml-add-details">
        <summary className="ml-page-primary">+ {copy.add}</summary>
        <section className="ml-add-form" aria-label={copy.add}>
          <h2>{copy.add}</h2>
          <form action={createCustomer} className="ml-add-form-grid">
            <label>
              <span>{copy.companyPlaceholder}</span>
              <input name="name" required placeholder={copy.companyPlaceholder} className="nodra-input" />
            </label>
            <label>
              <span>{copy.externalPlaceholder}</span>
              <input name="externalId" placeholder={copy.externalPlaceholder} className="nodra-input" />
            </label>
            <label>
              <span>{locale === "fi" ? "Sähköpostiverkkotunnus" : "Email domain"}</span>
              <input name="emailDomain" placeholder="customer.com" className="nodra-input" />
            </label>
            <button className="ml-page-primary" type="submit">{copy.add}</button>
          </form>
        </section>
      </details>

      <section className="ml-unified-section" aria-labelledby="ml-customers-list-title">
        <div className="ml-section-heading">
          <div><div className="ml-page-eyebrow">{copy.customers}</div><h2 id="ml-customers-list-title">{locale === "fi" ? "Asiakasluettelo" : "Customer list"}</h2></div>
          <span className="ml-order-count">{rows.length} {locale === "fi" ? "näkyvissä" : "shown"}</span>
        </div>
        {rows.length ? (
          <div className="ml-customers-list">
            {rows.map(customer => (
              <Link key={customer.id} href={"/app/customers/" + customer.id} className="ml-customer-item">
                <div className="ml-customer-main">
                  <strong>{customer.name}</strong>
                  <small>{customer.external_id || common.noExternalId}{customer.email_domain ? " · " + customer.email_domain : ""}</small>
                </div>
                <div className="ml-customer-metrics">
                  {[
                    [copy.contacts, customer.contactCount],
                    [copy.quotes, customer.quoteCount],
                    [copy.rfqs, customer.rfqCount],
                    [copy.memory, customer.memoryCount],
                  ].map(([label, value]) => (
                    <span className="ml-customer-metric" key={String(label)}><small>{label}</small><strong>{value}</strong></span>
                  ))}
                </div>
                <span className="ml-row-arrow" aria-hidden="true">→</span>
              </Link>
            ))}
          </div>
        ) : (
          <div className="ml-page-empty"><strong>{copy.emptyTitle}</strong><p>{copy.emptyBody}</p></div>
        )}
        <p className="ml-page-footnote">{locale === "fi" ? "Luettelossa näytetään enintään 500 asiakasta." : "Up to 500 customers are shown."}</p>
      </section>
    </div>
  );
}
