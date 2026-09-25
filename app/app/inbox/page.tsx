import Link from "next/link";
import { requireWorkspace } from "@/lib/rivora/workspace";
import { getDictionary } from "@/lib/i18n";
import { formatLocale, getLocale } from "@/lib/locale";

function statusTone(status: string) {
  if (status === "ready" || status === "quoted") return "ready";
  if (status === "needs_review") return "review";
  return "open";
}

function statusLabel(status: string, locale: "fi" | "en") {
  const labels: Record<string, { fi: string; en: string }> = {
    needs_review: { fi: "Vaatii tarkistuksen", en: "Needs review" },
    ready: { fi: "Valmis", en: "Ready" },
    quoted: { fi: "Tarjottu", en: "Quoted" },
    failed: { fi: "Epäonnistui", en: "Failed" },
    processing: { fi: "Käsittelyssä", en: "Processing" },
  };
  return labels[status]?.[locale] ?? status.replaceAll("_", " ");
}

export default async function InboxPage() {
  const [{ supabase }, locale] = await Promise.all([requireWorkspace(), getLocale()]);
  const copy = getDictionary(locale).inbox;
  const dateLocale = formatLocale(locale);

  const { data: rfqs } = await supabase
    .from("rfqs")
    .select("id, reference, source_type, status, overall_confidence, received_at, customers(name)")
    .order("received_at", { ascending: false })
    .limit(50);

  const items = await Promise.all(
    (rfqs ?? []).map(async (rfq: any) => {
      const { count } = await supabase
        .from("rfq_lines")
        .select("id", { count: "exact", head: true })
        .eq("rfq_id", rfq.id);

      const customer = Array.isArray(rfq.customers) ? rfq.customers[0] : rfq.customers;
      return { ...rfq, lineCount: count ?? 0, customerName: customer?.name ?? copy.unknownCustomer };
    })
  );

  const needsReview = items.filter((item) => item.status === "needs_review").length;
  const ready = items.filter((item) => item.status === "ready").length;
  const openCount = items.filter((item) => !["ready", "quoted"].includes(item.status)).length;

  const sortedItems = [...items].sort((a, b) => {
    const priority = (status: string) =>
      status === "needs_review" ? 0 : status === "ready" ? 1 : status === "quoted" ? 3 : 2;
    return priority(a.status) - priority(b.status) ||
      new Date(b.received_at).getTime() - new Date(a.received_at).getTime();
  });

  return (
    <div className="app-page-v2 inbox-v2">
      <header className="inbox-v2-head">
        <div>
          <div className="app-kicker-v2">{copy.kicker}</div>
          <h1>{copy.title}</h1>
          <p>{copy.description}</p>
        </div>
        <Link href="/app/upload" className="inbox-v2-primary">
          {copy.process} <span aria-hidden="true">→</span>
        </Link>
      </header>

      <section className="inbox-v2-summary" aria-label="RFQ summary">
        <Link href="#requests" className="inbox-v2-summary-item is-review">
          <span>{copy.needsReview}</span><strong>{needsReview}</strong><small>{copy.humanRequired}</small>
        </Link>
        <Link href="#requests" className="inbox-v2-summary-item">
          <span>{copy.ready}</span><strong>{ready}</strong><small>{copy.resolved}</small>
        </Link>
        <Link href="#requests" className="inbox-v2-summary-item">
          <span>{copy.open}</span><strong>{openCount}</strong><small>{copy.workflow}</small>
        </Link>
      </section>

      <section className="inbox-v2-list" id="requests">
        <div className="inbox-v2-list-head">
          <div><div className="upload-v2-section-label">{copy.requests}</div><h2>{copy.queue}</h2></div>
          <span>{items.length} {copy.total}</span>
        </div>

        {sortedItems.length ? (
          <div className="inbox-v2-rows">
            {sortedItems.map((item: any) => {
              const confidence = Math.round(Number(item.overall_confidence ?? 0));
              return (
                <Link key={item.id} href={`/app/rfq/${item.id}`} className="inbox-v2-row">
                  <div className="inbox-v2-row-main">
                    <div className="inbox-v2-row-topline">
                      <span className={`inbox-v2-state ${statusTone(item.status)}`}>{statusLabel(item.status, locale)}</span>
                      <span>{String(item.source_type).toUpperCase()}</span><span>{item.lineCount} {copy.lines}</span>
                    </div>
                    <h3>{item.reference || copy.untitled}</h3><p>{item.customerName}</p>
                  </div>
                  <div className="inbox-v2-confidence"><span>{copy.confidence}</span><strong>{confidence}%</strong></div>
                  <div className="inbox-v2-time">
                    <span>{copy.received}</span>
                    <strong>{new Date(item.received_at).toLocaleDateString(dateLocale)}</strong>
                    <small>{new Date(item.received_at).toLocaleTimeString(dateLocale, { hour: "2-digit", minute: "2-digit" })}</small>
                  </div>
                  <div className="inbox-v2-open">
                    {item.status === "needs_review" ? copy.review : copy.open} <span aria-hidden="true">→</span>
                  </div>
                </Link>
              );
            })}
          </div>
        ) : (
          <div className="inbox-v2-empty">
            <div className="upload-v2-section-label">{copy.noRfqs}</div>
            <h3>{copy.firstTitle}</h3><p>{copy.firstBody}</p>
            <Link href="/app/upload" className="inbox-v2-primary">{copy.firstAction} <span aria-hidden="true">→</span></Link>
          </div>
        )}
      </section>
    </div>
  );
}
