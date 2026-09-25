import Link from "next/link";
import { notFound } from "next/navigation";
import { requireWorkspace } from "@/lib/rivora/workspace";
import {
  approveQuote,
  markQuoteReady,
  markQuoteSent,
  returnQuoteToDraft,
  updateQuoteHeader,
  updateQuoteLine,
} from "../actions";

function moneyFormatter(currency: string) {
  return new Intl.NumberFormat("en-FI", { style: "currency", currency: currency || "EUR" });
}

export default async function QuoteDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { supabase, workspace } = await requireWorkspace();

  const { data: quote } = await supabase
    .from("quotes")
    .select("id, rfq_id, quote_number, status, currency, valid_until, customer_reference, notes, tax_rate, approved_at, sent_at, created_at, updated_at, customers(name), rfqs(reference)")
    .eq("id", id)
    .maybeSingle();

  if (!quote) notFound();

  const { data: lines } = await supabase
    .from("quote_lines")
    .select("id, line_number, source_rfq_line_id, product_id, sku_snapshot, description_snapshot, quantity, unit, catalogue_unit_price, unit_price, discount_percent, line_total, products(sku,name,manufacturer)")
    .eq("quote_id", id)
    .order("line_number");

  const editable = ["owner", "admin"].includes(workspace.role) && ["draft", "ready"].includes(quote.status);
  const canApprove = ["owner", "admin"].includes(workspace.role);
  const money = moneyFormatter(quote.currency || "EUR");
  const subtotal = (lines ?? []).reduce((sum: number, line: any) => sum + Number(line.line_total ?? 0), 0);
  const taxRate = Number(quote.tax_rate ?? 0);
  const taxTotal = subtotal * (taxRate / 100);
  const total = subtotal + taxTotal;
  const customer = Array.isArray((quote as any).customers) ? (quote as any).customers[0] : (quote as any).customers;
  const rfq = Array.isArray((quote as any).rfqs) ? (quote as any).rfqs[0] : (quote as any).rfqs;

  return (
    <div className="app-page-v2 quote-builder-v1">
      <div className="quote-builder-v1-nav">
        <Link href="/app/quotes">← Quotes</Link>
        {quote.rfq_id ? <Link href={`/app/rfq/${quote.rfq_id}`}>Source RFQ →</Link> : null}
      </div>

      <header className="quote-builder-v1-head">
        <div>
          <div className="app-kicker-v2">Quote Builder</div>
          <h1>{quote.quote_number || "Draft quote"}</h1>
          <p>
            {customer?.name || "Unknown customer"} · source {rfq?.reference || "RFQ"} ·{" "}
            {lines?.length ?? 0} commercial lines
          </p>
        </div>

        <span className={`quote-builder-v1-status ${quote.status}`}>
          {quote.status}
        </span>
      </header>

      <section className="quote-builder-v1-summary">
        <div><span>Subtotal</span><strong>{money.format(subtotal)}</strong><small>after line discounts</small></div>
        <div><span>VAT</span><strong>{taxRate}%</strong><small>{money.format(taxTotal)}</small></div>
        <div><span>Total</span><strong>{money.format(total)}</strong><small>quote value</small></div>
        <div><span>Validity</span><strong className="is-text">{quote.valid_until ? new Date(`${quote.valid_until}T12:00:00Z`).toLocaleDateString("fi-FI") : "Not set"}</strong><small>customer-facing</small></div>
      </section>

      <div className="quote-builder-v1-grid">
        <main>
          <section className="quote-builder-v1-lines">
            <div className="quote-builder-v1-section-head">
              <div>
                <div className="upload-v2-section-label">Pricing</div>
                <h2>Quote lines</h2>
              </div>
              <span>{editable ? "Editable" : "Locked snapshot"}</span>
            </div>

            <div>
              {(lines ?? []).map((line: any) => {
                const product = Array.isArray(line.products) ? line.products[0] : line.products;
                const sku = line.sku_snapshot || product?.sku || "No SKU";
                const description = line.description_snapshot || product?.name || "Product";
                const catalogue = line.catalogue_unit_price == null ? null : Number(line.catalogue_unit_price);

                return (
                  <article key={line.id} className="quote-builder-v1-line">
                    <div className="quote-builder-v1-line-copy">
                      <div className="quote-builder-v1-line-meta">
                        <span>Line {line.line_number}</span>
                        {product?.manufacturer ? <span>{product.manufacturer}</span> : null}
                      </div>
                      <h3>{sku}</h3>
                      <p>{description}</p>
                      {catalogue != null ? <small>Catalogue snapshot {money.format(catalogue)} / {line.unit}</small> : null}
                    </div>

                    {editable ? (
                      <form action={updateQuoteLine} className="quote-builder-v1-line-form">
                        <input type="hidden" name="quoteId" value={quote.id} />
                        <input type="hidden" name="lineId" value={line.id} />

                        <label>
                          <span>Qty</span>
                          <input name="quantity" type="number" min="0.001" step="0.001" defaultValue={Number(line.quantity)} required />
                        </label>
                        <label>
                          <span>Unit price</span>
                          <input name="unitPrice" type="number" min="0" step="0.01" defaultValue={Number(line.unit_price)} required />
                        </label>
                        <label>
                          <span>Discount %</span>
                          <input name="discountPercent" type="number" min="0" max="100" step="0.01" defaultValue={Number(line.discount_percent ?? 0)} required />
                        </label>

                        <div className="quote-builder-v1-line-total">
                          <span>Line total</span>
                          <strong>{money.format(Number(line.line_total ?? 0))}</strong>
                        </div>

                        <button>Save</button>
                      </form>
                    ) : (
                      <div className="quote-builder-v1-line-locked">
                        <div><span>Qty</span><strong>{Number(line.quantity)} {line.unit}</strong></div>
                        <div><span>Unit price</span><strong>{money.format(Number(line.unit_price))}</strong></div>
                        <div><span>Discount</span><strong>{Number(line.discount_percent ?? 0)}%</strong></div>
                        <div><span>Line total</span><strong>{money.format(Number(line.line_total ?? 0))}</strong></div>
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          </section>
        </main>

        <aside className="quote-builder-v1-aside">
          <section className="quote-builder-v1-panel">
            <div className="upload-v2-section-label">Commercial details</div>
            {editable ? (
              <form action={updateQuoteHeader} className="quote-builder-v1-header-form">
                <input type="hidden" name="quoteId" value={quote.id} />
                <label>
                  <span>Customer reference</span>
                  <input name="customerReference" defaultValue={quote.customer_reference || ""} maxLength={300} />
                </label>
                <label>
                  <span>Valid until</span>
                  <input name="validUntil" type="date" defaultValue={quote.valid_until || ""} />
                </label>
                <label>
                  <span>VAT %</span>
                  <input name="taxRate" type="number" min="0" max="100" step="0.01" defaultValue={taxRate} required />
                </label>
                <label>
                  <span>Notes</span>
                  <textarea name="notes" rows={5} maxLength={5000} defaultValue={quote.notes || ""} />
                </label>
                <button className="quote-builder-v1-secondary">Save details</button>
              </form>
            ) : (
              <div className="quote-builder-v1-readonly">
                <div><span>Customer reference</span><strong>{quote.customer_reference || "Not set"}</strong></div>
                <div><span>Valid until</span><strong>{quote.valid_until || "Not set"}</strong></div>
                <div><span>VAT</span><strong>{taxRate}%</strong></div>
                <div><span>Notes</span><p>{quote.notes || "No notes"}</p></div>
              </div>
            )}
          </section>

          <section className="quote-builder-v1-panel quote-builder-v1-approval">
            <div className="upload-v2-section-label">Approval flow</div>

            <div className="quote-builder-v1-flow">
              {["draft", "ready", "approved", "sent"].map((stage, index) => {
                const order = ["draft", "ready", "approved", "sent"];
                const current = order.indexOf(quote.status);
                return (
                  <div key={stage} className={current >= index ? "is-complete" : ""}>
                    <span>{String(index + 1).padStart(2, "0")}</span>
                    <b>{stage}</b>
                  </div>
                );
              })}
            </div>

            {canApprove ? (
              <div className="quote-builder-v1-stage-actions">
                {quote.status === "draft" ? (
                  <form action={markQuoteReady}>
                    <input type="hidden" name="quoteId" value={quote.id} />
                    <button>Mark ready →</button>
                  </form>
                ) : null}

                {quote.status === "ready" ? (
                  <>
                    <form action={approveQuote}>
                      <input type="hidden" name="quoteId" value={quote.id} />
                      <button>Approve quote →</button>
                    </form>
                    <form action={returnQuoteToDraft}>
                      <input type="hidden" name="quoteId" value={quote.id} />
                      <button className="is-secondary">Back to draft</button>
                    </form>
                  </>
                ) : null}

                {quote.status === "approved" ? (
                  <form action={markQuoteSent}>
                    <input type="hidden" name="quoteId" value={quote.id} />
                    <button>Mark sent →</button>
                  </form>
                ) : null}
              </div>
            ) : (
              <p className="quote-builder-v1-permission">Owner or admin approval is required for commercial state changes.</p>
            )}

            {quote.approved_at ? <small>Approved {new Date(quote.approved_at).toLocaleString("fi-FI")}</small> : null}
            {quote.sent_at ? <small>Sent {new Date(quote.sent_at).toLocaleString("fi-FI")}</small> : null}
          </section>
        </aside>
      </div>
    </div>
  );
}
