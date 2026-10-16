import Link from "next/link";
import { loadOrderCases } from "@/lib/rivora/order-cases";
import { requireWorkspace } from "@/lib/rivora/workspace";
import { formatLocale, getLocale } from "@/lib/locale";

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

  // Use the same order-case projection as the context-aware Copilot.
  const { cases: allCases } = await loadOrderCases(supabase, workspace.id, fi);

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
