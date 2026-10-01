
import {
  acceptPurchaseOrderException,
  acceptPurchaseOrderHeaderExceptions,
  approvePurchaseOrderReconciliation,
  linkPurchaseOrderQuote,
  runPurchaseOrderReconciliation,
} from "../reconciliation-actions";

type Locale = "en" | "fi";

function strings(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function label(code: string, fi: boolean) {
  const values: Record<string, [string, string]> = {
    product_identity_review: ["Product identity", "Tuotteen tunnistus"],
    quantity_mismatch: ["Quantity differs", "Määrä poikkeaa"],
    unit_mismatch: ["Unit differs", "Yksikkö poikkeaa"],
    unit_price_mismatch: ["Unit price differs", "Yksikköhinta poikkeaa"],
    line_total_mismatch: ["Line total differs", "Rivisumma poikkeaa"],
    extra_po_line: ["Extra PO line", "Ylimääräinen PO-rivi"],
    missing_quote_line: ["Missing from PO", "Puuttuu PO:lta"],
    currency_mismatch: ["Currency differs", "Valuutta poikkeaa"],
    quote_reference_mismatch: ["Quote reference differs", "Tarjousviite poikkeaa"],
  };
  return values[code]?.[fi ? 1 : 0] ?? code.replaceAll("_", " ");
}

function money(value: unknown, currency: string, locale: string) {
  if (value == null || value === "") return "—";
  const n = Number(value);
  if (!Number.isFinite(n)) return "—";
  return new Intl.NumberFormat(locale, { style: "currency", currency: currency || "EUR" }).format(n);
}

function num(value: unknown, locale: string) {
  if (value == null || value === "") return "—";
  const n = Number(value);
  return Number.isFinite(n) ? n.toLocaleString(locale) : "—";
}

function snap(value: unknown) {
  return value && typeof value === "object" ? (value as Record<string, any>) : null;
}

export function ReconciliationPanel({
  locale,
  displayLocale,
  workspaceRole,
  purchaseOrder,
  linkedQuote,
  quoteOptions,
  reconciliation,
  lines,
}: {
  locale: Locale;
  displayLocale: string;
  workspaceRole: string;
  purchaseOrder: any;
  linkedQuote: any | null;
  quoteOptions: any[];
  reconciliation: any | null;
  lines: any[];
}) {
  const fi = locale === "fi";
  const canReview = ["owner", "admin", "member"].includes(workspaceRole);
  const canApprove = ["owner", "admin"].includes(workspaceRole);
  const locked = ["approved", "ready_for_erp", "erp_created"].includes(String(purchaseOrder.status));

  if (!purchaseOrder.quote_id) {
    return (
      <section className="surface mt-6 p-6">
        <div className="upload-v2-section-label">Quote ↔ PO reconciliation</div>
        <h2 className="mt-2 text-2xl font-bold">
          {fi ? "Linkitä tarjous ennen vertailua." : "Link a quote before comparison."}
        </h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--muted)]">
          {fi
            ? "Vertailu käyttää saman asiakkaan hyväksyttyä tai lähetettyä tarjousta. Linkitys ei muuta PO:n tai tarjouksen kaupallisia tietoja."
            : "Reconciliation uses an approved or sent quote from the same customer. Linking does not modify commercial data in either document."}
        </p>
        {canReview && quoteOptions.length ? (
          <form action={linkPurchaseOrderQuote} className="mt-5 flex flex-wrap items-end gap-3">
            <input type="hidden" name="purchaseOrderId" value={purchaseOrder.id} />
            <label className="min-w-[280px] flex-1">
              <span className="text-sm font-semibold">{fi ? "Tarjous" : "Quote"}</span>
              <select name="quoteId" required className="mt-2 w-full rounded-xl border border-[var(--line)] bg-white px-4 py-3 text-sm">
                <option value="">{fi ? "Valitse tarjous" : "Choose quote"}</option>
                {quoteOptions.map((quote: any) => (
                  <option key={quote.id} value={quote.id}>
                    {(quote.quote_number || (fi ? "Tarjous" : "Quote")) + " · " + quote.status}
                  </option>
                ))}
              </select>
            </label>
            <button className="upload-v2-primary-btn">
              {fi ? "Linkitä ja vertaa" : "Link and compare"} →
            </button>
          </form>
        ) : (
          <div className="mt-5 rounded-xl border border-[var(--line)] bg-[#fafbfa] p-4 text-sm text-[var(--muted)]">
            {quoteOptions.length
              ? (fi ? "Reviewer-oikeus on vain luku -tilassa." : "Reviewer access is read-only.")
              : (fi ? "Tälle asiakkaalle ei löydy hyväksyttyä tai lähetettyä tarjousta." : "No approved or sent quote is available for this customer.")}
          </div>
        )}
      </section>
    );
  }

  if (!reconciliation || String(reconciliation.quote_id) !== String(purchaseOrder.quote_id)) {
    return (
      <section className="surface mt-6 p-6">
        <div className="upload-v2-section-label">Quote ↔ PO reconciliation</div>
        <h2 className="mt-2 text-2xl font-bold">
          {fi ? "Tarjous on linkitetty. Aja vertailu." : "Quote linked. Run reconciliation."}
        </h2>
        <p className="mt-2 text-sm text-[var(--muted)]">{linkedQuote?.quote_number || "—"}</p>
        {canReview && !locked ? (
          <form action={runPurchaseOrderReconciliation} className="mt-5">
            <input type="hidden" name="purchaseOrderId" value={purchaseOrder.id} />
            <button className="upload-v2-primary-btn">
              {fi ? "Vertaa PO tarjoukseen" : "Compare PO to quote"} →
            </button>
          </form>
        ) : null}
      </section>
    );
  }

  const summary = reconciliation.summary && typeof reconciliation.summary === "object" ? reconciliation.summary : {};
  const headerExceptions = strings(reconciliation.header_exceptions);
  const exceptionLines = lines.filter((line) => strings(line.exception_codes).length > 0);
  const cleanLines = lines.filter((line) => strings(line.exception_codes).length === 0);
  const openLineCount = exceptionLines.filter((line) => line.review_status === "open").length;
  const headerOpen = reconciliation.header_review_status === "open";
  const openCount = openLineCount + (headerOpen ? 1 : 0);
  const approved = reconciliation.status === "approved";

  return (
    <section className="surface mt-6 overflow-hidden">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[var(--line)] p-6">
        <div>
          <div className="upload-v2-section-label">Quote ↔ PO reconciliation</div>
          <h2 className="mt-2 text-2xl font-bold">
            {approved
              ? (fi ? "Vertailu hyväksytty." : "Reconciliation approved.")
              : reconciliation.status === "matched"
                ? (fi ? "Kaikki rivit täsmäävät." : "All lines match.")
                : (fi ? "Tarkista vain poikkeukset." : "Review exceptions only.")}
          </h2>
          <p className="mt-2 text-sm text-[var(--muted)]">
            {(linkedQuote?.quote_number || "—") + " · " + (fi ? "ajo" : "run") + " #" + reconciliation.run_number + " · " + reconciliation.algorithm_version}
          </p>
        </div>
        <span className={"rounded-full border px-4 py-2 text-sm font-bold " + (approved || reconciliation.status === "matched" ? "border-[#bad8c5] bg-[var(--green-soft)] text-[var(--green-dark)]" : "border-[#e5cfac] bg-[#fff8ed] text-[#7f5719]")}>
          {approved ? (fi ? "Hyväksytty" : "Approved") : reconciliation.status === "matched" ? (fi ? "Täsmää" : "Matched") : String(openCount) + " " + (fi ? "avointa" : "open")}
        </span>
      </div>

      <div className="grid gap-px border-b border-[var(--line)] bg-[var(--line)] sm:grid-cols-2 xl:grid-cols-4">
        {[
          [fi ? "Puhtaat osumat" : "Clean matches", summary.cleanMatches ?? cleanLines.length],
          [fi ? "Poikkeusrivit" : "Exception lines", summary.exceptionLines ?? exceptionLines.length],
          [fi ? "Ylimääräiset PO-rivit" : "Extra PO lines", summary.extraPurchaseOrderLines ?? 0],
          [fi ? "PO:lta puuttuvat" : "Missing from PO", summary.missingQuoteLines ?? 0],
        ].map(([name, value]) => (
          <div key={String(name)} className="bg-white p-5">
            <span className="text-xs font-bold uppercase tracking-wider text-[var(--muted)]">{name}</span>
            <strong className="mt-2 block text-3xl">{String(value)}</strong>
          </div>
        ))}
      </div>

      {headerExceptions.length ? (
        <div className="border-b border-[var(--line)] p-6">
          <div className="upload-v2-section-label">{fi ? "Dokumenttitason poikkeukset" : "Header exceptions"}</div>
          <div className="mt-3 flex flex-wrap gap-2">
            {headerExceptions.map((code) => (
              <span key={code} className="rounded-full border border-[#e5cfac] bg-[#fff8ed] px-3 py-1 text-xs font-bold text-[#7f5719]">
                {label(code, fi)}
              </span>
            ))}
          </div>
          <div className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
            <div className="rounded-xl border border-[var(--line)] p-4">
              <span className="text-xs text-[var(--muted)]">{fi ? "Tarjous" : "Quote"}</span>
              <strong className="mt-1 block">{(linkedQuote?.quote_number || "—") + " · " + (linkedQuote?.currency || "—")}</strong>
            </div>
            <div className="rounded-xl border border-[var(--line)] p-4">
              <span className="text-xs text-[var(--muted)]">PO</span>
              <strong className="mt-1 block">{(purchaseOrder.quote_reference || "—") + " · " + (purchaseOrder.currency || "—")}</strong>
            </div>
          </div>
          {headerOpen && canReview && !locked ? (
            <form action={acceptPurchaseOrderHeaderExceptions} className="mt-4 grid gap-3 md:grid-cols-[1fr_auto]">
              <input type="hidden" name="purchaseOrderId" value={purchaseOrder.id} />
              <input type="hidden" name="reconciliationId" value={reconciliation.id} />
              <input name="reviewNote" maxLength={2000} className="rounded-xl border border-[var(--line)] px-4 py-3 text-sm" placeholder={fi ? "Perustelu / huomio (valinnainen)" : "Reason / note (optional)"} />
              <button className="upload-v2-secondary-btn">{fi ? "Hyväksy poikkeus" : "Accept header exception"}</button>
            </form>
          ) : null}
        </div>
      ) : null}

      <div className="p-6">
        <div className="upload-v2-section-label">{fi ? "Exception Review" : "Exception review"}</div>
        {exceptionLines.length ? (
          <div className="mt-4 space-y-4">
            {exceptionLines.map((line: any) => {
              const codes = strings(line.exception_codes);
              const po = snap(line.po_snapshot);
              const quote = snap(line.quote_snapshot);
              const accepted = line.review_status === "accepted";
              const quoteNet = quote?.quantity ? Number(quote.lineTotal) / Number(quote.quantity) : null;

              return (
                <article key={line.id} className={"rounded-2xl border p-5 " + (accepted ? "border-[#bad8c5] bg-[#fbfdfb]" : "border-[#e5cfac] bg-[#fffdfa]")}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="flex flex-wrap gap-2">
                      {codes.map((code) => (
                        <span key={code} className="rounded-full border border-[#e5cfac] bg-[#fff8ed] px-3 py-1 text-xs font-bold text-[#7f5719]">
                          {label(code, fi)}
                        </span>
                      ))}
                    </div>
                    <span className="text-xs font-bold uppercase tracking-wider text-[var(--muted)]">{accepted ? (fi ? "Kuitattu" : "Accepted") : (fi ? "Avoin" : "Open")}</span>
                  </div>

                  <div className="mt-5 grid gap-4 lg:grid-cols-2">
                    <div className="rounded-xl border border-[var(--line)] bg-white p-4">
                      <div className="text-xs font-bold uppercase tracking-wider text-[var(--muted)]">{fi ? "Tarjousrivi" : "Quote line"} {quote?.lineNumber ?? "—"}</div>
                      <strong className="mt-2 block">{quote?.sourceCustomerSku || quote?.sku || quote?.productSku || quote?.manufacturerPartNumber || "—"}</strong>
                      <p className="mt-1 text-sm text-[var(--muted)]">{quote?.description || quote?.sourceDescription || "—"}</p>
                      <div className="mt-4 grid grid-cols-3 gap-3 text-sm">
                        <div><span className="block text-xs text-[var(--muted)]">{fi ? "Määrä" : "Qty"}</span><b>{num(quote?.quantity, displayLocale)} {quote?.unit || ""}</b></div>
                        <div><span className="block text-xs text-[var(--muted)]">{fi ? "Netto / yks." : "Net / unit"}</span><b>{money(quoteNet, purchaseOrder.currency, displayLocale)}</b></div>
                        <div><span className="block text-xs text-[var(--muted)]">{fi ? "Rivisumma" : "Line total"}</span><b>{money(quote?.lineTotal, purchaseOrder.currency, displayLocale)}</b></div>
                      </div>
                    </div>
                    <div className="rounded-xl border border-[var(--line)] bg-white p-4">
                      <div className="text-xs font-bold uppercase tracking-wider text-[var(--muted)]">PO {fi ? "rivi" : "line"} {po?.lineNumber ?? "—"}</div>
                      <strong className="mt-2 block">{po?.customerSku || po?.manufacturerPartNumber || "—"}</strong>
                      <p className="mt-1 text-sm text-[var(--muted)]">{po?.description || "—"}</p>
                      <div className="mt-4 grid grid-cols-3 gap-3 text-sm">
                        <div><span className="block text-xs text-[var(--muted)]">{fi ? "Määrä" : "Qty"}</span><b>{num(po?.quantity, displayLocale)} {po?.unit || ""}</b></div>
                        <div><span className="block text-xs text-[var(--muted)]">{fi ? "Yksikköhinta" : "Unit price"}</span><b>{money(po?.unitPrice, purchaseOrder.currency, displayLocale)}</b></div>
                        <div><span className="block text-xs text-[var(--muted)]">{fi ? "Rivisumma" : "Line total"}</span><b>{money(po?.lineTotal, purchaseOrder.currency, displayLocale)}</b></div>
                      </div>
                    </div>
                  </div>

                  {accepted ? (
                    line.review_note ? <div className="mt-4 rounded-xl bg-[var(--green-soft)] p-3 text-sm text-[var(--green-dark)]">{line.review_note}</div> : null
                  ) : canReview && !locked ? (
                    <form action={acceptPurchaseOrderException} className="mt-4 grid gap-3 md:grid-cols-[1fr_auto]">
                      <input type="hidden" name="purchaseOrderId" value={purchaseOrder.id} />
                      <input type="hidden" name="reconciliationLineId" value={line.id} />
                      <input name="reviewNote" maxLength={2000} className="rounded-xl border border-[var(--line)] bg-white px-4 py-3 text-sm" placeholder={fi ? "Miksi poikkeama hyväksytään? (valinnainen)" : "Why is this difference accepted? (optional)"} />
                      <button className="upload-v2-secondary-btn">{fi ? "Hyväksy poikkeama" : "Accept difference"}</button>
                    </form>
                  ) : null}
                </article>
              );
            })}
          </div>
        ) : (
          <div className="mt-4 rounded-2xl bg-[var(--green-soft)] p-5 text-[var(--green-dark)]">
            <strong className="block">{fi ? "Ei rivipoikkeamia." : "No line exceptions."}</strong>
            <span className="mt-1 block text-sm">{fi ? "Tuotteet, määrät, yksiköt ja PO:ssa olevat hinnat täsmäävät tarjoukseen." : "Products, quantities, units and prices present in the PO match the quote."}</span>
          </div>
        )}
      </div>

      <div className="border-t border-[var(--line)] bg-[#fafbfa] p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <strong className="block">
              {approved
                ? (fi ? "Reconciliation on lukittu hyväksytyksi." : "Reconciliation is approved and locked.")
                : openCount
                  ? String(openCount) + " " + (fi ? "poikkeamaa odottaa kuittausta." : "exceptions still need review.")
                  : (fi ? "Kaikki poikkeukset on käsitelty." : "All exceptions have been reviewed.")}
            </strong>
            <span className="mt-1 block text-sm text-[var(--muted)]">{fi ? "Hyväksyntä ei vielä kirjoita mitään ERP:iin." : "Approval still does not write anything to ERP."}</span>
          </div>
          <div className="flex flex-wrap gap-3">
            {canReview && !locked && !approved ? (
              <form action={runPurchaseOrderReconciliation}>
                <input type="hidden" name="purchaseOrderId" value={purchaseOrder.id} />
                <button className="upload-v2-secondary-btn">{fi ? "Aja vertailu uudelleen" : "Run comparison again"}</button>
              </form>
            ) : null}
            {!approved && openCount === 0 && canApprove && !locked ? (
              <form action={approvePurchaseOrderReconciliation}>
                <input type="hidden" name="purchaseOrderId" value={purchaseOrder.id} />
                <input type="hidden" name="reconciliationId" value={reconciliation.id} />
                <button className="upload-v2-primary-btn">{fi ? "Hyväksy PO reconciliation" : "Approve PO reconciliation"} →</button>
              </form>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}
