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
    <div className="app-page-v2">
      <header className="nodra-page-head">
        <div><div className="app-kicker-v2">{copy.kicker}</div><h1>{copy.title}</h1><p>{copy.description}</p></div>
      </header>

      <section className="surface nodra-section">
        <div className="upload-v2-section-label">{copy.add}</div>
        <form action={createCustomer} className="nodra-inline-form">
          <input name="name" required placeholder={copy.companyPlaceholder} className="nodra-input" />
          <input name="externalId" placeholder={copy.externalPlaceholder} className="nodra-input" />
          <input name="emailDomain" placeholder="customer.com" className="nodra-input" />
          <button className="btn-primary">{copy.add}</button>
        </form>
      </section>

      <section className="surface nodra-data-surface">
        <div className="nodra-section-head">
          <div><div className="upload-v2-section-label">{copy.customers}</div><h2>{rows.length} {rows.length === 1 ? copy.customer : copy.customers.toLowerCase()}</h2></div>
        </div>
        {rows.length ? (
          <div className="nodra-list">
            {rows.map((customer) => (
              <Link key={customer.id} href={`/app/customers/${customer.id}`} className="nodra-list-row nodra-customer-row">
                <div><h3>{customer.name}</h3><p>{customer.external_id || common.noExternalId}{customer.email_domain ? ` · ${customer.email_domain}` : ""}</p></div>
                <div><span>{copy.contacts}</span><strong>{customer.contactCount}</strong></div>
                <div><span>{copy.quotes}</span><strong>{customer.quoteCount}</strong></div>
                <div><span>{copy.rfqs}</span><strong>{customer.rfqCount}</strong></div>
                <div><span>{copy.memory}</span><strong>{customer.memoryCount}</strong></div>
                <span aria-hidden="true">→</span>
              </Link>
            ))}
          </div>
        ) : (
          <div className="nodra-empty"><div className="upload-v2-section-label">{copy.empty}</div><h3>{copy.emptyTitle}</h3><p>{copy.emptyBody}</p></div>
        )}
      </section>
    </div>
  );
}
