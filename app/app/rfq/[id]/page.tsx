import Link from "next/link";
import { notFound } from "next/navigation";
import { requireWorkspace } from "@/lib/rivora/workspace";
import { confirmRfqMatch } from "./actions";
import { createQuoteFromRfq } from "@/app/app/quotes/actions";

const money = new Intl.NumberFormat("en-FI", { style: "currency", currency: "EUR" });

function lineTone(confidence: number, reviewStatus: string) {
  if (reviewStatus === "confirmed" || reviewStatus === "matched") return "ready";
  if (reviewStatus === "needs_review" || (confidence >= 60 && confidence < 92)) return "review";
  if (confidence >= 92) return "ready";
  return "blocked";
}

export default async function RfqPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, workspace } = await requireWorkspace();

  const { data: rfq } = await supabase
    .from("rfqs")
    .select("id, reference, source_type, status, overall_confidence, extraction_provider, extraction_model, extraction_confidence, extraction_warnings, customers(name)")
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

  const unresolved = (lines ?? []).filter((line: any) =>
    ["needs_review", "unmatched", "pending"].includes(line.review_status)
  ).length;

  const resolved = (lines ?? []).length - unresolved;
  const warnings = Array.isArray((rfq as any).extraction_warnings)
    ? (rfq as any).extraction_warnings
    : [];

  return (
    <div className="app-page-v2 rfq-review-v2">
      <Link href="/app/inbox" className="rfq-review-v2-back">
        ← Inbox
      </Link>

      <header className="rfq-review-v2-head">
        <div>
          <div className="app-kicker-v2">RFQ review</div>
          <h1>{rfq.reference || "RFQ review"}</h1>
          <p>
            {customer?.name ?? "Unknown customer"} · {String(rfq.source_type).toUpperCase()} ·{" "}
            {unresolved ? `${unresolved} lines need attention` : "all lines resolved"}
          </p>
        </div>

        <div className={`rfq-review-v2-status ${rfq.status === "ready" ? "ready" : "review"}`}>
          {String(rfq.status).replaceAll("_", " ")}
        </div>
      </header>

      <section className="rfq-review-v2-summary">
        <div>
          <span>Resolved</span>
          <strong>{resolved}</strong>
          <small>of {(lines ?? []).length} lines</small>
        </div>
        <div className={unresolved ? "is-review" : ""}>
          <span>Needs review</span>
          <strong>{unresolved}</strong>
          <small>human decisions</small>
        </div>
        <div>
          <span>Match confidence</span>
          <strong>{Math.round(Number(rfq.overall_confidence ?? 0))}%</strong>
          <small>RFQ overall</small>
        </div>
        <div>
          <span>Policy</span>
          <strong className="is-text">Memory → SKU → MPN → fuzzy</strong>
          <small>fuzzy stays reviewable</small>
        </div>
      </section>

      {rfq.extraction_provider ? (
        <section className="rfq-review-v2-extraction">
          <div>
            <span>Extraction</span>
            <b>{String(rfq.extraction_provider).toUpperCase()} · {rfq.extraction_model}</b>
          </div>
          <div>
            <span>Extraction confidence</span>
            <b>{Math.round(Number(rfq.extraction_confidence ?? 0))}%</b>
          </div>
          <div>
            <span>Warnings</span>
            <b>{warnings.length}</b>
          </div>
        </section>
      ) : null}

      {warnings.length ? (
        <section className="rfq-review-v2-warning">
          <div className="upload-v2-section-label">Extraction warnings</div>
          {warnings.map((warning: string, index: number) => (
            <p key={index}>{warning}</p>
          ))}
        </section>
      ) : null}

      <section className="rfq-review-v2-lines">
        <div className="rfq-review-v2-lines-head">
          <div>
            <div className="upload-v2-section-label">Product resolution</div>
            <h2>Review line by line.</h2>
          </div>
          <span>{(lines ?? []).length} lines</span>
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
                    <span>Line {line.line_number}</span>
                    <span>{line.source_page ? `PDF page ${line.source_page}` : String(rfq.source_type).toUpperCase()}</span>
                  </div>

                  <h3>{line.customer_sku || "No customer SKU"}</h3>
                  <p>{line.raw_description || "No description"}</p>

                  <div className="rfq-review-v2-qty">
                    <strong>{Number(line.quantity)}</strong>
                    <span>{line.unit || "pcs"}</span>
                  </div>

                  <div className="rfq-review-v2-method">
                    <span>Match method</span>
                    <b>{line.match_method || "No method"}</b>
                  </div>

                  {line.extraction_notes ? (
                    <div className="rfq-review-v2-note">{line.extraction_notes}</div>
                  ) : null}
                </div>

                <div className="rfq-review-v2-decision">
                  <div className="rfq-review-v2-decision-top">
                    <div>
                      <span>Suggested product</span>
                      <h4>{primaryProduct?.sku || "No candidate"}</h4>
                      <p>{primaryProduct?.name || "No catalogue product cleared the current threshold."}</p>
                    </div>

                    <div className="rfq-review-v2-confidence-stack">
                      <div>
                        <span>Match</span>
                        <strong>{confidence ? `${Math.round(confidence)}%` : "—"}</strong>
                      </div>
                      {extractionConfidence != null ? (
                        <div>
                          <span>Extraction</span>
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
                        <span>Product candidate</span>
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
                          <span>Remember this mapping for this customer</span>
                        </label>

                        <button>
                          Confirm match <span aria-hidden="true">→</span>
                        </button>
                      </div>
                    </form>
                  ) : (
                    <div className="rfq-review-v2-no-candidate">
                      <div className="upload-v2-section-label">Manual handling required</div>
                      <p>
                        No catalogue candidate cleared the fuzzy threshold. The extracted source line remains preserved.
                      </p>
                    </div>
                  )}
                </div>

                <div className={`rfq-review-v2-state ${tone}`}>
                  {String(line.review_status).replaceAll("_", " ")}
                </div>
              </article>
            );
          })}
        </div>
      </section>

      {rfq.status === "ready" ? (
        <section className="rfq-review-v2-ready">
          <div className="upload-v2-section-label">Ready for quote</div>
          <h2>Every RFQ line has a resolved product.</h2>
          <p>
            Freeze the selected products into a commercial draft, then edit pricing,
            discounts, VAT and approval state in Quote Builder.
          </p>

          {existingQuote ? (
            <Link href={`/app/quotes/${existingQuote.id}`} className="rfq-review-v2-quote-cta">
              Open {existingQuote.quote_number || "quote"} <span aria-hidden="true">→</span>
            </Link>
          ) : ["owner", "admin"].includes(workspace.role) ? (
            <form action={createQuoteFromRfq}>
              <input type="hidden" name="rfqId" value={id} />
              <button className="rfq-review-v2-quote-cta">
                Create quote <span aria-hidden="true">→</span>
              </button>
            </form>
          ) : (
            <div className="rfq-review-v2-quote-note">
              Owner or admin access is required to create the commercial quote.
            </div>
          )}
        </section>
      ) : existingQuote ? (
        <section className="rfq-review-v2-ready">
          <div className="upload-v2-section-label">Quote exists</div>
          <h2>This RFQ already has a commercial quote.</h2>
          <Link href={`/app/quotes/${existingQuote.id}`} className="rfq-review-v2-quote-cta">
            Open {existingQuote.quote_number || "quote"} <span aria-hidden="true">→</span>
          </Link>
        </section>
      ) : null}
    </div>
  );
}
