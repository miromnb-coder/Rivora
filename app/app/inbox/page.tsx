import Link from "next/link";
import { inbox } from "@/lib/demo-data";

export default function InboxPage() {
  return (
    <div className="mx-auto max-w-6xl px-5 py-8 sm:px-8 lg:px-10 lg:py-10">
      <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
        <div>
          <div className="kicker">RFQ Inbox</div>
          <h1 className="mt-2 text-3xl font-extrabold tracking-[-.035em]">Turn incoming requests into review-ready quotes.</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--muted)]">Rivora extracts RFQ lines, resolves customer-specific product names and sends only uncertain matches to a human.</p>
        </div>
        <Link href="/app/upload" className="btn-primary text-center">Upload RFQ</Link>
      </div>

      <div className="mt-8 grid gap-3 sm:grid-cols-3">
        <div className="surface p-5"><div className="text-xs font-bold uppercase tracking-wider text-[var(--muted)]">Open RFQs</div><div className="mt-2 text-3xl font-extrabold">4</div></div>
        <div className="surface p-5"><div className="text-xs font-bold uppercase tracking-wider text-[var(--muted)]">Auto-resolved</div><div className="mt-2 text-3xl font-extrabold">81%</div></div>
        <div className="surface p-5"><div className="text-xs font-bold uppercase tracking-wider text-[var(--muted)]">Need review</div><div className="mt-2 text-3xl font-extrabold">14 lines</div></div>
      </div>

      <div className="surface mt-6 overflow-hidden">
        <div className="border-b border-[var(--line)] px-5 py-4">
          <div className="font-bold">Recent requests</div>
          <div className="mt-1 text-xs text-[var(--muted)]">Demo data — Supabase connection is prepared but not provisioned yet.</div>
        </div>
        <div className="divide-y divide-[var(--line)]">
          {inbox.map((item) => (
            <Link key={item.id} href={`/app/rfq/${item.id}`} className="grid gap-3 px-5 py-4 transition hover:bg-[#fafbfa] sm:grid-cols-[1.2fr_1.8fr_.7fr_.7fr_.9fr] sm:items-center">
              <div><div className="text-sm font-bold">{item.reference}</div><div className="mt-1 text-xs text-[var(--muted)]">{item.received}</div></div>
              <div><div className="text-sm font-semibold">{item.customer}</div><div className="mt-1 text-xs text-[var(--muted)]">{item.source} · {item.lines} lines</div></div>
              <div className="text-sm font-bold">{item.confidence}%</div>
              <div className={`status w-fit ${item.status === "Ready" ? "green" : "amber"}`}>{item.status}</div>
              <div className="text-sm font-bold text-[var(--green)] sm:text-right">Review →</div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
