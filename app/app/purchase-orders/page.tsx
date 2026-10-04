import Link from "next/link";
import { FilePicker } from "@/components/FilePicker";
import { formatLocale, getLocale } from "@/lib/locale";
import { requireWorkspace } from "@/lib/rivora/workspace";
import {
  processPdfPurchaseOrder,
} from "./actions";

function quoteStatusLabel(status: string, fi: boolean) {
  const labels: Record<string, string> = fi
    ? { draft: "Luonnos", ready: "Valmis", approved: "Hyväksytty", sent: "Lähetetty", expired: "Vanhentunut" }
    : { draft: "Draft", ready: "Ready", approved: "Approved", sent: "Sent", expired: "Expired" };
  return labels[status] ?? status;
}

function statusLabel(status: string, fi: boolean) {
  const labels: Record<string, string> = fi
    ? {
        received: "Vastaanotettu",
        processing: "Käsitellään",
        extracted: "Poimittu",
        needs_review: "Vaatii tarkistuksen",
        matched: "Täsmäytetty",
        approved: "Hyväksytty",
        ready_for_erp: "Valmis ERP:iin",
        erp_created: "Luotu ERP:iin",
        failed: "Epäonnistui",
      }
    : {
        received: "Received",
        processing: "Processing",
        extracted: "Extracted",
        needs_review: "Needs review",
        matched: "Matched",
        approved: "Approved",
        ready_for_erp: "Ready for ERP",
        erp_created: "Created in ERP",
        failed: "Failed",
      };
  return labels[status] ?? status;
}

