import Link from "next/link";
import { formatLocale, getLocale } from "@/lib/locale";
import { requireWorkspace } from "@/lib/rivora/workspace";

function statusLabel(status: string, fi: boolean) {
  const labels: Record<string, string> = fi
    ? {
        draft: "Luonnos",
        erp_pending: "Viedään ERP:iin",
        erp_created: "Luotu ERP:iin",
        erp_partial: "Vaatii ERP-tarkistuksen",
        erp_failed: "ERP-vienti epäonnistui",
      }
    : {
        draft: "Draft",
        erp_pending: "Sending to ERP",
        erp_created: "Created in ERP",
        erp_partial: "ERP review required",
        erp_failed: "ERP export failed",
      };
  return labels[status] ?? status;
}

export default async function SalesOrdersPage() {
  const [locale, context] = await Promise.all([getLocale(), requireWorkspace()]);
  const { supabase, workspace } = context;
  const fi = locale === "fi";
  const displayLocale = formatLocale(locale);

  const { data: drafts } = await supabase
    .from("sales_order_drafts")
    .select(
      "id,status,customer_po_number,order_date,currency,external_order_number,created_at,customers(name),purchase_orders(po_number),quotes(quote_number),sales_order_draft_lines(id)",
    )
    .eq("organization_id", workspace.id)
    .order("created_at", { ascending: false })
    .limit(100);

  return (
    <div className="app-page-v2">
      <header className="mb-7">
        <div className="app-kicker-v2">{fi ? "Myyntitilaukset" : "Sales orders"}</div>
        <h1 className="mt-2 max-w-4xl text-4xl font-bold tracking-tight">
          {fi
            ? "Hyväksytystä PO:sta ERP-valmiiksi myyntitilausluonnokseksi."
            : "From approved PO to ERP-ready sales order draft."}
        </h1>
        <p className="mt-3 max-w-3xl text-[var(--muted)]">
          {fi
            ? "Averomira lukitsee hyväksytyn reconciliationin kaupallisen tilannekuvan ennen ERP-vientiä. Business Central -vienti luo vain Draft-tilauksen."
            : "Averomira locks the approved reconciliation snapshot before ERP export. Business Central export creates a Draft order only."}
        </p>
      </header>

      <section className="surface overflow-hidden">
        <div className="flex flex-wrap items-end justify-between gap-3 border-b border-[var(--line)] p-6">
          <div>
            <div className="upload-v2-section-label">
              {fi ? "Sales Order Draft -jono" : "Sales Order Draft queue"}
            </div>
            <h2 className="mt-2 text-2xl font-bold">
              {fi ? "ERP-valmistelu" : "ERP preparation"}
            </h2>
          </div>
          <span className="text-sm text-[var(--muted)]">
            {drafts?.length ?? 0} {fi ? "luonnosta" : "drafts"}
          </span>
        </div>

        {(drafts ?? []).length ? (
          <div className="divide-y divide-[var(--line)]">
            {(drafts ?? []).map((draft: any) => {
              const customer = Array.isArray(draft.customers) ? draft.customers[0] : draft.customers;
              const po = Array.isArray(draft.purchase_orders) ? draft.purchase_orders[0] : draft.purchase_orders;
              const quote = Array.isArray(draft.quotes) ? draft.quotes[0] : draft.quotes;
              const lineCount = Array.isArray(draft.sales_order_draft_lines)
                ? draft.sales_order_draft_lines.length
                : 0;

              return (
                <Link
                  key={draft.id}
                  href={`/app/sales-orders/${draft.id}`}
                  className="grid gap-3 p-5 transition hover:bg-[#fafbfa] md:grid-cols-[1.4fr_1fr_1fr_auto] md:items-center"
                >
                  <div>
                    <div className="text-xs font-bold uppercase tracking-wider text-[var(--muted)]">
                      {statusLabel(String(draft.status), fi)}
                    </div>
                    <h3 className="mt-1 text-lg font-bold">{draft.customer_po_number}</h3>
                    <p className="text-sm text-[var(--muted)]">{customer?.name || "—"}</p>
                  </div>
                  <div className="text-sm">
                    <span className="block text-xs text-[var(--muted)]">PO / {fi ? "tarjous" : "quote"}</span>
                    <strong>{po?.po_number || draft.customer_po_number}</strong>
                    <span className="ml-2 text-[var(--muted)]">· {quote?.quote_number || "—"}</span>
                  </div>
                  <div className="text-sm">
                    <span className="block text-xs text-[var(--muted)]">{fi ? "Rivit" : "Lines"}</span>
                    <strong>{lineCount}</strong>
                    <span className="ml-2 text-[var(--muted)]">
                      · {new Date(draft.created_at).toLocaleDateString(displayLocale)}
                    </span>
                  </div>
                  <span className="font-semibold">
                    {draft.external_order_number || (fi ? "Avaa" : "Open")} →
                  </span>
                </Link>
              );
            })}
          </div>
        ) : (
          <div className="p-8 text-center">
            <h3 className="text-xl font-bold">
              {fi ? "Ei myyntitilausluonnoksia vielä." : "No sales order drafts yet."}
            </h3>
            <p className="mt-2 text-sm text-[var(--muted)]">
              {fi
                ? "Hyväksy PO reconciliation ja luo luonnos ostotilauksen sivulta."
                : "Approve a PO reconciliation, then create a draft from the purchase order page."}
            </p>
            <Link href="/app/purchase-orders" className="mt-4 inline-block font-semibold">
              {fi ? "Avaa ostotilaukset" : "Open purchase orders"} →
            </Link>
          </div>
        )}
      </section>
    </div>
  );
}
