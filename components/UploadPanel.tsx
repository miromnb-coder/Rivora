"use client";

import { useState } from "react";
import Link from "next/link";

export function UploadPanel() {
  const [fileName, setFileName] = useState<string | null>(null);
  const [catalogue, setCatalogue] = useState<string | null>(null);

  return (
    <div className="grid gap-5 lg:grid-cols-[1.3fr_.7fr]">
      <div className="surface p-6">
        <div className="text-lg font-extrabold">1. Add a customer RFQ</div>
        <p className="mt-1 text-sm leading-6 text-[var(--muted)]">PDF, XLSX or CSV. Email ingestion comes after the core review loop is validated.</p>
        <label className="mt-5 flex min-h-52 cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-[#bdc8c1] bg-[#fafcfb] px-6 text-center transition hover:border-[var(--green)] hover:bg-[#f6faf7]">
          <input className="hidden" type="file" accept=".pdf,.xlsx,.xls,.csv" onChange={(e) => setFileName(e.target.files?.[0]?.name ?? null)} />
          <div className="text-4xl">↑</div>
          <div className="mt-3 font-extrabold">{fileName ?? "Drop an RFQ here"}</div>
          <div className="mt-1 text-xs text-[var(--muted)]">or click to choose a file</div>
        </label>
      </div>

      <div className="surface p-6">
        <div className="text-lg font-extrabold">2. Product catalogue</div>
        <p className="mt-1 text-sm leading-6 text-[var(--muted)]">Upload a simple catalogue export. This is the ERP-free onboarding path.</p>
        <label className="mt-5 block cursor-pointer rounded-xl border border-[var(--line)] p-4 hover:bg-[#fafbfa]">
          <input className="hidden" type="file" accept=".xlsx,.xls,.csv" onChange={(e) => setCatalogue(e.target.files?.[0]?.name ?? null)} />
          <div className="text-xs font-bold uppercase tracking-wider text-[var(--muted)]">Catalogue file</div>
          <div className="mt-2 text-sm font-bold">{catalogue ?? "Choose CSV / Excel"}</div>
        </label>
        <div className="mt-4 rounded-xl bg-[var(--green-soft)] p-4 text-xs leading-5 text-[var(--green-dark)]">
          Minimum recommended columns: SKU, manufacturer, product name, unit, price and stock.
        </div>
      </div>

      <div className="lg:col-span-2 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[var(--line)] bg-white p-4">
        <div className="text-sm text-[var(--muted)]">v0.1 uses the included demonstration RFQ after upload so the complete review workflow can be tested now.</div>
        <Link href={fileName ? "/app/rfq/rfq-1048" : "#"} aria-disabled={!fileName} className={`btn-primary ${!fileName ? "pointer-events-none opacity-40" : ""}`}>Process RFQ</Link>
      </div>
    </div>
  );
}
