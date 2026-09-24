import { importCatalogue, processRfq } from "./actions";

export default async function UploadPage({
  searchParams,
}: {
  searchParams: Promise<{
    catalogueImported?: string;
    catalogueError?: string;
    rfqError?: string;
  }>;
}) {
  const params = await searchParams;

  return (
    <div className="mx-auto max-w-5xl px-5 py-8 sm:px-8 lg:px-10 lg:py-10">
      <div className="kicker">Rivora Engine v0.2</div>
      <h1 className="mt-2 text-3xl font-extrabold tracking-[-.035em]">Import real catalogue data and process an RFQ.</h1>
      <p className="mt-2 mb-7 max-w-2xl text-sm leading-6 text-[var(--muted)]">
        Start ERP-free: export your products to CSV/XLSX, then upload a customer RFQ. Rivora runs exact SKU, customer memory and fuzzy matching automatically.
      </p>

      {params.catalogueImported ? (
        <div className="mb-5 rounded-xl bg-[var(--green-soft)] p-4 text-sm text-[var(--green-dark)]">
          Imported or updated {params.catalogueImported} products.
        </div>
      ) : null}
      {params.catalogueError || params.rfqError ? (
        <div className="mb-5 rounded-xl bg-[var(--red-soft)] p-4 text-sm text-[var(--red)]">
          {params.catalogueError ?? params.rfqError}
        </div>
      ) : null}

      <div className="grid gap-5 lg:grid-cols-2">
        <form action={importCatalogue} className="surface p-6">
          <div className="text-lg font-extrabold">1. Import product catalogue</div>
          <p className="mt-1 text-sm leading-6 text-[var(--muted)]">
            Required: SKU + product name. Optional: manufacturer, MPN, unit, price, stock.
          </p>
          <input name="catalogue" type="file" accept=".csv,.xlsx" required className="mt-5 block w-full rounded-xl border border-[var(--line)] bg-white p-3 text-sm" />
          <button className="btn-primary mt-5 w-full">Import catalogue</button>
        </form>

        <form action={processRfq} className="surface p-6">
          <div className="text-lg font-extrabold">2. Process customer RFQ</div>
          <p className="mt-1 text-sm leading-6 text-[var(--muted)]">
            Required columns: quantity plus SKU and/or description.
          </p>

          <label className="mt-5 block">
            <span className="text-xs font-bold uppercase tracking-wider text-[var(--muted)]">Customer</span>
            <input name="customerName" required placeholder="Nordic Process Service Oy" className="mt-2 w-full rounded-xl border border-[var(--line)] px-3 py-3 outline-none focus:border-[var(--green)]" />
          </label>
          <label className="mt-4 block">
            <span className="text-xs font-bold uppercase tracking-wider text-[var(--muted)]">RFQ reference</span>
            <input name="reference" placeholder="RFQ-2026-1048" className="mt-2 w-full rounded-xl border border-[var(--line)] px-3 py-3 outline-none focus:border-[var(--green)]" />
          </label>
          <input name="rfq" type="file" accept=".csv,.xlsx" required className="mt-4 block w-full rounded-xl border border-[var(--line)] bg-white p-3 text-sm" />
          <button className="btn-primary mt-5 w-full">Run matching engine</button>
        </form>
      </div>

      <div className="mt-5 rounded-2xl border border-[var(--line)] bg-white p-5 text-sm leading-6 text-[var(--muted)]">
        Matching order: <b className="text-[var(--ink)]">customer memory → exact SKU → exact manufacturer part number → fuzzy catalogue candidates</b>. Fuzzy matches are capped below the auto-match threshold and always go to human review.
      </div>
    </div>
  );
}
