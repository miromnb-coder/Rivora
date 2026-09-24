import Link from "next/link";
import { requireWorkspace } from "@/lib/rivora/workspace";

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
      return { ...rfq, lineCount: count ?? 0, customerName: customer?.name ?? "Unknown customer" };
    })
  );

  const openCount = items.filter((item) => item.status !== "quoted").length;
  const needsReview = items.filter((item) => item.status === "needs_review").length;
  const ready = items.filter((item) => item.status === "ready").length;

  return (
    <div className="mx-auto max-w-6xl px-5 py-8 sm:px-8 lg:px-10 lg:py-10">
      <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
        <div>
          <div className="kicker">RFQ Inbox</div>
          <h1 className="mt-2 text-3xl font-extrabold tracking-[-.035em]">Real requests, ranked by confidence.</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--muted)]">
            High-confidence deterministic matches move forward automatically. Fuzzy or missing matches stay visible for review.
          </p>
        </div>
        <Link href="/app/upload" className="btn-primary text-center">Import & process</Link>
      </div>

      <div className="mt-8 grid gap-3 sm:grid-cols-3">
        <div className="surface p-5"><div className="text-xs font-bold uppercase tracking-wider text-[var(--muted)]">Open RFQs</div><div className="mt-2 text-3xl font-extrabold">{openCount}</div></div>
        <div className="surface p-5"><div className="text-xs font-bold uppercase tracking-wider text-[var(--muted)]">Ready</div><div className="mt-2 text-3xl font-extrabold">{ready}</div></div>
        <div className="surface p-5"><div className="text-xs font-bold uppercase tracking-wider text-[var(--muted)]">Need review</div><div className="mt-2 text-3xl font-extrabold">{needsReview}</div></div>
      </div>

      <div className="surface mt-6 overflow-hidden">
        <div className="border-b border-[var(--line)] px-5 py-4">
          <div className="font-bold">Recent requests</div>
          <div className="mt-1 text-xs text-[var(--muted)]">Live Supabase data · organization-scoped RLS enabled.</div>
        </div>

        {items.length ? (
          <div className="divide-y divide-[var(--line)]">
            {items.map((item: any) => (
              <Link key={item.id} href={`/app/rfq/${item.id}`} className="grid gap-3 px-5 py-4 transition hover:bg-[#fafbfa] sm:grid-cols-[1.2fr_1.8fr_.7fr_.8fr_.7fr] sm:items-center">
                <div><div className="text-sm font-bold">{item.reference || "Untitled RFQ"}</div><div className="mt-1 text-xs text-[var(--muted)]">{new Date(item.received_at).toLocaleString("fi-FI")}</div></div>
                <div><div className="text-sm font-semibold">{item.customerName}</div><div className="mt-1 text-xs text-[var(--muted)]">{String(item.source_type).toUpperCase()} · {item.lineCount} lines</div></div>
                <div className="text-sm font-bold">{Math.round(Number(item.overall_confidence ?? 0))}%</div>
                <div className={`status w-fit ${item.status === "ready" ? "green" : item.status === "needs_review" ? "amber" : "red"}`}>{String(item.status).replaceAll("_", " ")}</div>
                <div className="text-sm font-bold text-[var(--green)] sm:text-right">Review →</div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="px-5 py-12 text-center text-sm text-[var(--muted)]">
            No RFQs yet. Import a catalogue, then process your first customer request.
          </div>
        )}
      </div>
    </div>
  );
}
