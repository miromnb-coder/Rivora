import Link from "next/link";
import { RfqReviewClient } from "@/components/RfqReviewClient";

export default async function RfqPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <div className="mx-auto max-w-6xl px-5 py-8 sm:px-8 lg:px-10 lg:py-10">
      <Link href="/app/inbox" className="text-sm font-bold text-[var(--green)]">← Back to inbox</Link>
      <div className="mt-5 mb-6 flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
        <div><div className="kicker">Human review</div><h1 className="mt-2 text-3xl font-extrabold tracking-[-.035em]">Resolve uncertain product matches.</h1><p className="mt-2 text-sm text-[var(--muted)]">RFQ ID: {id}. Confirmed corrections become customer-specific product memory.</p></div>
        <div className="status amber">Needs review</div>
      </div>
      <RfqReviewClient />
    </div>
  );
}
