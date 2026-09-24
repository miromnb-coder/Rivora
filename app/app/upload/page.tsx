import { FilePicker } from "@/components/FilePicker";
import { importCatalogue, processPdfRfq, processRfq } from "./actions";

export default async function UploadPage({
  searchParams,
}: {
  searchParams: Promise<{
    catalogueImported?: string;
    catalogueError?: string;
    rfqError?: string;
    pdfError?: string;
  }>;
}) {
  const params = await searchParams;
  const openAiReady = Boolean(process.env.OPENAI_API_KEY?.trim());

  return (
    <div className="mx-auto max-w-5xl px-5 py-8 sm:px-8 lg:px-10 lg:py-10">
      <div className="kicker">Rivora Engine v0.3</div>
      <h1 className="mt-2 text-3xl font-extrabold tracking-[-.035em]">PDF → structured RFQ → matching engine.</h1>
      <p className="mt-2 mb-7 max-w-2xl text-sm leading-6 text-[var(--muted)]">
        Import your catalogue once, then process CSV/XLSX normally or let OpenAI extract a messy customer PDF into structured RFQ lines before Rivora matches products.
      </p>

      {params.catalogueImported ? (
        <div className="mb-5 rounded-xl bg-[var(--green-soft)] p-4 text-sm text-[var(--green-dark)]">
          Imported or updated {params.catalogueImported} products.
        </div>
      ) : null}

      {params.catalogueError || params.rfqError || params.pdfError ? (
        <div className="mb-5 rounded-xl bg-[var(--red-soft)] p-4 text-sm text-[var(--red)]">
          {params.catalogueError ?? params.rfqError ?? params.pdfError}
        </div>
      ) : null}

      <div className="grid gap-5 lg:grid-cols-2">
        <form action={importCatalogue} className="surface p-6">
          <div className="text-lg font-extrabold">1. Import product catalogue</div>
          <p className="mt-1 text-sm leading-6 text-[var(--muted)]">
            Required: SKU + product name. Optional: manufacturer, MPN, unit, price, stock.
          </p>
          <FilePicker
            name="catalogue"
            accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            title="Choose product catalogue"
            hint="CSV or XLSX · opens the phone Files picker"
            required
          />
          <button className="btn-primary mt-5 w-full">Import catalogue</button>
        </form>

        <form action={processPdfRfq} className="surface p-6">
          <div className="flex items-center justify-between gap-3">
            <div className="text-lg font-extrabold">2. PDF + OpenAI extraction</div>
            <span className={`status ${openAiReady ? "green" : "red"}`}>
              {openAiReady ? "OpenAI ready" : "API key missing"}
            </span>
          </div>
          <p className="mt-1 text-sm leading-6 text-[var(--muted)]">
            OpenAI reads the PDF and extracts customer, reference, quantities, SKUs and descriptions. It does not choose catalogue products.
          </p>
          <label className="mt-5 block">
            <span className="text-xs font-bold uppercase tracking-wider text-[var(--muted)]">Customer override · optional</span>
            <input name="pdfCustomerName" placeholder="Use only if the PDF is ambiguous" className="mt-2 w-full rounded-xl border border-[var(--line)] px-3 py-3 outline-none focus:border-[var(--green)]" />
          </label>
          <label className="mt-4 block">
            <span className="text-xs font-bold uppercase tracking-wider text-[var(--muted)]">RFQ reference override · optional</span>
            <input name="pdfReference" placeholder="RFQ-2026-1048" className="mt-2 w-full rounded-xl border border-[var(--line)] px-3 py-3 outline-none focus:border-[var(--green)]" />
          </label>
          <FilePicker
            name="pdfRfq"
            accept=".pdf,application/pdf"
            title="Choose RFQ PDF"
            hint="PDF · opens the phone Files picker"
            required
          />
          <button disabled={!openAiReady} className="btn-primary mt-5 w-full disabled:cursor-not-allowed disabled:opacity-45">
            Extract PDF and run matching
          </button>
          {!openAiReady ? (
            <p className="mt-3 text-xs leading-5 text-[var(--red)]">
              Add the server-only OPENAI_API_KEY environment variable in the Vercel project before using PDF extraction.
            </p>
          ) : null}
        </form>
      </div>

      <div className="surface mt-5 p-6">
        <div className="text-sm font-extrabold">CSV / XLSX fallback</div>
        <p className="mt-1 text-sm leading-6 text-[var(--muted)]">
          Keep the deterministic v0.2 import path for structured RFQs.
        </p>
        <form action={processRfq} className="mt-4 grid gap-3 sm:grid-cols-2">
          <input name="customerName" required placeholder="Customer name" className="rounded-xl border border-[var(--line)] px-3 py-3 outline-none focus:border-[var(--green)]" />
          <input name="reference" placeholder="RFQ reference" className="rounded-xl border border-[var(--line)] px-3 py-3 outline-none focus:border-[var(--green)]" />
          <div className="sm:col-span-2">
            <FilePicker
              name="rfq"
              accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              title="Choose RFQ file"
              hint="CSV or XLSX · opens the phone Files picker"
              required
            />
          </div>
          <button className="btn-secondary sm:col-span-2">Process CSV / XLSX RFQ</button>
        </form>
      </div>

      <div className="mt-5 rounded-2xl border border-[var(--line)] bg-white p-5 text-sm leading-6 text-[var(--muted)]">
        Safety gates: <b className="text-[var(--ink)]">PDF extraction confidence below 90% always requires review</b>. Product matching remains customer memory → exact SKU → exact MPN → fuzzy candidates. AI extraction and catalogue matching are deliberately separated.
      </div>
    </div>
  );
}
