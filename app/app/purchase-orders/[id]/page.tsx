import Link from "next/link";
import { ContextHelpTrigger } from "@/components/support/ContextHelpTrigger";
import { notFound } from "next/navigation";
import { formatLocale, getLocale } from "@/lib/locale";
import {
  extractionConfidenceLabel,
  extractionConfidenceNeedsReview,
} from "@/lib/rivora/confidence";
import { requireWorkspace } from "@/lib/rivora/workspace";
import { ReconciliationPanel } from "./ReconciliationPanel";
import { createSalesOrderDraftAction } from "../../sales-orders/actions";

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

function numberOrDash(value: unknown, locale: string) {
  const number = Number(value);
  return Number.isFinite(number) ? number.toLocaleString(locale) : "—";
}

export default async function PurchaseOrderDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; reconcileError?: string; reconciled?: string }>;
}) {
  const [{ id }, query, locale, context] = await Promise.all([
    params,
    searchParams,
    getLocale(),
    requireWorkspace(),
  ]);

  const { supabase, workspace } = context;
  const fi = locale === "fi";
  const displayLocale = formatLocale(locale);

  const { data: purchaseOrder } = await supabase
    .from("purchase_orders")
    .select(
      "id,customer_id,quote_id,po_number,quote_reference,status,currency,order_date,source_type,source_file_name,overall_confidence,extraction_provider,extraction_model,extraction_confidence,extraction_warnings,processing_error,received_at,created_at,updated_at,customers(name),quotes(quote_number,status,currency)"
    )
    .eq("id", id)
    .eq("organization_id", workspace.id)
    .maybeSingle();

  if (!purchaseOrder) notFound();

  const [
    { data: lines },
    { data: files },
    { data: reconciliationRows },
    { data: quoteOptions },
  ] = await Promise.all([
    supabase
      .from("purchase_order_lines")
      .select(
        "id,line_number,customer_sku,raw_description,manufacturer,manufacturer_part_number,quantity,unit,unit_price,line_total,extraction_confidence,source_page,extraction_notes"
      )
      .eq("purchase_order_id", id)
      .eq("organization_id", workspace.id)
      .order("line_number"),
    supabase
      .from("purchase_order_files")
      .select("id,file_name,mime_type,size_bytes,sha256,created_at")
      .eq("purchase_order_id", id)
      .eq("organization_id", workspace.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("purchase_order_reconciliations")
      .select(
        "id,purchase_order_id,quote_id,run_number,algorithm_version,status,header_exceptions,header_review_status,header_review_note,summary,created_at,reviewed_at"
      )
      .eq("purchase_order_id", id)
      .eq("organization_id", workspace.id)
      .order("run_number", { ascending: false })
      .limit(1),
    supabase
      .from("quotes")
      .select("id,quote_number,status,currency")
      .eq("organization_id", workspace.id)
      .eq("customer_id", purchaseOrder.customer_id)
      .in("status", ["approved", "sent"])
      .order("updated_at", { ascending: false })
      .limit(100),
  ]);

  const reconciliation = reconciliationRows?.[0] ?? null;
  const [{ data: reconciliationLines }, { data: salesOrderDraft }] = await Promise.all([
    reconciliation
      ? supabase
          .from("purchase_order_reconciliation_lines")
          .select(
            "id,reconciliation_id,purchase_order_id,po_line_id,quote_line_id,line_kind,match_method,match_score,exception_codes,review_status,review_note,reviewed_at,po_snapshot,quote_snapshot"
          )
          .eq("reconciliation_id", reconciliation.id)
          .eq("organization_id", workspace.id)
          .order("created_at")
      : Promise.resolve({ data: [] as any[] }),
    supabase
      .from("sales_order_drafts")
      .select("id,status,external_order_number")
      .eq("purchase_order_id", id)
      .eq("organization_id", workspace.id)
      .maybeSingle(),
  ]);

  const customer = Array.isArray((purchaseOrder as any).customers)
    ? (purchaseOrder as any).customers[0]
    : (purchaseOrder as any).customers;
  const quote = Array.isArray((purchaseOrder as any).quotes)
    ? (purchaseOrder as any).quotes[0]
    : (purchaseOrder as any).quotes;
  const warnings = Array.isArray(purchaseOrder.extraction_warnings)
    ? purchaseOrder.extraction_warnings.filter((item): item is string => typeof item === "string")
    : [];
  const money = new Intl.NumberFormat(displayLocale, {
    style: "currency",
    currency: purchaseOrder.currency || "EUR",
  });

  return (
    <div className="app-page-v2">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <Link href="/app/purchase-orders" className="text-sm font-semibold">
          ← {fi ? "Ostotilaukset" : "Purchase orders"}
        </Link>
        {purchaseOrder.quote_id ? (
          <Link
            href={`/app/quotes/${purchaseOrder.quote_id}`}
            className="text-sm font-semibold"
          >
            {fi ? "Avaa linkitetty tarjous" : "Open linked quote"} →
          </Link>
        ) : null}
      </div>

      <header className="flex flex-wrap items-start justify-between gap-5">
        <div>
          <div className="app-kicker-v2">
            {fi ? "Purchase Order" : "Purchase order"}
          </div>
          <div className="support-heading-with-help mt-2">
            <h1 className="text-4xl font-bold tracking-tight">
              {purchaseOrder.po_number}
            </h1>
            <ContextHelpTrigger
              articleId="po-exceptions"
              label={fi ? "Ohje: ostotilauksen poikkeamat" : "Help: purchase-order exceptions"}
            />
          </div>
          <p className="mt-3 text-[var(--muted)]">
            {customer?.name || (fi ? "Tuntematon asiakas" : "Unknown customer")}
            {quote?.quote_number ? ` · ${fi ? "Tarjous" : "Quote"} ${quote.quote_number}` : ""}
            {purchaseOrder.order_date
              ? ` · ${new Date(`${purchaseOrder.order_date}T12:00:00Z`).toLocaleDateString(displayLocale)}`
              : ""}
          </p>
        </div>
        <span className="rounded-full border border-[var(--line)] bg-white px-4 py-2 text-sm font-bold">
          {statusLabel(purchaseOrder.status, fi)}
        </span>
      </header>

      {query.error || query.reconcileError || purchaseOrder.processing_error ? (
        <section className="upload-v2-alert error mt-6">
          {query.error || query.reconcileError || purchaseOrder.processing_error}
        </section>
      ) : null}

      {query.reconciled ? (
        <section className="upload-v2-alert success mt-6">
          {query.reconciled}
        </section>
      ) : null}

      {extractionConfidenceNeedsReview(purchaseOrder.extraction_confidence) ? (
        <section className="surface mt-6 border border-[#edd7a8] bg-[#fffaf0] p-5">
          <div className="upload-v2-section-label">
            {fi ? "Matala poiminnan varmuus" : "Low extraction confidence"}
          </div>
          <p className="mt-2 text-sm text-[var(--muted)]">
            {fi
              ? "AI:n varmuus on alle 60 %. Tarkista lähdedokumentti ja rivit erityisen huolellisesti ennen hyväksyntää."
              : "AI confidence is below 60%. Review the source document and extracted lines carefully before approval."}
          </p>
        </section>
      ) : null}

      {warnings.length ? (
        <section className="surface mt-6 p-5">
          <div className="upload-v2-section-label">
            {fi ? "Poiminnan varoitukset" : "Extraction warnings"}
          </div>
          <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-[var(--muted)]">
            {warnings.map((warning, index) => (
              <li key={`${index}-${warning}`}>{warning}</li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="surface p-5">
          <span className="text-xs font-bold uppercase tracking-wider text-[var(--muted)]">
            {fi ? "Asiakas" : "Customer"}
          </span>
          <strong className="mt-2 block text-lg">{customer?.name || "—"}</strong>
        </div>
        <div className="surface p-5">
          <span className="text-xs font-bold uppercase tracking-wider text-[var(--muted)]">
            {fi ? "Tarjousviite" : "Quote reference"}
          </span>
          <strong className="mt-2 block text-lg">
            {purchaseOrder.quote_reference || quote?.quote_number || "—"}
          </strong>
        </div>
        <div className="surface p-5">
          <span className="text-xs font-bold uppercase tracking-wider text-[var(--muted)]">
            {fi ? "Valuutta" : "Currency"}
          </span>
          <strong className="mt-2 block text-lg">{purchaseOrder.currency}</strong>
        </div>
        <div className="surface p-5">
          <span className="text-xs font-bold uppercase tracking-wider text-[var(--muted)]">
            {fi ? "Poiminnan varmuus" : "Extraction confidence"}
          </span>
          <strong className="mt-2 block text-lg">
            {purchaseOrder.extraction_confidence == null
              ? fi
                ? "Rakenteinen tuonti"
                : "Structured import"
              : extractionConfidenceLabel(purchaseOrder.extraction_confidence) ?? "—"}
          </strong>
        </div>
      </section>

      <ReconciliationPanel
        locale={locale}
        displayLocale={displayLocale}
        workspaceRole={workspace.role}
        purchaseOrder={purchaseOrder}
        linkedQuote={quote}
        quoteOptions={quoteOptions ?? []}
        reconciliation={reconciliation}
        lines={reconciliationLines ?? []}
      />

      <section className="surface mt-6 overflow-hidden">
        <div className="flex flex-wrap items-end justify-between gap-3 border-b border-[var(--line)] p-6">
          <div>
            <div className="upload-v2-section-label">
              {fi ? "Poimitut rivit" : "Extracted lines"}
            </div>
            <h2 className="mt-2 text-2xl font-bold">
              {lines?.length ?? 0} {fi ? "tilausriviä" : "order lines"}
            </h2>
          </div>
          <span className="text-sm text-[var(--muted)]">
            {fi ? "Lähdedata vertailun alla" : "Source data used by reconciliation"}
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[940px] text-left text-sm">
            <thead className="border-b border-[var(--line)] bg-[#fafbfa] text-xs uppercase tracking-wider text-[var(--muted)]">
              <tr>
                <th className="px-5 py-3">#</th>
                <th className="px-5 py-3">{fi ? "Tuotetunniste" : "Product identifier"}</th>
                <th className="px-5 py-3">{fi ? "Kuvaus" : "Description"}</th>
                <th className="px-5 py-3">{fi ? "Määrä" : "Quantity"}</th>
                <th className="px-5 py-3">{fi ? "Yksikköhinta" : "Unit price"}</th>
                <th className="px-5 py-3">{fi ? "Rivisumma" : "Line total"}</th>
                <th className="px-5 py-3">{fi ? "Lähde" : "Source"}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--line)]">
              {(lines ?? []).map((line: any) => {
                const identifier =
                  line.customer_sku || line.manufacturer_part_number || "—";
                return (
                  <tr key={line.id} className="align-top">
                    <td className="px-5 py-4 font-semibold">{line.line_number}</td>
                    <td className="px-5 py-4">
                      <strong className="block">{identifier}</strong>
                      {line.manufacturer ? (
                        <span className="mt-1 block text-xs text-[var(--muted)]">
                          {line.manufacturer}
                        </span>
                      ) : null}
                    </td>
                    <td className="max-w-md px-5 py-4">
                      <span>{line.raw_description || "—"}</span>
                      {line.extraction_notes ? (
                        <small className="mt-1 block text-[var(--muted)]">
                          {line.extraction_notes}
                        </small>
                      ) : null}
                    </td>
                    <td className="px-5 py-4 font-semibold">
                      {numberOrDash(line.quantity, displayLocale)} {line.unit || ""}
                    </td>
                    <td className="px-5 py-4">
                      {line.unit_price == null ? "—" : money.format(Number(line.unit_price))}
                    </td>
                    <td className="px-5 py-4">
                      {line.line_total == null ? "—" : money.format(Number(line.line_total))}
                    </td>
                    <td className="px-5 py-4 text-xs text-[var(--muted)]">
                      {line.source_page ? `${fi ? "Sivu" : "Page"} ${line.source_page}` : "—"}
                      {line.extraction_confidence != null ? (
                        <span className="mt-1 block">
                          {extractionConfidenceLabel(line.extraction_confidence)}{" "}
                          {fi ? "varmuus" : "confidence"}
                        </span>
                      ) : null}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <section className="surface p-6">
          <div className="upload-v2-section-label">
            {fi ? "Lähdetiedosto" : "Source file"}
          </div>
          {files?.length ? (
            <div className="mt-4 space-y-3">
              {files.map((file: any) => (
                <div
                  key={file.id}
                  className="rounded-xl border border-[var(--line)] p-4"
                >
                  <strong className="block">{file.file_name}</strong>
                  <span className="mt-1 block text-xs text-[var(--muted)]">
                    {(Number(file.size_bytes) / 1024).toLocaleString(displayLocale, {
                      maximumFractionDigits: 1,
                    })}{" "}
                    KB · SHA-256 {String(file.sha256).slice(0, 12)}…
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-3 text-sm text-[var(--muted)]">
              {fi ? "Lähdetiedostoa ei ole tallennettu." : "No source file stored."}
            </p>
          )}
        </section>

        <section className="surface p-6">
          <div className="upload-v2-section-label">
            {fi ? "Seuraava vaihe" : "Next step"}
          </div>
          <h2 className="mt-2 text-2xl font-bold">Sales Order Draft</h2>
          {salesOrderDraft ? (
            <>
              <p className="mt-3 text-sm leading-6 text-[var(--muted)]">
                {fi
                  ? "Tälle PO:lle on jo luotu lukittu myyntitilausluonnos."
                  : "A locked sales order draft already exists for this PO."}
              </p>
              <Link
                href={`/app/sales-orders/${salesOrderDraft.id}`}
                className="upload-v2-primary-btn mt-5 inline-flex"
              >
                {fi ? "Avaa Sales Order Draft" : "Open Sales Order Draft"} →
              </Link>
            </>
          ) : purchaseOrder.status === "approved" && ["owner", "admin"].includes(workspace.role) ? (
            <>
              <p className="mt-3 text-sm leading-6 text-[var(--muted)]">
                {fi
                  ? "Luo hyväksytystä reconciliationista ERP-riippumaton myyntitilausluonnos. PO:n hyväksytyt kaupalliset arvot lukitaan tähän snapshotiin."
                  : "Create an ERP-independent sales order draft from the approved reconciliation. Accepted PO commercial values are locked into this snapshot."}
              </p>
              <form action={createSalesOrderDraftAction} className="mt-5">
                <input type="hidden" name="purchaseOrderId" value={purchaseOrder.id} />
                <button className="upload-v2-primary-btn">
                  {fi ? "Luo Sales Order Draft" : "Create Sales Order Draft"} →
                </button>
              </form>
            </>
          ) : (
            <div className="mt-4 rounded-xl bg-[#fafbfa] p-4 text-sm text-[var(--muted)]">
              {fi
                ? "Sales Order Draft voidaan luoda vasta, kun viimeisin PO reconciliation on hyväksytty owner/admin-oikeuksilla."
                : "A Sales Order Draft can be created only after the latest PO reconciliation is approved by an owner/admin."}
            </div>
          )}
          <div className="mt-4 rounded-xl bg-[var(--green-soft)] p-4 text-sm text-[var(--green-dark)]">
            {workspace.erpProvider === "business_central"
              ? (fi
                  ? "Business Central -adapteri luo vain Draft-orderin. Se ei postaa, toimita tai laskuta tilausta."
                  : "The Business Central adapter creates a Draft order only. It does not post, ship or invoice the order.")
              : workspace.erpProvider === "custom"
                ? (fi
                    ? "Muu ERP on valittu. Sales Order Draft voidaan luoda nyt, mutta automaattinen ERP-vienti aktivoidaan vasta integraation valmistuttua."
                    : "Another ERP is selected. The Sales Order Draft can be created now, but automatic ERP export is enabled only after the integration is ready.")
                : (fi
                    ? "ERP-integraatio ei ole käytössä. Sales Order Draft voidaan silti luoda ja käsitellä Averomirassa."
                    : "ERP integration is disabled. The Sales Order Draft can still be created and handled in Averomira.")}
          </div>
        </section>
      </div>
    </div>
  );
}
