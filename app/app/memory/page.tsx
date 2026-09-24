import { memories } from "@/lib/demo-data";

export default function MemoryPage() {
  return (
    <div className="mx-auto max-w-6xl px-5 py-8 sm:px-8 lg:px-10 lg:py-10">
      <div className="kicker">Product memory</div>
      <h1 className="mt-2 text-3xl font-extrabold tracking-[-.035em]">Customer language becomes reusable data.</h1>
      <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--muted)]">Every verified alias can eliminate a future search. This is the core learning loop in Rivora.</p>
      <div className="surface mt-7 overflow-hidden">
        <div className="grid grid-cols-[1.2fr_1fr_1fr] gap-4 border-b border-[var(--line)] bg-[#fafbfa] px-5 py-3 text-xs font-bold uppercase tracking-wider text-[var(--muted)] sm:grid-cols-[1.5fr_1fr_1.5fr_.7fr]">
          <div>Customer</div><div>Customer alias</div><div>Canonical product</div><div className="hidden sm:block">Usage</div>
        </div>
        <div className="divide-y divide-[var(--line)]">
          {memories.map((m) => <div key={`${m.customer}-${m.alias}`} className="grid grid-cols-[1.2fr_1fr_1fr] gap-4 px-5 py-4 text-sm sm:grid-cols-[1.5fr_1fr_1.5fr_.7fr]"><div className="font-semibold">{m.customer}</div><div className="font-extrabold">{m.alias}</div><div><div className="font-bold text-[var(--green)]">{m.product}</div><div className="mt-1 hidden text-xs text-[var(--muted)] md:block">{m.description}</div></div><div className="hidden sm:block"><span className="status green">{m.uses} uses</span></div></div>)}
        </div>
      </div>
    </div>
  );
}
