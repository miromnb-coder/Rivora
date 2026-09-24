"use client";

import { useMemo, useState } from "react";
import { demoRfq, products } from "@/lib/demo-data";

const money = new Intl.NumberFormat("en-FI", { style: "currency", currency: "EUR" });

export function RfqReviewClient() {
  const [selections, setSelections] = useState<Record<string, string | null>>(
    Object.fromEntries(demoRfq.lines.map((line) => [line.id, line.selectedProductId]))
  );
  const [confirmed, setConfirmed] = useState<Record<string, boolean>>({ l1: true, l3: true });
  const [remembered, setRemembered] = useState<Record<string, boolean>>({ l1: true, l3: true });

  const resolved = demoRfq.lines.filter((line) => selections[line.id]).length;
  const total = useMemo(() => demoRfq.lines.reduce((sum, line) => {
    const product = products.find((p) => p.id === selections[line.id]);
    return sum + (product?.unitPrice ?? 0) * line.quantity;
  }, 0), [selections]);

  return (
    <>
      <div className="surface overflow-hidden">
        <div className="grid gap-3 border-b border-[var(--line)] px-5 py-4 sm:grid-cols-4">
          <div><div className="text-xs text-[var(--muted)]">Customer</div><div className="mt-1 text-sm font-bold">{demoRfq.customer}</div></div>
          <div><div className="text-xs text-[var(--muted)]">Reference</div><div className="mt-1 text-sm font-bold">{demoRfq.reference}</div></div>
          <div><div className="text-xs text-[var(--muted)]">Source</div><div className="mt-1 text-sm font-bold">{demoRfq.source}</div></div>
          <div><div className="text-xs text-[var(--muted)]">Resolved</div><div className="mt-1 text-sm font-bold">{resolved}/{demoRfq.lines.length} lines</div></div>
        </div>

        <div className="divide-y divide-[var(--line)]">
          {demoRfq.lines.map((line) => {
            const top = line.candidates[0];
            const confidence = top?.confidence ?? 0;
            const tone = confidence >= 90 ? "green" : confidence >= 65 ? "amber" : "red";
            const selected = products.find((p) => p.id === selections[line.id]);
            return (
              <div key={line.id} className="p-5">
                <div className="grid gap-5 lg:grid-cols-[1fr_1.35fr_.65fr]">
                  <div>
                    <div className="flex items-center gap-2"><span className="text-xs font-bold text-[var(--muted)]">LINE {line.lineNumber}</span><span className={`status ${tone}`}>{confidence ? `${confidence}%` : "No match"}</span></div>
                    <div className="mt-3 text-sm font-extrabold">{line.customerSku}</div>
                    <div className="mt-1 text-sm text-[var(--muted)]">{line.description}</div>
                    <div className="mt-2 text-sm"><b>{line.quantity}</b> {line.unit}</div>
                  </div>

                  <div>
                    <div className="text-xs font-bold uppercase tracking-wider text-[var(--muted)]">Matched product</div>
                    <select
                      value={selections[line.id] ?? ""}
                      onChange={(e) => { setSelections((s) => ({ ...s, [line.id]: e.target.value || null })); setConfirmed((s) => ({ ...s, [line.id]: false })); }}
                      className="mt-2 w-full rounded-xl border border-[var(--line)] bg-white px-3 py-3 text-sm font-semibold outline-none focus:border-[var(--green)]"
                    >
                      <option value="">Select product…</option>
                      {products.map((product) => <option key={product.id} value={product.id}>{product.sku} — {product.name}</option>)}
                    </select>
                    {selected && <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-[var(--muted)]"><span>{selected.manufacturer}</span><span>{money.format(selected.unitPrice)} / {selected.unit}</span><span>{selected.stock} in stock</span></div>}
                  </div>

                  <div className="flex flex-col items-start justify-center gap-2 lg:items-end">
                    <button disabled={!selected} onClick={() => setConfirmed((s) => ({ ...s, [line.id]: true }))} className={`btn-primary min-w-28 ${!selected ? "opacity-40" : ""}`}>{confirmed[line.id] ? "Confirmed ✓" : "Confirm"}</button>
                    <label className="flex items-center gap-2 text-xs text-[var(--muted)]"><input type="checkbox" checked={!!remembered[line.id]} onChange={(e) => setRemembered((s) => ({ ...s, [line.id]: e.target.checked }))} /> Remember for customer</label>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="mt-5 flex flex-col justify-between gap-4 rounded-2xl bg-[#10251b] p-5 text-white sm:flex-row sm:items-center">
        <div><div className="text-xs font-bold uppercase tracking-wider text-white/50">Draft quote value</div><div className="mt-1 text-2xl font-extrabold">{money.format(total)}</div><div className="mt-1 text-xs text-white/55">Demo catalogue prices · no ERP write-back</div></div>
        <button disabled={Object.values(confirmed).filter(Boolean).length < demoRfq.lines.length} className="rounded-xl bg-white px-5 py-3 text-sm font-extrabold text-[#10251b] disabled:cursor-not-allowed disabled:opacity-30">Create quote draft</button>
      </div>
    </>
  );
}
