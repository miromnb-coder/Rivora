import Link from "next/link";
import { requireWorkspace } from "@/lib/rivora/workspace";

function statusTone(status: string) {
  if (status === "sent") return "sent";
  if (status === "approved") return "approved";
  if (status === "ready") return "ready";
  if (status === "expired") return "expired";
  return "draft";
}

export default async function QuotesPage() {
  const { supabase } = await requireWorkspace();

  const { data: quotes } = await supabase
    .from("quotes")
    .select("id, quote_number, status, currency, valid_until, created_at, updated_at, customers(name), rfqs(reference), quote_lines(line_total)")
    .order("updated_at", { ascending: false })
    .limit(100);

  const rows = quotes ?? [];
  const counts = {
    draft: rows.filter((quote: any) => quote.status === "draft").length,
    ready: rows.filter((quote: any) => quote.status === "ready").length,
    approved: rows.filter((quote: any) => quote.status === "approved").length,
    sent: rows.filter((quote: any) => quote.status === "sent").length,
  };

  return (
    <div className="app-page-v2 quotes-v1">
      <header className="quotes-v1-head">
        <div>
          <div className="app-kicker-v2">Quotes</div>
          <h1>From resolved RFQ lines to an approved commercial offer.</h1>
          <p>
            Pricing is editable while the quote is in draft or ready. Approval locks the commercial snapshot before sending.
          </p>
        </div>
      </header>

      <section className="quotes-v1-summary">
        <div><span>Draft</span><strong>{counts.draft}</strong><small>pricing in progress</small></div>
        <div><span>Ready</span><strong>{counts.ready}</strong><small>awaiting approval</small></div>
        <div><span>Approved</span><strong>{counts.approved}</strong><small>locked offers</small></div>
        <div><span>Sent</span><strong>{counts.sent}</strong><small>customer-facing stage</small></div>
      </section>

      <section className="quotes-v1-list">
        <div className="quotes-v1-list-head">
          <div>
            <div className="upload-v2-section-label">Quote pipeline</div>
            <h2>Commercial work in progress.</h2>
          </div>
          <span>{rows.length} quotes</span>
        </div>

        {rows.length ? (
          <div>
            {rows.map((quote: any) => {
              const customer = Array.isArray(quote.customers) ? quote.customers[0] : quote.customers;
              const rfq = Array.isArray(quote.rfqs) ? quote.rfqs[0] : quote.rfqs;
              const lines = Array.isArray(quote.quote_lines) ? quote.quote_lines : [];
              const total = lines.reduce((sum: number, line: any) => sum + Number(line.line_total ?? 0), 0);
              const money = new Intl.NumberFormat("en-FI", {
                style: "currency",
                currency: quote.currency || "EUR",
              });

              return (
                <Link href={`/app/quotes/${quote.id}`} key={quote.id} className="quotes-v1-row">
                  <div>
                    <div className="quotes-v1-meta">
                      <span className={`quotes-v1-status ${statusTone(quote.status)}`}>
                        {quote.status}
                      </span>
                      <span>{rfq?.reference || "RFQ"}</span>
                    </div>
                    <h3>{quote.quote_number || "Draft quote"}</h3>
                    <p>{customer?.name || "Unknown customer"}</p>
                  </div>

                  <div className="quotes-v1-value">
                    <span>Subtotal</span>
                    <strong>{money.format(total)}</strong>
                  </div>

                  <div className="quotes-v1-value">
                    <span>Valid until</span>
                    <strong>
                      {quote.valid_until
                        ? new Date(`${quote.valid_until}T12:00:00Z`).toLocaleDateString("fi-FI")
                        : "Not set"}
                    </strong>
                  </div>

                  <div className="quotes-v1-open">Open →</div>
                </Link>
              );
            })}
          </div>
        ) : (
          <div className="quotes-v1-empty">
            <div className="upload-v2-section-label">No quotes yet</div>
            <h3>Resolve an RFQ, then create its commercial offer.</h3>
            <p>Quote Builder starts from the selected canonical products and current catalogue prices.</p>
            <Link href="/app/inbox" className="products-v2-primary">Open RFQ inbox →</Link>
          </div>
        )}
      </section>
    </div>
  );
}
