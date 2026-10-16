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

function normalizedKey(...parts: Array<string | null | undefined>) {
  return parts
    .map((part) => String(part || "").trim().toLowerCase())
    .filter(Boolean)
    .join("::");
}

function stageRank(stage: CaseRow["stage"]) {
  return { rfq: 1, quote: 2, po: 3, erp: 4, done: 5 }[stage];
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
  const quotesWithPurchaseOrders = new Set<string>();

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
      href: `/app/orders/case/rfq/${rfq.id}`,
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
      href: `/app/orders/case/quote/${quote.id}`,
      updatedAt: existing ? newest(existing.updatedAt, quote.updated_at) : quote.updated_at,
    });
    quoteToCase.set(String(quote.id), key);
  }

  for (const po of purchaseOrders ?? []) {
    const quote = relationOne<any>((po as any).quotes);
    const customer = relationOne<any>((po as any).customers);
    const upstreamKey =
      quote?.id && quoteToCase.has(String(quote.id))
        ? quoteToCase.get(String(quote.id))!
        : null;
    const key = `po:${po.id}`;
    const existing = upstreamKey ? rows.get(upstreamKey) : undefined;
    if (quote?.id) quotesWithPurchaseOrders.add(String(quote.id));
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
      href: `/app/orders/case/po/${po.id}`,
      updatedAt: existing ? newest(existing.updatedAt, po.updated_at) : po.updated_at,
    });
    poToCase.set(String(po.id), key);
  }

  for (const order of salesOrders ?? []) {
    const quote = relationOne<any>((order as any).quotes);
    const po = relationOne<any>((order as any).purchase_orders);
    const customer = relationOne<any>((order as any).customers);
    const key =
      po?.id && poToCase.has(String(po.id))
        ? poToCase.get(String(po.id))!
        : quote?.id && quoteToCase.has(String(quote.id))
          ? quoteToCase.get(String(quote.id))!
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
      href: `/app/orders/case/sales/${order.id}`,
      updatedAt: existing ? newest(existing.updatedAt, order.updated_at) : order.updated_at,
    });
  }

  for (const quoteId of quotesWithPurchaseOrders) {
    const upstreamKey = quoteToCase.get(quoteId);
    if (upstreamKey) {
      const upstream = rows.get(upstreamKey);
      if (upstream && (upstream.stage === "rfq" || upstream.stage === "quote")) {
        rows.delete(upstreamKey);
      }
    }
  }

  const displayCases = new Map<string, CaseRow>();
  for (const row of rows.values()) {
    const businessKey = row.poNumber
      ? normalizedKey(row.customer, row.quoteNumber, row.poNumber)
      : normalizedKey(
          row.customer,
          row.rfqReference || row.quoteNumber || row.key,
        );
    const existing = displayCases.get(businessKey);
    if (
      !existing ||
      stageRank(row.stage) > stageRank(existing.stage) ||
      (stageRank(row.stage) === stageRank(existing.stage) &&
        new Date(row.updatedAt).getTime() > new Date(existing.updatedAt).getTime())
    ) {
      displayCases.set(businessKey, row);
    }
  }

  const allCases = [...displayCases.values()].sort(
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


  const overviewStats = [
    [fi ? "Käsittelyssä" : "In progress", allCases.filter(row => row.stage !== "done").length],
    [fi ? "Vaatii huomiota" : "Needs attention", allCases.filter(row => row.attention).length],
    [fi ? "ERP-vaiheessa" : "ERP stage", allCases.filter(row => row.stage === "erp").length],
    [fi ? "Valmiit" : "Completed", allCases.filter(row => row.stage === "done").length],
  ] as const;

  return (
    <div className="app-page-v2 ml-unified-page ml-unified-orders">
      <header className="ml-page-head">
        <div className="ml-page-head-copy">
          <div className="ml-page-eyebrow">{fi ? "Työtila / Tilaukset" : "Workspace / Orders"}</div>
          <h1>{fi ? "Tilaukset" : "Orders"}</h1>
          <p>{fi ? "Tarjouspyynnöistä myyntitilauksiin. Yksi käsittelypolku kerrallaan." : "From RFQ to sales orders. One case at a time."}</p>
        </div>
        <Link href="/app/upload" className="ml-page-primary">+ {fi ? "Uusi tarjouspyyntö" : "New RFQ"}</Link>
      </header>

      <section className="ml-summary-section" aria-label={fi ? "Tilausten yhteenveto" : "Orders overview"}>
        <div className="ml-summary-grid">
          {overviewStats.map(([label, count]) => (
            <div className="ml-summary-tile" key={label}><span>{label}</span><strong>{count}</strong></div>
          ))}
        </div>
        <p className="ml-page-footnote">{fi ? "Yhteenveto näyttää ladattujen tapausten tilanteen. Se ei välttämättä kata kaikkia historiallisia tapahtumia." : "Summary of loaded cases; older records may not be included."}</p>
      </section>

      <section className="ml-unified-section" aria-label={fi ? "Tilaukset ja suodattimet" : "Orders and filters"}>
        <nav className="ml-filter-row" aria-label={fi ? "Tilaussuodattimet" : "Order filters"}>
          {filters.map(([id, label]) => (
            <Link key={id} href={id === "all" ? "/app/orders" : "/app/orders?view=" + id}
              className={"ml-filter-chip" + (view === id ? " is-active" : "")}
              aria-current={view === id ? "page" : undefined}>
              {label}
            </Link>
          ))}
        </nav>

        <div className="ml-section-heading ml-order-section-title">
          <div><div className="ml-page-eyebrow">{fi ? "Työjono" : "Work queue"}</div>
            <h2>{view === "attention" ? (fi ? "Vaatii huomiota" : "Needs attention") : (fi ? "Tilausasiat" : "Order cases")}</h2>
          </div>
          <span className="ml-order-count">{filtered.length} {fi ? "näkyvissä" : "shown"}</span>
        </div>

        {filtered.length ? (
          <div className="ml-orders-list">
            <div className="ml-orders-head" aria-hidden="true">
              <span>{fi ? "Asiakas ja viite" : "Customer and reference"}</span>
              <span>{fi ? "Vaihe" : "Stage"}</span>
              <span>{fi ? "Seuraava tehtävä" : "Next action"}</span>
            </div>
            {filtered.map((row) => {
              const reference = row.poNumber || row.quoteNumber || row.rfqReference || "—";
              return (
                <Link href={row.href} key={row.key} className="ml-order-item">
                  <div className="ml-order-identity">
                    <strong>{row.customer}</strong>
                    <span title={reference}>{reference}</span>
                  </div>
                  <div className="ml-order-stage">
                    <span className={"ml-page-status" + (row.attention ? " is-attention" : row.stage === "done" ? " is-complete" : "")}>{row.stageLabel}</span>
                  </div>
                  <div className="ml-order-action">
                    <strong>{row.nextAction}</strong>
                    <small>{new Date(row.updatedAt).toLocaleDateString(displayLocale)}</small>
                  </div>
                  <span className="ml-row-arrow" aria-hidden="true">→</span>
                </Link>
              );
            })}
          </div>
        ) : (
          <div className="ml-page-empty">
            <strong>{fi ? "Tässä näkymässä ei ole tilauksia." : "No orders in this view."}</strong>
            <p>{fi ? "Vaihda suodatinta tai aloita uusi tarjouspyyntö." : "Change the filter or start a new RFQ."}</p>
          </div>
        )}
      </section>
    </div>
  );
}
