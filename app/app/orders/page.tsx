import Link from "next/link";
import { requireWorkspace } from "@/lib/rivora/workspace";
import { formatLocale, getLocale } from "@/lib/locale";

function relationOne<T>(value: T | T[] | null | undefined): T | null {
  return Array.isArray(value) ? value[0] ?? null : value ?? null;
}

type CaseRow = {
  key: string;
  customer: string;
  rfqReference: string | null;
  quoteNumber: string | null;
  poNumber: string | null;
  stage: "rfq" | "quote" | "po" | "erp" | "done";
  stageLabel: string;
  nextAction: string;
  attention: boolean;
  href: string;
  updatedAt: string;
};

function newest(left: string, right: string) {
  return new Date(left).getTime() >= new Date(right).getTime() ? left : right;
}

export default async function OrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string }>;
}) {
  const [params, { supabase, workspace }, locale] = await Promise.all([
    searchParams,
    requireWorkspace(),
    getLocale(),
  ]);
  const fi = locale === "fi";
  const displayLocale = formatLocale(locale);

  const [
    { data: rfqs },
    { data: quotes },
    { data: purchaseOrders },
    { data: salesOrders },
  ] = await Promise.all([
    supabase
      .from("rfqs")
      .select("id,reference,status,received_at,customers(id,name)")
      .eq("organization_id", workspace.id)
      .order("received_at", { ascending: false })
      .limit(200),
    supabase
      .from("quotes")
      .select("id,quote_number,status,updated_at,customers(id,name),rfqs(id,reference)")
      .eq("organization_id", workspace.id)
      .order("updated_at", { ascending: false })
      .limit(200),
    supabase
      .from("purchase_orders")
      .select("id,po_number,status,updated_at,customers(id,name),quotes(id,quote_number)")
      .eq("organization_id", workspace.id)
      .order("updated_at", { ascending: false })
      .limit(200),
    supabase
      .from("sales_order_drafts")
      .select("id,status,customer_po_number,updated_at,customers(id,name),quotes(id,quote_number),purchase_orders(id,po_number)")
      .eq("organization_id", workspace.id)
      .order("updated_at", { ascending: false })
      .limit(200),
  ]);

  const rows = new Map<string, CaseRow>();
  const quoteToCase = new Map<string, string>();
  const poToCase = new Map<string, string>();

  for (const rfq of rfqs ?? []) {
    const customer = relationOne<any>((rfq as any).customers);
    const attention = rfq.status === "needs_review";
    const stageLabel =
      rfq.status === "needs_review"
        ? fi ? "Tarkista RFQ" : "Review RFQ"
        : rfq.status === "ready"
          ? fi ? "Valmis tarjoukseen" : "Ready to quote"
          : fi ? "Tarjouspyyntö" : "RFQ";
    const nextAction =
      rfq.status === "needs_review"
        ? fi ? "Tarkista tarjouspyyntö" : "Review RFQ"
        : rfq.status === "ready"
          ? fi ? "Luo tarjous" : "Create quote"
          : fi ? "Avaa tarjouspyyntö" : "Open RFQ";

    rows.set(`rfq:${rfq.id}`, {
      key: `rfq:${rfq.id}`,
      customer: customer?.name || (fi ? "Tuntematon asiakas" : "Unknown customer"),
      rfqReference: rfq.reference || null,
      quoteNumber: null,
      poNumber: null,
      stage: "rfq",
      stageLabel,
      nextAction,
      attention,
      href: `/app/rfq/${rfq.id}`,
      updatedAt: rfq.received_at,
    });
  }

  for (const quote of quotes ?? []) {
    const rfq = relationOne<any>((quote as any).rfqs);
    const customer = relationOne<any>((quote as any).customers);
    const key = rfq?.id && rows.has(`rfq:${rfq.id}`) ? `rfq:${rfq.id}` : `quote:${quote.id}`;
    const existing = rows.get(key);
    const attention = ["draft", "ready", "approved"].includes(String(quote.status));
    const stageLabel =
      quote.status === "sent"
        ? fi ? "Odottaa PO:ta" : "Waiting for PO"
        : quote.status === "approved"
          ? fi ? "Valmis lähetettäväksi" : "Ready to send"
          : quote.status === "ready"
            ? fi ? "Hyväksy tarjous" : "Approve quote"
            : fi ? "Tarjous kesken" : "Quote in progress";
    const nextAction =
      quote.status === "sent"
        ? fi ? "Lisää ostotilaus" : "Add purchase order"
        : quote.status === "approved"
          ? fi ? "Lähetä tarjous" : "Send quote"
          : quote.status === "ready"
            ? fi ? "Hyväksy tarjous" : "Approve quote"
            : fi ? "Viimeistele tarjous" : "Finish quote";

    rows.set(key, {
      key,
      customer: customer?.name || existing?.customer || (fi ? "Tuntematon asiakas" : "Unknown customer"),
      rfqReference: existing?.rfqReference || rfq?.reference || null,
      quoteNumber: quote.quote_number || null,
      poNumber: existing?.poNumber || null,
      stage: "quote",
      stageLabel,
      nextAction,
      attention,
      href: `/app/quotes/${quote.id}`,
      updatedAt: existing ? newest(existing.updatedAt, quote.updated_at) : quote.updated_at,
    });
    quoteToCase.set(String(quote.id), key);
  }

  for (const po of purchaseOrders ?? []) {
    const quote = relationOne<any>((po as any).quotes);
    const customer = relationOne<any>((po as any).customers);
    const key = quote?.id && quoteToCase.has(String(quote.id))
      ? quoteToCase.get(String(quote.id))!
      : `po:${po.id}`;
    const existing = rows.get(key);
    const attention = ["extracted", "needs_review", "matched"].includes(String(po.status));
    const stageLabel =
      po.status === "matched"
        ? fi ? "PO täsmää" : "PO matched"
        : po.status === "approved" || po.status === "ready_for_erp"
          ? fi ? "PO hyväksytty" : "PO approved"
          : po.status === "erp_created"
            ? fi ? "Valmis" : "Complete"
            : fi ? "PO tarkistettavana" : "PO review";
    const nextAction =
      po.status === "matched"
        ? fi ? "Hyväksy tilaus" : "Approve order"
        : po.status === "approved" || po.status === "ready_for_erp"
          ? fi ? "Luo myyntitilausluonnos" : "Create sales order draft"
          : po.status === "erp_created"
            ? fi ? "Avaa valmis tilaus" : "Open completed order"
            : fi ? "Tarkista tilaus" : "Review order";

    rows.set(key, {
      key,
      customer: customer?.name || existing?.customer || (fi ? "Tuntematon asiakas" : "Unknown customer"),
      rfqReference: existing?.rfqReference || null,
      quoteNumber: existing?.quoteNumber || quote?.quote_number || null,
      poNumber: po.po_number || null,
      stage: po.status === "erp_created" ? "done" : "po",
      stageLabel,
      nextAction,
      attention,
      href: `/app/purchase-orders/${po.id}`,
      updatedAt: existing ? newest(existing.updatedAt, po.updated_at) : po.updated_at,
    });
    poToCase.set(String(po.id), key);
  }

  for (const order of salesOrders ?? []) {
    const quote = relationOne<any>((order as any).quotes);
    const po = relationOne<any>((order as any).purchase_orders);
    const customer = relationOne<any>((order as any).customers);
    const key =
      quote?.id && quoteToCase.has(String(quote.id))
        ? quoteToCase.get(String(quote.id))!
        : po?.id && poToCase.has(String(po.id))
          ? poToCase.get(String(po.id))!
          : `sales:${order.id}`;
    const existing = rows.get(key);
    const done = order.status === "erp_created";
    const attention = ["draft", "erp_failed", "erp_partial"].includes(String(order.status));
    const stageLabel = done
      ? fi ? "Business Centralissa" : "In Business Central"
      : order.status === "erp_failed" || order.status === "erp_partial"
        ? fi ? "ERP vaatii huomiota" : "ERP needs attention"
        : fi ? "Valmis ERP:iin" : "Ready for ERP";
    const nextAction = done
      ? fi ? "Avaa myyntitilaus" : "Open sales order"
      : order.status === "erp_failed" || order.status === "erp_partial"
        ? fi ? "Tarkista ERP-vienti" : "Review ERP export"
        : fi ? "Luo Business Centraliin" : "Create in Business Central";

    rows.set(key, {
      key,
      customer: customer?.name || existing?.customer || (fi ? "Tuntematon asiakas" : "Unknown customer"),
      rfqReference: existing?.rfqReference || null,
      quoteNumber: existing?.quoteNumber || quote?.quote_number || null,
      poNumber: existing?.poNumber || po?.po_number || order.customer_po_number || null,
      stage: done ? "done" : "erp",
      stageLabel,
      nextAction,
      attention,
      href: `/app/sales-orders/${order.id}`,
      updatedAt: existing ? newest(existing.updatedAt, order.updated_at) : order.updated_at,
    });
  }

  const allCases = [...rows.values()].sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
  );

  const view = params.view || "all";
  const filtered = allCases.filter((row) => {
    if (view === "attention") return row.attention;
    if (view === "quote") return row.stage === "rfq" || row.stage === "quote";
    if (view === "po") return row.stage === "po";
    if (view === "erp") return row.stage === "erp";
    if (view === "done") return row.stage === "done";
    return true;
  });

  const filters = [
    ["all", fi ? "Kaikki" : "All"],
    ["attention", fi ? "Vaatii huomiota" : "Needs attention"],
    ["quote", fi ? "Tarjousvaihe" : "Quote stage"],
    ["po", fi ? "Ostotilaus" : "Purchase order"],
    ["erp", "ERP"],
    ["done", fi ? "Valmis" : "Complete"],
  ] as const;

  return (
    <div className="app-page-v2">
      <header className="flex flex-wrap items-end justify-between gap-6">
        <div>
          <div className="app-kicker-v2">{fi ? "Tilaukset" : "Orders"}</div>
          <h1 className="mt-3 text-4xl font-semibold tracking-[-0.045em] md:text-6xl">
            {fi ? "Yksi näkymä koko tilauspolulle." : "One view for the whole order journey."}
          </h1>
          <p className="mt-4 max-w-2xl text-sm leading-6 text-[var(--muted)]">
            {fi
              ? "Tarjouspyyntö, tarjous, asiakkaan PO ja ERP-vaihe näkyvät yhtenä jatkumona."
              : "RFQ, quote, customer PO and ERP stage stay together as one continuous case."}
          </p>
        </div>
        <Link href="/app/upload" className="upload-v2-primary-btn">
          + {fi ? "Uusi tarjouspyyntö" : "New RFQ"}
        </Link>
      </header>

      <nav className="mt-8 flex gap-2 overflow-x-auto pb-2" aria-label={fi ? "Tilaussuodattimet" : "Order filters"}>
        {filters.map(([id, label]) => (
          <Link
            key={id}
            href={id === "all" ? "/app/orders" : `/app/orders?view=${id}`}
            className={
              "whitespace-nowrap rounded-full border px-4 py-2 text-xs font-semibold transition " +
              (view === id
                ? "border-[#171a18] bg-[#171a18] text-white"
                : "border-[var(--line)] bg-white text-[var(--muted)] hover:text-[#171a18]")
            }
          >
            {label}
          </Link>
        ))}
      </nav>

      <section className="mt-5 overflow-hidden rounded-3xl border border-[var(--line)] bg-white">
        <div className="hidden grid-cols-[1.35fr_1fr_.8fr_1fr_auto] gap-4 border-b border-[var(--line)] bg-[#fafaf7] px-6 py-3 text-[10px] font-bold uppercase tracking-[.1em] text-[var(--muted)] md:grid">
          <span>{fi ? "Asiakas" : "Customer"}</span>
          <span>{fi ? "Viite" : "Reference"}</span>
          <span>{fi ? "Vaihe" : "Stage"}</span>
          <span>{fi ? "Seuraava tehtävä" : "Next action"}</span>
          <span>{fi ? "Päivitetty" : "Updated"}</span>
        </div>

        {filtered.length ? (
          <div className="divide-y divide-[var(--line)]">
            {filtered.map((row) => {
              const reference = row.poNumber || row.quoteNumber || row.rfqReference || "—";
              return (
                <Link
                  key={row.key}
                  href={row.href}
                  className="group grid gap-3 px-6 py-5 transition hover:bg-[#fafaf7] md:grid-cols-[1.35fr_1fr_.8fr_1fr_auto] md:items-center md:gap-4"
                >
                  <div>
                    <strong className="block text-[15px]">{row.customer}</strong>
                    <span className="mt-1 block text-xs text-[var(--muted)] md:hidden">{reference}</span>
                  </div>
                  <span className="hidden text-sm text-[var(--muted)] md:block">{reference}</span>
                  <span>
                    <span className={
                      "inline-flex rounded-full px-2.5 py-1 text-[10px] font-bold " +
                      (row.attention
                        ? "bg-[#f6efe3] text-[#765a30]"
                        : row.stage === "done"
                          ? "bg-[#eceeea] text-[#39423c]"
                          : "bg-[#f1f2ef] text-[#646a65]")
                    }>
                      {row.stageLabel}
                    </span>
                  </span>
                  <strong className="text-sm">{row.nextAction}</strong>
                  <span className="flex items-center gap-3 text-xs font-semibold text-[var(--muted)]">
                    {new Date(row.updatedAt).toLocaleDateString(displayLocale)}
                    <span className="text-[#171a18] transition group-hover:translate-x-1">→</span>
                  </span>
                </Link>
              );
            })}
          </div>
        ) : (
          <div className="p-10 text-center">
            <strong>{fi ? "Tässä näkymässä ei ole tilauksia." : "No orders in this view."}</strong>
            <p className="mt-2 text-sm text-[var(--muted)]">
              {fi ? "Vaihda suodatinta tai aloita uusi tarjouspyyntö." : "Change the filter or start a new RFQ."}
            </p>
          </div>
        )}
      </section>
    </div>
  );
}
