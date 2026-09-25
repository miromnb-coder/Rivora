import Link from "next/link";
import { requireWorkspace } from "@/lib/rivora/workspace";
import { getDictionary } from "@/lib/i18n";
import { formatLocale, getLocale } from "@/lib/locale";

function statusTone(status: string) {
  if (status === "sent") return "sent";
  if (status === "approved") return "approved";
  if (status === "ready") return "ready";
  if (status === "expired") return "expired";
  return "draft";
}

export default async function QuotesPage() {
  const [{ supabase }, locale] = await Promise.all([requireWorkspace(), getLocale()]);
  const copy = getDictionary(locale).quotes;
  const dateLocale = formatLocale(locale);

  const { data: quotes } = await supabase
    .from("quotes")
    .select("id, quote_number, status, currency, valid_until, created_at, updated_at, customers(name), rfqs(reference), quote_lines(line_total)")
    .order("updated_at", { ascending: false }).limit(100);

  const rows = quotes ?? [];
  const counts = {
    draft: rows.filter((quote: any) => quote.status === "draft").length,
    ready: rows.filter((quote: any) => quote.status === "ready").length,
    approved: rows.filter((quote: any) => quote.status === "approved").length,
    sent: rows.filter((quote: any) => quote.status === "sent").length,
  };
  const statusCopy: Record<string, string> = { draft: copy.draft, ready: copy.ready, approved: copy.approved, sent: copy.sent, expired: locale === "fi" ? "Vanhentunut" : "Expired" };

  return (
    <div className="app-page-v2 quotes-v1">
      <header className="quotes-v1-head">
        <div><div className="app-kicker-v2">{copy.kicker}</div><h1>{copy.title}</h1><p>{copy.description}</p></div>
      </header>

      <section className="quotes-v1-summary">
        <div><span>{copy.draft}</span><strong>{counts.draft}</strong><small>{copy.pricing}</small></div>
        <div><span>{copy.ready}</span><strong>{counts.ready}</strong><small>{copy.approval}</small></div>
        <div><span>{copy.approved}</span><strong>{counts.approved}</strong><small>{copy.locked}</small></div>
        <div><span>{copy.sent}</span><strong>{counts.sent}</strong><small>{copy.customerStage}</small></div>
      </section>

      <section className="quotes-v1-list">
        <div className="quotes-v1-list-head">
          <div><div className="upload-v2-section-label">{copy.pipeline}</div><h2>{copy.listTitle}</h2></div>
          <span>{rows.length} {locale === "fi" ? "tarjousta" : "quotes"}</span>
        </div>

        {rows.length ? (
          <div>
            {rows.map((quote: any) => {
              const customer = Array.isArray(quote.customers) ? quote.customers[0] : quote.customers;
              const rfq = Array.isArray(quote.rfqs) ? quote.rfqs[0] : quote.rfqs;
              const lines = Array.isArray(quote.quote_lines) ? quote.quote_lines : [];
              const total = lines.reduce((sum: number, line: any) => sum + Number(line.line_total ?? 0), 0);
              const money = new Intl.NumberFormat(dateLocale, { style: "currency", currency: quote.currency || "EUR" });

              return (
                <Link href={`/app/quotes/${quote.id}`} key={quote.id} className="quotes-v1-row">
                  <div>
                    <div className="quotes-v1-meta"><span className={`quotes-v1-status ${statusTone(quote.status)}`}>{statusCopy[quote.status] ?? quote.status}</span><span>{rfq?.reference || "RFQ"}</span></div>
                    <h3>{quote.quote_number || copy.draftQuote}</h3><p>{customer?.name || copy.unknownCustomer}</p>
                  </div>
                  <div className="quotes-v1-value"><span>{copy.subtotal}</span><strong>{money.format(total)}</strong></div>
                  <div className="quotes-v1-value"><span>{copy.validUntil}</span><strong>{quote.valid_until ? new Date(`${quote.valid_until}T12:00:00Z`).toLocaleDateString(dateLocale) : copy.notSet}</strong></div>
                  <div className="quotes-v1-open">{getDictionary(locale).common.open} →</div>
                </Link>
              );
            })}
          </div>
        ) : (
          <div className="quotes-v1-empty">
            <div className="upload-v2-section-label">{copy.noQuotes}</div><h3>{copy.emptyTitle}</h3><p>{copy.emptyBody}</p>
            <Link href="/app/inbox" className="products-v2-primary">{copy.openInbox} →</Link>
          </div>
        )}
      </section>
    </div>
  );
}
