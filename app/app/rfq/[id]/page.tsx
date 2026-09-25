import Link from "next/link";
import { notFound } from "next/navigation";
import { requireWorkspace } from "@/lib/rivora/workspace";
import { confirmRfqMatch, retryRfqProcessing } from "./actions";
import { createQuoteFromRfq } from "@/app/app/quotes/actions";
import { formatLocale, getLocale } from "@/lib/locale";

function lineTone(confidence: number, reviewStatus: string) {
  if (reviewStatus === "confirmed") return "ready";
  if (reviewStatus === "matched") return "review";
  if (reviewStatus === "needs_review" || (confidence >= 60 && confidence < 92)) return "review";
  if (confidence >= 92) return "ready";
  return "blocked";
}

export default async function RfqPage({ params }: { params: Promise<{ id: string }> }) {
  const [{ id }, locale, context] = await Promise.all([params, getLocale(), requireWorkspace()]);
  const { supabase, workspace } = context;
  const fi = locale === "fi";
  const money = new Intl.NumberFormat(formatLocale(locale), { style: "currency", currency: "EUR" });
  const text = {
    inbox: fi ? "Tarjouspyynnöt" : "Inbox", review: fi ? "Tarjouspyynnön tarkistus" : "RFQ review", unknownCustomer: fi ? "Tuntematon asiakas" : "Unknown customer",
    needConfirm: (n: number) => fi ? `${n} riviä vaatii ihmisen vahvistuksen` : `${n} lines need human confirmation`, allConfirmed: fi ? "kaikki rivit ihmisen vahvistamia" : "all lines human-confirmed",
    resolved: fi ? "Ratkaistu" : "Resolved", ofLines: fi ? "rivistä" : "lines", needsReview: fi ? "Vaatii tarkistuksen" : "Needs review", humanDecisions: fi ? "ihmisen päätöstä" : "human decisions",
    matchConfidence: fi ? "Osumavarmuus" : "Match confidence", overall: fi ? "tarjouspyynnön kokonaisvarmuus" : "RFQ overall", policy: fi ? "Käytäntö" : "Policy", suggest: fi ? "Ehdota → ihminen vahvistaa" : "Suggest → human confirm",
    policyNote: fi ? "myös muisti- ja exact-osumat vaativat vahvistuksen" : "memory and exact matches still require confirmation", extraction: fi ? "Poiminta" : "Extraction", extractionConfidence: fi ? "Poiminnan varmuus" : "Extraction confidence", warnings: fi ? "Varoitukset" : "Warnings",
    failed: fi ? "Käsittely epäonnistui" : "Processing failed", failedBody: fi ? "Nodra ei pystynyt viimeistelemään tämän tarjouspyynnön käsittelyä." : "Nodra could not finish processing this RFQ.", retry: fi ? "Yritä tuoteosumia uudelleen" : "Retry product matching", extractionWarnings: fi ? "Poiminnan varoitukset" : "Extraction warnings",
    resolution: fi ? "Tuotteiden ratkaisu" : "Product resolution", reviewLine: fi ? "Tarkista rivi kerrallaan." : "Review line by line.", lines: fi ? "riviä" : "lines", line: fi ? "Rivi" : "Line", page: fi ? "PDF-sivu" : "PDF page",
    noSku: fi ? "Ei asiakkaan SKU:ta" : "No customer SKU", noDescription: fi ? "Ei kuvausta" : "No description", pcs: fi ? "kpl" : "pcs", method: fi ? "Osumamenetelmä" : "Match method", noMethod: fi ? "Ei menetelmää" : "No method",
    suggested: fi ? "Ehdotettu tuote" : "Suggested product", noCandidate: fi ? "Ei ehdokasta" : "No candidate", noCandidateBody: fi ? "Yksikään katalogituote ei ylittänyt nykyistä kynnystä." : "No catalogue product cleared the current threshold.", match: fi ? "Osuma" : "Match", productCandidate: fi ? "Tuote-ehdokas" : "Product candidate",
    remember: fi ? "Muista tämä vastine tälle asiakkaalle" : "Remember this mapping for this customer", confirm: fi ? "Vahvista osuma" : "Confirm match", manual: fi ? "Manuaalinen käsittely vaaditaan" : "Manual handling required", manualBody: fi ? "Yksikään katalogiehdokas ei ylittänyt fuzzy-kynnystä. Poimittu lähderivi säilytetään muuttumattomana." : "No catalogue candidate cleared the fuzzy threshold. The extracted source line remains preserved.",
    readyForQuote: fi ? "Valmis tarjoukseen" : "Ready for quote", readyTitle: fi ? "Jokainen tarjouspyynnön rivi on ihmisen erikseen vahvistama." : "Every RFQ line has been explicitly confirmed by a person.", readyBody: fi ? "Lukitse vahvistetut tuotteet tarjousluonnokseen ja muokkaa sitten hinnoittelua, alennuksia, ALV:tä ja hyväksyntää Quote Builderissa." : "Freeze the human-confirmed products into a commercial draft, then edit pricing, discounts, VAT and approval state in Quote Builder.",
    openQuote: fi ? "Avaa" : "Open", createQuote: fi ? "Luo tarjous" : "Create quote", permission: fi ? "Tarjouksen luominen vaatii owner- tai admin-oikeuden." : "Owner or admin access is required to create the commercial quote.", quoteExists: fi ? "Tarjous on jo olemassa" : "Quote exists", quoteExistsTitle: fi ? "Tällä tarjouspyynnöllä on jo kaupallinen tarjous." : "This RFQ already has a commercial quote.", quote: fi ? "tarjous" : "quote",
  };

  const { data: rfq } = await supabase
    .from("rfqs")
    .select("id, reference, source_type, status, overall_confidence, extraction_provider, extraction_model, extraction_confidence, extraction_warnings, processing_error, customers(name)")
    .eq("id", id)
    .maybeSingle();

  if (!rfq) notFound();

  const { data: existingQuote } = await supabase
    .from("quotes")
    .select("id, quote_number, status")
    .eq("rfq_id", id)
    .maybeSingle();

  const { data: lines } = await supabase
    .from("rfq_lines")
    .select("id, line_number, customer_sku, raw_description, quantity, unit, selected_product_id, match_confidence, match_method, review_status, extraction_confidence, source_page, extraction_notes")
    .eq("rfq_id", id)
    .order("line_number");

  const lineIds = (lines ?? []).map((line: any) => line.id);
  const { data: candidates } = lineIds.length
    ? await supabase
        .from("product_match_candidates")
        .select("rfq_line_id, product_id, confidence, method, rank, products(id,sku,name,manufacturer,unit,unit_price,stock_quantity)")
        .in("rfq_line_id", lineIds)
        .order("rank")
    : { data: [] as any[] };

  const byLine = new Map<string, any[]>();
  for (const candidate of candidates ?? []) {
    const list = byLine.get((candidate as any).rfq_line_id) ?? [];
    list.push(candidate);
    byLine.set((candidate as any).rfq_line_id, list);
  }

  const customer = Array.isArray((rfq as any).customers)
    ? (rfq as any).customers[0]
    : (rfq as any).customers;

  const unresolved = (lines ?? []).filter(
    (line: any) => line.review_status !== "confirmed"
  ).length;

  const resolved = (lines ?? []).length - unresolved;
  const warnings = Array.isArray((rfq as any).extraction_warnings)
    ? (rfq as any).extraction_warnings
    : [];

  return (
    <div className="app-page-v2 rfq-review-v2">
      <Link href="/app/inbox" className="rfq-review-v2-back">
        ← {text.inbox}
      </Link>

      <header className="rfq-review-v2-head">
        <div>
          <div className="app-kicker-v2">{text.review}</div>
          <h1>{rfq.reference || text.review}</h1>
          <p>
            {customer?.name ?? text.unknownCustomer} · {String(rfq.source_type).toUpperCase()} ·{" "}
            {unresolved ? text.needConfirm(unresolved) : text.allConfirmed}
          </p>
        </div>

        <div className={`rfq-review-v2-status ${rfq.status === "ready" ? "ready" : "review"}`}>
          {String(rfq.status).replaceAll("_", " ")}
        </div>
      </header>

      <section className="rfq-review-v2-summary">
        <div>
          <span>{text.resolved}</span>
          <strong>{resolved}</strong>
          <small>{(lines ?? []).length} {text.ofLines}</small>
        </div>
        <div className={unresolved ? "is-review" : ""}>
          <span>{text.needsReview}</span>
          <strong>{unresolved}</strong>
          <small>{text.humanDecisions}</small>
        </div>
        <div>
          <span>{text.matchConfidence}</span>
          <strong>{Math.round(Number(rfq.overall_confidence ?? 0))}%</strong>
          <small>{text.overall}</small>
        </div>
        <div>
          <span>{text.policy}</span>
          <strong className="is-text">{text.suggest}</strong>
          <small>{text.policyNote}</small>
        </div>
      </section>

      {rfq.extraction_provider ? (
        <section className="rfq-review-v2-extraction">
          <div>
            <span>{text.extraction}</span>
            <b>{String(rfq.extraction_provider).toUpperCase()} · {rfq.extraction_model}</b>
          </div>
          <div>
            <span>{text.extractionConfidence}</span>
            <b>{Math.round(Number(rfq.extraction_confidence ?? 0))}%</b>
          </div>
          <div>
            <span>{text.warnings}</span>
            <b>{warnings.length}</b>
          </div>
        </section>
      ) : null}

      {rfq.status === "failed" ? (
        <section className="rfq-review-v2-warning">
          <div className="upload-v2-section-label">{text.failed}</div>
          <p>{rfq.processing_error || text.failedBody}</p>
          {["owner", "admin", "member"].includes(workspace.role) ? (
            <form action={retryRfqProcessing} className="mt-4">
              <input type="hidden" name="rfqId" value={id} />
              <button className="btn-secondary">{text.retry}</button>
            </form>
          ) : null}
        </section>
      ) : null}

      {warnings.length ? (
        <section className="rfq-review-v2-warning">
          <div className="upload-v2-section-label">{text.extractionWarnings}</div>
          {warnings.map((warning: string, index: number) => (
            <p key={index}>{warning}</p>
          ))}
        </section>
      ) : null}

      <section className="rfq-review-v2-lines">
        <div className="rfq-review-v2-lines-head">
          <div>
            <div className="upload-v2-section-label">{text.resolution}</div>
            <h2>{text.reviewLine}</h2>
          </div>
          <span>{(lines ?? []).length} {text.lines}</span>
        </div>

        <div className="rfq-review-v2-line-list">
          {(lines ?? []).map((line: any) => {
            const lineCandidates = byLine.get(line.id) ?? [];
            const confidence = Number(line.match_confidence ?? 0);
            const extractionConfidence =
              line.extraction_confidence == null ? null : Number(line.extraction_confidence);
            const tone = lineTone(confidence, line.review_status);
            const primaryCandidate = lineCandidates[0];
            const primaryProduct = Array.isArray(primaryCandidate?.products)
              ? primaryCandidate?.products?.[0]
              : primaryCandidate?.products;

            return (
              <article key={line.id} className={`rfq-review-v2-line ${tone}`}>
                <div className="rfq-review-v2-source">
                  <div className="rfq-review-v2-line-meta">
                    <span>{text.line} {line.line_number}</span>
                    <span>{line.source_page ? `${text.page} ${line.source_page}` : String(rfq.source_type).toUpperCase()}</span>
                  </div>

                  <h3>{line.customer_sku || text.noSku}</h3>
                  <p>{line.raw_description || text.noDescription}</p>

                  <div className="rfq-review-v2-qty">
                    <strong>{Number(line.quantity)}</strong>
                    <span>{line.unit || text.pcs}</span>
                  </div>

                  <div className="rfq-review-v2-method">
                    <span>{text.method}</span>
                    <b>{line.match_method || text.noMethod}</b>
                  </div>

                  {line.extraction_notes ? (
                    <div className="rfq-review-v2-note">{line.extraction_notes}</div>
                  ) : null}
                </div>

                <div className="rfq-review-v2-decision">
                  <div className="rfq-review-v2-decision-top">
                    <div>
                      <span>{text.suggested}</span>
                      <h4>{primaryProduct?.sku || text.noCandidate}</h4>
                      <p>{primaryProduct?.name || text.noCandidateBody}</p>
                    </div>

                    <div className="rfq-review-v2-confidence-stack">
                      <div>
                        <span>{text.match}</span>
                        <strong>{confidence ? `${Math.round(confidence)}%` : "—"}</strong>
                      </div>
                      {extractionConfidence != null ? (
                        <div>
                          <span>{text.extraction}</span>
                          <strong>{Math.round(extractionConfidence)}%</strong>
                        </div>
                      ) : null}
                    </div>
                  </div>

                  {lineCandidates.length ? (
                    <form action={confirmRfqMatch} className="rfq-review-v2-form">
                      <input type="hidden" name="rfqId" value={id} />
                      <input type="hidden" name="lineId" value={line.id} />

                      <label>
                        <span>{text.productCandidate}</span>
                        <select
                          name="productId"
                          defaultValue={line.selected_product_id ?? lineCandidates[0]?.product_id}
                        >
                          {lineCandidates.map((candidate: any) => {
                            const product = Array.isArray(candidate.products)
                              ? candidate.products[0]
                              : candidate.products;

                            return (
                              <option key={candidate.product_id} value={candidate.product_id}>
                                {product?.sku} — {product?.name} ({Math.round(Number(candidate.confidence))}%)
                              </option>
                            );
                          })}
                        </select>
                      </label>

                      <div className="rfq-review-v2-candidates">
                        {lineCandidates.slice(0, 3).map((candidate: any) => {
                          const product = Array.isArray(candidate.products)
                            ? candidate.products[0]
                            : candidate.products;

                          return (
                            <div key={candidate.product_id}>
                              <div>
                                <b>{product?.sku}</b>
                                <span>{candidate.method}</span>
                              </div>
                              <div>
                                <strong>{Math.round(Number(candidate.confidence))}%</strong>
                                {product?.unit_price != null ? (
                                  <small>{money.format(Number(product.unit_price))}</small>
                                ) : null}
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      <div className="rfq-review-v2-actions">
                        <label className="rfq-review-v2-remember">
                          <input name="remember" type="checkbox" defaultChecked />
                          <span>{text.remember}</span>
                        </label>

                        <button>
                          {text.confirm} <span aria-hidden="true">→</span>
                        </button>
                      </div>
                    </form>
                  ) : (
                    <div className="rfq-review-v2-no-candidate">
                      <div className="upload-v2-section-label">{text.manual}</div>
                      <p>
                        No catalogue candidate cleared the fuzzy threshold. The extracted source line remains preserved.
                      </p>
                    </div>
                  )}
                </div>

                <div className={`rfq-review-v2-state ${tone}`}>
                  {line.review_status === "confirmed" ? (fi ? "Vahvistettu" : "Confirmed") : line.review_status === "needs_review" ? text.needsReview : String(line.review_status).replaceAll("_", " ")}
                </div>
              </article>
            );
          })}
        </div>
      </section>

      {rfq.status === "ready" ? (
        <section className="rfq-review-v2-ready">
          <div className="upload-v2-section-label">{text.readyForQuote}</div>
          <h2>{text.readyTitle}</h2>
          <p>
            Freeze the human-confirmed products into a commercial draft, then edit pricing,
            discounts, VAT and approval state in Quote Builder.
          </p>

          {existingQuote ? (
            <Link href={`/app/quotes/${existingQuote.id}`} className="rfq-review-v2-quote-cta">
              {text.openQuote} {existingQuote.quote_number || text.quote} <span aria-hidden="true">→</span>
            </Link>
          ) : ["owner", "admin"].includes(workspace.role) ? (
            <form action={createQuoteFromRfq}>
              <input type="hidden" name="rfqId" value={id} />
              <button className="rfq-review-v2-quote-cta">
                {text.createQuote} <span aria-hidden="true">→</span>
              </button>
            </form>
          ) : (
            <div className="rfq-review-v2-quote-note">
              {text.permission}
            </div>
          )}
        </section>
      ) : existingQuote ? (
        <section className="rfq-review-v2-ready">
          <div className="upload-v2-section-label">{text.quoteExists}</div>
          <h2>{text.quoteExistsTitle}</h2>
          <Link href={`/app/quotes/${existingQuote.id}`} className="rfq-review-v2-quote-cta">
            {text.openQuote} {existingQuote.quote_number || text.quote} <span aria-hidden="true">→</span>
          </Link>
        </section>
      ) : null}
    </div>
  );
}
