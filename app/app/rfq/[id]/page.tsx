import Link from "next/link";
import { notFound } from "next/navigation";
import { requireWorkspace } from "@/lib/rivora/workspace";
import { confirmRfqMatch } from "./actions";

const money = new Intl.NumberFormat("en-FI", { style: "currency", currency: "EUR" });

export default async function RfqPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase } = await requireWorkspace();

  const { data: rfq } = await supabase
    .from("rfqs")
    .select("id, reference, source_type, status, overall_confidence, customers(name)")
    .eq("id", id)
    .maybeSingle();

  if (!rfq) notFound();

  const { data: lines } = await supabase
    .from("rfq_lines")
    .select("id, line_number, customer_sku, raw_description, quantity, unit, selected_product_id, match_confidence, match_method, review_status")
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

  const customer = Array.isArray((rfq as any).customers) ? (rfq as any).customers[0] : (rfq as any).customers;
  const unresolved = (lines ?? []).filter((line: any) => ["needs_review", "unmatched", "pending"].includes(line.review_status)).length;

  return (
    <div className="mx-auto max-w-6xl px-5 py-8 sm:px-8 lg:px-10 lg:py-10">
      <Link href="/app/inbox" className="text-sm font-bold text-[var(--green)]">← Back to inbox</Link>
      <div className="mt-5 mb-6 flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
        <div>
          <div className="kicker">Human review</div>
          <h1 className="mt-2 text-3xl font-extrabold tracking-[-.035em]">{rfq.reference || "RFQ review"}</h1>
          <p className="mt-2 text-sm text-[var(--muted)]">{customer?.name ?? "Unknown customer"} · {String(rfq.source_type).toUpperCase()} · {unresolved} lines need attention.</p>
        </div>
        <div className={`status ${rfq.status === "ready" ? "green" : "amber"}`}>{String(rfq.status).replaceAll("_", " ")}</div>
      </div>

      <div className="surface overflow-hidden">
        <div className="grid gap-3 border-b border-[var(--line)] px-5 py-4 sm:grid-cols-3">
          <div><div className="text-xs text-[var(--muted)]">Overall confidence</div><div className="mt-1 text-lg font-extrabold">{Math.round(Number(rfq.overall_confidence ?? 0))}%</div></div>
          <div><div className="text-xs text-[var(--muted)]">Matching policy</div><div className="mt-1 text-sm font-bold">Memory / exact auto · fuzzy review</div></div>
          <div><div className="text-xs text-[var(--muted)]">Lines</div><div className="mt-1 text-sm font-bold">{(lines ?? []).length}</div></div>
        </div>

        <div className="divide-y divide-[var(--line)]">
          {(lines ?? []).map((line: any) => {
            const lineCandidates = byLine.get(line.id) ?? [];
            const confidence = Number(line.match_confidence ?? 0);
            const tone = confidence >= 92 ? "green" : confidence >= 60 ? "amber" : "red";
            return (
              <div key={line.id} className="p-5">
                <div className="grid gap-5 lg:grid-cols-[1fr_1.4fr_.65fr]">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-bold text-[var(--muted)]">LINE {line.line_number}</span>
                      <span className={`status ${tone}`}>{confidence ? `${Math.round(confidence)}%` : "No match"}</span>
                    </div>
                    <div className="mt-3 text-sm font-extrabold">{line.customer_sku || "No customer SKU"}</div>
                    <div className="mt-1 text-sm text-[var(--muted)]">{line.raw_description || "No description"}</div>
                    <div className="mt-2 text-sm"><b>{Number(line.quantity)}</b> {line.unit || "pcs"}</div>
                    <div className="mt-2 text-xs text-[var(--muted)]">Method: {line.match_method || "none"}</div>
                  </div>

                  <form action={confirmRfqMatch}>
                    <input type="hidden" name="rfqId" value={id} />
                    <input type="hidden" name="lineId" value={line.id} />
                    <div className="text-xs font-bold uppercase tracking-wider text-[var(--muted)]">Candidate products</div>
                    {lineCandidates.length ? (
                      <>
                        <select name="productId" defaultValue={line.selected_product_id ?? lineCandidates[0]?.product_id} className="mt-2 w-full rounded-xl border border-[var(--line)] bg-white px-3 py-3 text-sm font-semibold outline-none focus:border-[var(--green)]">
                          {lineCandidates.map((candidate: any) => {
                            const product = Array.isArray(candidate.products) ? candidate.products[0] : candidate.products;
                            return <option key={candidate.product_id} value={candidate.product_id}>{product?.sku} — {product?.name} ({Math.round(Number(candidate.confidence))}%)</option>;
                          })}
                        </select>
                        <div className="mt-3 grid gap-2">
                          {lineCandidates.slice(0, 3).map((candidate: any) => {
                            const product = Array.isArray(candidate.products) ? candidate.products[0] : candidate.products;
                            return (
                              <div key={candidate.product_id} className="rounded-lg bg-[#fafbfa] px-3 py-2 text-xs text-[var(--muted)]">
                                <b className="text-[var(--ink)]">{product?.sku}</b> · {candidate.method} · {Math.round(Number(candidate.confidence))}% {product?.unit_price != null ? `· ${money.format(Number(product.unit_price))}` : ""}
                              </div>
                            );
                          })}
                        </div>
                        <label className="mt-3 flex items-center gap-2 text-xs text-[var(--muted)]">
                          <input name="remember" type="checkbox" defaultChecked />
                          Remember this alias for this customer
                        </label>
                        <button className="btn-primary mt-3">Confirm selected match</button>
                      </>
                    ) : (
                      <div className="mt-2 rounded-xl bg-[var(--red-soft)] p-4 text-sm text-[var(--red)]">
                        No candidate cleared the fuzzy threshold. Import a richer catalogue or add this product in the next manual-search iteration.
                      </div>
                    )}
                  </form>

                  <div className="flex items-start justify-start lg:justify-end">
                    <span className={`status ${line.review_status === "confirmed" || line.review_status === "matched" ? "green" : line.review_status === "needs_review" ? "amber" : "red"}`}>
                      {String(line.review_status).replaceAll("_", " ")}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {rfq.status === "ready" ? (
        <div className="mt-5 rounded-2xl bg-[#10251b] p-5 text-white">
          <div className="text-xs font-bold uppercase tracking-wider text-white/50">Engine result</div>
          <div className="mt-1 text-xl font-extrabold">All lines are resolved. This RFQ is ready for the quote-generation stage.</div>
        </div>
      ) : null}
    </div>
  );
}
