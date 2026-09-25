import { FilePicker } from "@/components/FilePicker";
import { requireWorkspace } from "@/lib/rivora/workspace";
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
  const { supabase, workspace } = await requireWorkspace();

  const { count: productCount } = await supabase
    .from("products")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", workspace.id)
    .eq("active", true);

  const productsReady = (productCount ?? 0) > 0;

  return (
    <div className="app-page-v2 upload-v2">
      <header className="upload-v2-hero">
        <div className="app-kicker-v2">Process RFQ</div>
        <h1>Turn a customer request into resolved product lines.</h1>
        <p>
          Upload a PDF for AI-assisted extraction or use a structured CSV/XLSX.
          Nodra keeps extraction, matching and human review separate.
        </p>
      </header>

      {params.catalogueImported ? (
        <div className="upload-v2-alert success">
          Imported or updated {params.catalogueImported} products.
        </div>
      ) : null}

      {params.catalogueError || params.rfqError || params.pdfError ? (
        <div className="upload-v2-alert error">
          {params.catalogueError ?? params.rfqError ?? params.pdfError}
        </div>
      ) : null}

      <section className="upload-v2-setup">
        <div>
          <div className="upload-v2-section-label">Catalogue</div>
          <div className="upload-v2-setup-title">
            {productsReady ? "Catalogue ready" : "Catalogue not imported yet"}
          </div>
          <div className="upload-v2-setup-copy">
            {productsReady
              ? `${productCount?.toLocaleString("en-US")} active products available for matching.`
              : "Import a CSV or XLSX product catalogue before processing RFQs."}
          </div>
        </div>

        <div className="upload-v2-setup-status">
          <span className={productsReady ? "is-ready" : "is-waiting"}>
            {productsReady ? "Ready" : "Setup required"}
          </span>
        </div>

        <form action={importCatalogue} className="upload-v2-catalogue-form">
          <FilePicker
            name="catalogue"
            accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            title={productsReady ? "Replace product catalogue" : "Choose product catalogue"}
            hint="CSV or XLSX · SKU + product name required"
            required
          />
          <button className="upload-v2-secondary-btn">
            {productsReady ? "Replace catalogue" : "Import catalogue"}
          </button>
        </form>
      </section>

      <section className="upload-v2-primary">
        <div className="upload-v2-primary-head">
          <div>
            <div className="upload-v2-section-label">Incoming RFQ</div>
            <h2>Process a customer PDF.</h2>
            <p>
              Nodra extracts customer, reference, quantities, SKUs and descriptions,
              then runs catalogue matching and sends uncertainty to review.
            </p>
          </div>

          <span className={`upload-v2-ai-status ${openAiReady ? "is-ready" : "is-error"}`}>
            {openAiReady ? "OpenAI ready" : "API key missing"}
          </span>
        </div>

        <form action={processPdfRfq} className="upload-v2-form">
          <div className="upload-v2-fields">
            <label>
              <span>Customer override <em>optional</em></span>
              <input
                name="pdfCustomerName"
                placeholder="Use only if the PDF is ambiguous"
              />
            </label>

            <label>
              <span>RFQ reference <em>optional</em></span>
              <input name="pdfReference" placeholder="RFQ-2026-1048" />
            </label>
          </div>

          <div className="upload-v2-picker">
            <FilePicker
              name="pdfRfq"
              accept="*/*"
              title="Choose RFQ PDF"
              hint="Choose the PDF from Files · Nodra verifies the file contents"
              required
            />
          </div>

          <div className="upload-v2-submit-row">
            <button
              disabled={!openAiReady || !productsReady}
              className="upload-v2-primary-btn disabled:cursor-not-allowed disabled:opacity-40"
            >
              Process RFQ <span aria-hidden="true">→</span>
            </button>

            {!productsReady ? (
              <p>Import your product catalogue first.</p>
            ) : !openAiReady ? (
              <p>Add the server-only OPENAI_API_KEY in Vercel before PDF extraction.</p>
            ) : (
              <p>Extraction → matching → review</p>
            )}
          </div>
        </form>
      </section>

      <section className="upload-v2-structured">
        <div className="upload-v2-structured-copy">
          <div className="upload-v2-section-label">Structured RFQ</div>
          <h3>Already have CSV or XLSX?</h3>
          <p>
            Skip AI extraction and send structured lines directly into Nodra’s deterministic matching engine.
          </p>
        </div>

        <form action={processRfq} className="upload-v2-structured-form">
          <div className="upload-v2-fields">
            <label>
              <span>Customer</span>
              <input name="customerName" required placeholder="Customer name" />
            </label>
            <label>
              <span>RFQ reference <em>optional</em></span>
              <input name="reference" placeholder="RFQ reference" />
            </label>
          </div>

          <FilePicker
            name="rfq"
            accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            title="Choose RFQ file"
            hint="CSV or XLSX"
            required
          />

          <button
            disabled={!productsReady}
            className="upload-v2-secondary-btn disabled:cursor-not-allowed disabled:opacity-40"
          >
            Process CSV / XLSX
          </button>
        </form>
      </section>

      <section className="upload-v2-trust">
        <div>
          <span>Review threshold</span>
          <b>Below 90% → human review</b>
        </div>
        <div>
          <span>Match order</span>
          <b>Memory → SKU → MPN → fuzzy</b>
        </div>
        <div>
          <span>AI boundary</span>
          <b>Extraction does not choose products</b>
        </div>
      </section>
    </div>
  );
}
