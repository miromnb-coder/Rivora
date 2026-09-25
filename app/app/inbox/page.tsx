import Link from "next/link";
import { requireWorkspace } from "@/lib/rivora/workspace";

function statusTone(status: string) {
  if (status === "ready" || status === "quoted") return "ready";
  if (status === "needs_review") return "review";
  return "open";
}

export default async function InboxPage() {
  const { supabase } = await requireWorkspace();

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
      return {
        ...rfq,
        lineCount: count ?? 0,
        customerName: customer?.name ?? "Unknown customer",
      };
    })
  );

  const needsReview = items.filter((item) => item.status === "needs_review").length;
  const ready = items.filter((item) => item.status === "ready").length;
  const openCount = items.filter((item) => !["ready", "quoted"].includes(item.status)).length;

  const sortedItems = [...items].sort((a, b) => {
    const priority = (status: string) =>
      status === "needs_review" ? 0 : status === "ready" ? 1 : status === "quoted" ? 3 : 2;

    return (
      priority(a.status) - priority(b.status) ||
      new Date(b.received_at).getTime() - new Date(a.received_at).getTime()
    );
  });

  return (
    <div className="app-page-v2 inbox-v2">
      <header className="inbox-v2-head">
        <div>
          <div className="app-kicker-v2">RFQ inbox</div>
          <h1>Review what needs attention. Let the obvious matches move.</h1>
          <p>
            Requests are ordered by actionability: uncertain matches first, then quote-ready work,
            then the rest of the pipeline.
          </p>
        </div>

        <Link href="/app/upload" className="inbox-v2-primary">
          Process RFQ <span aria-hidden="true">→</span>
        </Link>
      </header>

      <section className="inbox-v2-summary" aria-label="RFQ summary">
        <Link href="#requests" className="inbox-v2-summary-item is-review">
          <span>Needs review</span>
          <strong>{needsReview}</strong>
          <small>Human decision required</small>
        </Link>

        <Link href="#requests" className="inbox-v2-summary-item">
          <span>Ready</span>
          <strong>{ready}</strong>
          <small>Resolved product lines</small>
        </Link>

        <Link href="#requests" className="inbox-v2-summary-item">
          <span>Open</span>
          <strong>{openCount}</strong>
          <small>Still in workflow</small>
        </Link>
      </section>

      <section className="inbox-v2-list" id="requests">
        <div className="inbox-v2-list-head">
          <div>
            <div className="upload-v2-section-label">Requests</div>
            <h2>Current RFQ queue</h2>
          </div>
          <span>{items.length} total</span>
        </div>

        {sortedItems.length ? (
          <div className="inbox-v2-rows">
            {sortedItems.map((item: any) => {
              const confidence = Math.round(Number(item.overall_confidence ?? 0));
              const tone = statusTone(item.status);

              return (
                <Link key={item.id} href={`/app/rfq/${item.id}`} className="inbox-v2-row">
                  <div className="inbox-v2-row-main">
                    <div className="inbox-v2-row-topline">
                      <span className={`inbox-v2-state ${tone}`}>
                        {String(item.status).replaceAll("_", " ")}
                      </span>
                      <span>{String(item.source_type).toUpperCase()}</span>
                      <span>{item.lineCount} lines</span>
                    </div>

                    <h3>{item.reference || "Untitled RFQ"}</h3>
                    <p>{item.customerName}</p>
                  </div>

                  <div className="inbox-v2-confidence">
                    <span>Confidence</span>
                    <strong>{confidence}%</strong>
                  </div>

                  <div className="inbox-v2-time">
                    <span>Received</span>
                    <strong>{new Date(item.received_at).toLocaleDateString("fi-FI")}</strong>
                    <small>{new Date(item.received_at).toLocaleTimeString("fi-FI", { hour: "2-digit", minute: "2-digit" })}</small>
                  </div>

                  <div className="inbox-v2-open">
                    {item.status === "needs_review" ? "Review" : "Open"} <span aria-hidden="true">→</span>
                  </div>
                </Link>
              );
            })}
          </div>
        ) : (
          <div className="inbox-v2-empty">
            <div className="upload-v2-section-label">No RFQs yet</div>
            <h3>Your first request will appear here.</h3>
            <p>Import a catalogue, then process a PDF, CSV or XLSX customer request.</p>
            <Link href="/app/upload" className="inbox-v2-primary">
              Process first RFQ <span aria-hidden="true">→</span>
            </Link>
          </div>
        )}
      </section>
    </div>
  );
}
