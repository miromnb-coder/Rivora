import { FilePicker } from "@/components/FilePicker";
import { requireWorkspace } from "@/lib/rivora/workspace";
import { formatLocale, getLocale } from "@/lib/locale";
import { getUploadCopy } from "@/lib/i18n/extra";
import { importCatalogue, processPdfRfq, processRfq } from "./actions";

export default async function UploadPage({
  searchParams,
}: {
  searchParams: Promise<{
    catalogueImported?: string;
    catalogueCreated?: string;
    catalogueUpdated?: string;
    catalogueMissingPrice?: string;
    catalogueError?: string;
    rfqError?: string;
    pdfError?: string;
  }>;
}) {
  const [params, locale, context] = await Promise.all([searchParams, getLocale(), requireWorkspace()]);
  const copy = getUploadCopy(locale);
  const { supabase, workspace } = context;
  const openAiReady = Boolean(process.env.OPENAI_API_KEY?.trim());

  const [{ count: productCount }, { count: rfqCount }] = await Promise.all([
    supabase.from("products").select("id", { count: "exact", head: true }).eq("organization_id", workspace.id).eq("active", true),
    supabase.from("rfqs").select("id", { count: "exact", head: true }).eq("organization_id", workspace.id),
  ]);

  const productsReady = (productCount ?? 0) > 0;
  const firstRfq = (rfqCount ?? 0) === 0;
  const numberLocale = formatLocale(locale);

  return (
    <div className="app-page-v2 upload-v2">
      <header className="upload-v2-hero">
        <div className="app-kicker-v2">{copy.kicker}</div>
        <h1>{copy.title}</h1>
        <p>{copy.description}</p>
      </header>

      {params.catalogueImported ? (
        <div className="upload-v2-alert success">
          {copy.imported}: {params.catalogueImported} {copy.validated} · {params.catalogueCreated ?? "0"} {copy.new} · {params.catalogueUpdated ?? "0"} {copy.updated}
          {Number(params.catalogueMissingPrice ?? 0) > 0 ? ` · ${params.catalogueMissingPrice} ${copy.withoutPrice}` : ""}.
        </div>
      ) : null}

      {params.catalogueError || params.rfqError || params.pdfError ? (
        <div className="upload-v2-alert error">{params.catalogueError ?? params.rfqError ?? params.pdfError}</div>
      ) : null}

      {firstRfq ? (
        <section className="surface mb-6 p-6" id="first-rfq">
          <div className="upload-v2-section-label">{copy.guided}</div>
          <h2 className="mt-2 text-2xl font-bold">{copy.guidedTitle}</h2>
          <div className="mt-5 grid gap-3 md:grid-cols-3">
            {[
              ["01", copy.step1, copy.step1Body],
              ["02", copy.step2, copy.step2Body],
              ["03", copy.step3, copy.step3Body],
            ].map(([number, title, body]) => (
              <div key={number} className="nodra-mini-step">
                <span>{number}</span><strong>{title}</strong><p>{body}</p>
              </div>
            ))}
          </div>
          <div className="mt-5 flex flex-wrap gap-3">
            <a href="/app/templates/catalogue" className="btn-secondary">{copy.blank}</a>
            <a href="/app/templates/sample-catalogue" className="btn-secondary">{copy.sample}</a>
            <a href="/app/setup" className="btn-secondary">{copy.back}</a>
          </div>
        </section>
      ) : null}

      <section className="upload-v2-setup">
        <div>
          <div className="upload-v2-section-label">{copy.catalogue}</div>
          <div className="upload-v2-setup-title">{productsReady ? copy.ready : copy.notReady}</div>
          <div className="upload-v2-setup-copy">
            {productsReady
              ? `${(productCount ?? 0).toLocaleString(numberLocale)} ${copy.activeProducts}`
              : copy.importBefore}
          </div>
          {!productsReady ? (
            <div className="mt-3 flex flex-wrap gap-3 text-sm">
              <a href="/app/templates/catalogue" className="font-semibold underline underline-offset-4">{copy.downloadBlank}</a>
              <a href="/app/templates/sample-catalogue" className="font-semibold underline underline-offset-4">{copy.downloadSample}</a>
            </div>
          ) : null}
        </div>

        <div className="upload-v2-setup-status">
          <span className={productsReady ? "is-ready" : "is-waiting"}>{productsReady ? copy.ready : copy.setupRequired}</span>
        </div>

        <form action={importCatalogue} className="upload-v2-catalogue-form">
          <FilePicker
            name="catalogue"
            accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            title={productsReady ? copy.replaceCatalogue : copy.chooseCatalogue}
            hint={copy.catalogueHint}
            required
            locale={locale}
          />
          <button className="upload-v2-secondary-btn">{productsReady ? copy.replace : copy.import}</button>
        </form>
      </section>

      <section className="upload-v2-primary">
        <div className="upload-v2-primary-head">
          <div>
            <div className="upload-v2-section-label">{copy.incoming}</div>
            <h2>{copy.pdfTitle}</h2>
            <p>{copy.pdfBody}</p>
          </div>
          <span className={`upload-v2-ai-status ${openAiReady ? "is-ready" : "is-error"}`}>
            {openAiReady ? copy.aiReady : copy.apiMissing}
          </span>
        </div>

        <form action={processPdfRfq} className="upload-v2-form">
          <div className="upload-v2-fields">
            <label>
              <span>{copy.customerOverride} <em>{copy.optional}</em></span>
              <input name="pdfCustomerName" placeholder={copy.ambiguous} />
            </label>
            <label>
              <span>{copy.rfqRef} <em>{copy.optional}</em></span>
              <input name="pdfReference" placeholder="RFQ-2026-1048" />
            </label>
          </div>

          <div className="upload-v2-picker">
            <FilePicker name="pdfRfq" accept="*/*" title={copy.choosePdf} hint={copy.pdfHint} required />
          </div>

          <div className="upload-v2-submit-row">
            <button disabled={!openAiReady || !productsReady} className="upload-v2-primary-btn disabled:cursor-not-allowed disabled:opacity-40">
              {copy.process} <span aria-hidden="true">→</span>
            </button>
            {!productsReady ? <p>{copy.importFirst}</p> : !openAiReady ? <p>{copy.addKey}</p> : <p>{copy.flow}</p>}
          </div>
        </form>
      </section>

      <section className="upload-v2-structured">
        <div className="upload-v2-structured-copy">
          <div className="upload-v2-section-label">{copy.structured}</div>
          <h3>{copy.structuredTitle}</h3>
          <p>{copy.structuredBody}</p>
        </div>

        <form action={processRfq} className="upload-v2-structured-form">
          <div className="upload-v2-fields">
            <label><span>{copy.customer}</span><input name="customerName" required placeholder={copy.customerName} /></label>
            <label><span>{copy.rfqRef} <em>{copy.optional}</em></span><input name="reference" placeholder={copy.rfqRef} /></label>
          </div>
          <FilePicker
            name="rfq"
            accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            title={copy.chooseFile}
            hint="CSV or XLSX"
            required
            locale={locale}
          />
          <button disabled={!productsReady} className="upload-v2-secondary-btn disabled:cursor-not-allowed disabled:opacity-40">{copy.processStructured}</button>
        </form>
      </section>

      <section className="upload-v2-trust">
        <div><span>{copy.threshold}</span><b>{copy.thresholdBody}</b></div>
        <div><span>{copy.order}</span><b>Memory → SKU → MPN → fuzzy</b></div>
        <div><span>{copy.boundary}</span><b>{copy.boundaryBody}</b></div>
      </section>
    </div>
  );
}