export default async function PurchaseOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{
    quoteId?: string;
    pdfError?: string;
    structuredError?: string;
  }>;
}) {
  const [query, locale, context] = await Promise.all([
    searchParams,
    getLocale(),
    requireWorkspace(),
  ]);
  const { supabase, workspace } = context;
  const fi = locale === "fi";
  const displayLocale = formatLocale(locale);
  const openAiReady = Boolean(process.env.OPENAI_API_KEY?.trim());

  const [{ data: purchaseOrders }, { data: quotes }] = await Promise.all([
    supabase
      .from("purchase_orders")
      .select(
        "id,po_number,status,currency,order_date,source_type,received_at,created_at,customers(name),quotes(quote_number),purchase_order_lines(id)"
      )
      .eq("organization_id", workspace.id)
      .order("created_at", { ascending: false })
      .limit(100),
    supabase
      .from("quotes")
      .select("id,quote_number,status,currency,customers(name)")
      .eq("organization_id", workspace.id)
      .in("status", ["approved", "sent"])
      .order("updated_at", { ascending: false })
      .limit(100),
  ]);

  const rows = purchaseOrders ?? [];
  const quoteOptions = quotes ?? [];
  const selectedQuoteId = quoteOptions.some((quote: any) => quote.id === query.quoteId)
    ? query.quoteId
    : "";

  return (
    <div className="app-page-v2">
      <header className="mb-7">
        <div className="app-kicker-v2">{fi ? "Ostotilaukset" : "Purchase orders"}</div>
        <h1 className="mt-2 max-w-4xl text-4xl font-bold tracking-tight">
          {fi
            ? "Tuo asiakkaan PO rakenteisiksi tilausriveiksi."
            : "Turn a customer PO into structured order lines."}
        </h1>
        <p className="mt-3 max-w-3xl text-[var(--muted)]">
          {fi
            ? "Tuo asiakkaan ostotilaus PDF-, CSV- tai XLSX-muodossa ja linkitä se tarvittaessa hyväksyttyyn tai lähetettyyn tarjoukseen. Averomira vertaa Quote ↔ PO -rivit, nostaa poikkeamat tarkistettaviksi ja sallii hyväksynnän vasta tarkistuksen jälkeen."
            : "Import a customer purchase order as PDF, CSV or XLSX and optionally link it to an approved or sent quote. Averomira reconciles Quote ↔ PO lines, surfaces exceptions for review, and allows approval after review."}
        </p>
      </header>

      {query.pdfError || query.structuredError ? (
        <div className="upload-v2-alert error mb-6">
          {query.pdfError ?? query.structuredError}
        </div>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-2">
        <section className="surface p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="upload-v2-section-label">
                {fi ? "PDF-ostotilaus" : "PDF purchase order"}
              </div>
              <h2 className="mt-2 text-2xl font-bold">
                {fi ? "Poimi PO AI:lla" : "Extract a PO with AI"}
              </h2>
              <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
                {fi
                  ? "AI lukee vain dokumentin. Se ei tässä vaiheessa päätä, vastaako tilaus tarjousta tai mitä ERP:iin kirjoitetaan."
                  : "AI reads the document only. It does not decide whether the PO matches the quote or what should be written to ERP."}
              </p>
            </div>
            <span className={`upload-v2-ai-status ${openAiReady ? "is-ready" : "is-error"}`}>
              {openAiReady ? (fi ? "AI valmis" : "AI ready") : (fi ? "AI puuttuu" : "AI unavailable")}
            </span>
          </div>

          <form action={processPdfPurchaseOrder} className="mt-6 space-y-4">
            <label className="block">
              <span className="text-sm font-semibold">
                {fi ? "Linkitä tarjoukseen" : "Link to quote"}{" "}
                <em className="font-normal text-[var(--muted)]">{fi ? "valinnainen" : "optional"}</em>
              </span>
              <select
                name="pdfQuoteId"
                defaultValue={selectedQuoteId}
                className="mt-2 w-full rounded-xl border border-[var(--line)] bg-white px-4 py-3 text-sm"
              >
                <option value="">{fi ? "Ei valittua tarjousta" : "No quote selected"}</option>
                {quoteOptions.map((quote: any) => {
                  const customer = Array.isArray(quote.customers) ? quote.customers[0] : quote.customers;
                  return (
                    <option key={quote.id} value={quote.id}>
                      {quote.quote_number || (fi ? "Tarjous" : "Quote")} · {customer?.name || "—"} · {quoteStatusLabel(String(quote.status), fi)}
                    </option>
                  );
                })}
              </select>
            </label>

            <div className="grid gap-4 md:grid-cols-2">
              <label>
                <span className="text-sm font-semibold">
                  {fi ? "Asiakkaan nimi" : "Customer name"}{" "}
                  <em className="font-normal text-[var(--muted)]">{fi ? "ohitus" : "override"}</em>
                </span>
                <input
                  name="pdfCustomerName"
                  className="mt-2 w-full rounded-xl border border-[var(--line)] px-4 py-3 text-sm"
                  placeholder={fi ? "Tarvitaan vain jos PDF on epäselvä" : "Only needed if the PDF is ambiguous"}
                />
              </label>
              <label>
                <span className="text-sm font-semibold">
                  {fi ? "PO-numero" : "PO number"}{" "}
                  <em className="font-normal text-[var(--muted)]">{fi ? "ohitus" : "override"}</em>
                </span>
                <input
                  name="pdfPoNumber"
                  className="mt-2 w-full rounded-xl border border-[var(--line)] px-4 py-3 text-sm"
                  placeholder="PO-45821"
                />
              </label>
            </div>

            <FilePicker
              name="pdfPurchaseOrder"
              accept="application/pdf,.pdf"
              title={fi ? "Valitse ostotilauksen PDF" : "Choose purchase order PDF"}
              hint={fi ? "PDF · enintään 10 MB" : "PDF · max 10 MB"}
              required
              locale={locale}
            />

            <button
              disabled={!openAiReady}
              className="upload-v2-primary-btn disabled:cursor-not-allowed disabled:opacity-40"
            >
              {fi ? "Käsittele ostotilaus" : "Process purchase order"} <span aria-hidden="true">→</span>
            </button>
          </form>
        </section>

        <section className="surface p-6">
          <div className="upload-v2-section-label">
            {fi ? "Rakenteinen ostotilaus" : "Structured purchase order"}
          </div>
          <h2 className="mt-2 text-2xl font-bold">
            {fi ? "Tuo CSV tai XLSX" : "Import CSV or XLSX"}
          </h2>
          <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
            {fi
              ? "Ohita AI ja tallenna valmiiksi rakenteiset PO-rivit suoraan."
              : "Skip AI and persist already structured PO lines directly."}
          </p>

          <form action="/api/purchase-orders/structured" method="post" encType="multipart/form-data" className="mt-6 space-y-4">
            <label className="block">
              <span className="text-sm font-semibold">
                {fi ? "Linkitä tarjoukseen" : "Link to quote"}{" "}
                <em className="font-normal text-[var(--muted)]">{fi ? "valinnainen" : "optional"}</em>
              </span>
              <select
                name="quoteId"
                defaultValue={selectedQuoteId}
                className="mt-2 w-full rounded-xl border border-[var(--line)] bg-white px-4 py-3 text-sm"
              >
                <option value="">{fi ? "Ei valittua tarjousta" : "No quote selected"}</option>
                {quoteOptions.map((quote: any) => {
                  const customer = Array.isArray(quote.customers) ? quote.customers[0] : quote.customers;
                  return (
                    <option key={quote.id} value={quote.id}>
                      {quote.quote_number || (fi ? "Tarjous" : "Quote")} · {customer?.name || "—"} · {quote.status}
                    </option>
                  );
                })}
              </select>
            </label>

            <div className="grid gap-4 md:grid-cols-2">
              <label>
                <span className="text-sm font-semibold">{fi ? "Asiakas" : "Customer"}</span>
                <input
                  name="customerName"
                  className="mt-2 w-full rounded-xl border border-[var(--line)] px-4 py-3 text-sm"
                  placeholder={fi ? "Pakollinen ilman valittua tarjousta" : "Required without a selected quote"}
                />
              </label>
              <label>
                <span className="text-sm font-semibold">{fi ? "PO-numero" : "PO number"}</span>
                <input
                  name="poNumber"
                  required
                  className="mt-2 w-full rounded-xl border border-[var(--line)] px-4 py-3 text-sm"
                  placeholder="PO-45821"
                />
              </label>
              <label>
                <span className="text-sm font-semibold">{fi ? "Valuutta" : "Currency"}</span>
                <input
                  name="currency"
                  maxLength={3}
                  className="mt-2 w-full rounded-xl border border-[var(--line)] px-4 py-3 text-sm uppercase"
                  placeholder="EUR"
                />
              </label>
              <label>
                <span className="text-sm font-semibold">{fi ? "Tilauspäivä" : "Order date"}</span>
                <input
                  name="orderDate"
                  type="date"
                  className="mt-2 w-full rounded-xl border border-[var(--line)] px-4 py-3 text-sm"
                />
              </label>
            </div>

            <FilePicker
              name="purchaseOrder"
              accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              title={fi ? "Valitse PO-tiedosto" : "Choose PO file"}
              hint="CSV / XLSX · SKU/description + quantity"
              required
              locale={locale}
            />

            <button className="upload-v2-secondary-btn">
              {fi ? "Tuo PO-rivit" : "Import PO lines"}
            </button>
          </form>
        </section>
      </div>

      <section className="surface mt-7 overflow-hidden">
        <div className="flex flex-wrap items-end justify-between gap-3 border-b border-[var(--line)] p-6">
          <div>
            <div className="upload-v2-section-label">
              {fi ? "PO-jono" : "Purchase order queue"}
            </div>
            <h2 className="mt-2 text-2xl font-bold">
              {fi ? "Viimeisimmät ostotilaukset" : "Recent purchase orders"}
            </h2>
          </div>
          <span className="text-sm text-[var(--muted)]">
            {rows.length} {fi ? "ostotilausta" : "purchase orders"}
          </span>
        </div>

        {rows.length ? (
          <div className="divide-y divide-[var(--line)]">
            {rows.map((po: any) => {
              const customer = Array.isArray(po.customers) ? po.customers[0] : po.customers;
              const quote = Array.isArray(po.quotes) ? po.quotes[0] : po.quotes;
              const lineCount = Array.isArray(po.purchase_order_lines)
                ? po.purchase_order_lines.length
                : 0;

              return (
                <Link
                  key={po.id}
                  href={`/app/purchase-orders/${po.id}`}
                  className="grid gap-3 p-5 transition hover:bg-[#fafbfa] md:grid-cols-[1.4fr_1fr_1fr_auto] md:items-center"
                >
                  <div>
                    <div className="text-xs font-bold uppercase tracking-wider text-[var(--muted)]">
                      {statusLabel(po.status, fi)}
                    </div>
                    <h3 className="mt-1 text-lg font-bold">{po.po_number}</h3>
                    <p className="text-sm text-[var(--muted)]">{customer?.name || "—"}</p>
                  </div>
                  <div className="text-sm">
                    <span className="block text-xs text-[var(--muted)]">{fi ? "Tarjous" : "Quote"}</span>
                    <strong>{quote?.quote_number || "—"}</strong>
                  </div>
                  <div className="text-sm">
                    <span className="block text-xs text-[var(--muted)]">{fi ? "Rivit" : "Lines"}</span>
                    <strong>{lineCount}</strong>
                    <span className="ml-2 text-[var(--muted)]">
                      · {new Date(po.received_at || po.created_at).toLocaleDateString(displayLocale)}
                    </span>
                  </div>
                  <span className="font-semibold">{fi ? "Avaa" : "Open"} →</span>
                </Link>
              );
            })}
          </div>
        ) : (
          <div className="p-8 text-center">
            <h3 className="text-xl font-bold">
              {fi ? "Ei ostotilauksia vielä." : "No purchase orders yet."}
            </h3>
            <p className="mt-2 text-sm text-[var(--muted)]">
              {fi
                ? "Lataa ensimmäinen asiakkaan PO yllä."
                : "Upload the first customer PO above."}
            </p>
          </div>
        )}
      </section>
    </div>
  );
}
