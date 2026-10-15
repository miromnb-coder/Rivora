// In-memory records only. Unknown tables, query methods and RPCs fail closed.
// This adapter never imports a Supabase client or reads runtime credentials.
const timestamp = "2026-10-15T08:00:00Z";
declare const __FIXTURE_PAGE__: string;
const identifier = "SYNTHETIC-" + "1234567890".repeat(8);
const product = { id: "synthetic-0", organization_id: "fixture-a", sku: identifier, name: "Synteettinen pitkä teollisuustuote", manufacturer: "Esimerkkivalmistaja", manufacturer_part_number: identifier, unit: "kpl", unit_price: 125.5, stock_quantity: 32, active: true, updated_at: timestamp };
const customer = { id: "synthetic-0", organization_id: "fixture-a", name: "Synteettinen Asiakas Oy", external_id: identifier, email_domain: "example.invalid", created_at: timestamp };
const quote = { id: "synthetic-0", organization_id: "fixture-a", customer_id: customer.id, rfq_id: "synthetic-0", quote_number: identifier, status: __FIXTURE_PAGE__ === "purchase-orders/[id]" ? "sent" : "draft", currency: "EUR", valid_until: "2026-10-30", tax_rate: 25.5, customers: customer, rfqs: { reference: identifier }, created_at: timestamp, updated_at: timestamp };
const rfq = { id: "synthetic-0", organization_id: "fixture-a", customer_id: customer.id, reference: identifier, status: "needs_review", source_type: "pdf", overall_confidence: 75, extraction_confidence: 0.55, extraction_warnings: ["Synteettinen tarkistettava varoitus"], customers: customer, received_at: timestamp };
const lines = Array.from({ length: 8 }, (_, index) => ({ id: `synthetic-line-${index}`, organization_id: "fixture-a", rfq_id: rfq.id, quote_id: quote.id, purchase_order_id: "synthetic-0", line_number: index + 1, customer_sku: identifier, raw_description: "Synteettinen pitkä asiakkaan tuotekuvaus " + "sanallinen sisältö ".repeat(8), sku_snapshot: product.sku, description_snapshot: product.name, quantity: index + 1, unit: "kpl", unit_price: 125.5, catalogue_unit_price: 125.5, line_total: (index + 1) * 125.5, discount_percent: 0, pricing_required: false, match_confidence: 85, match_method: "exact_sku", review_status: index === 0 ? "confirmed" : "needs_review", selected_product_id: index === 0 ? product.id : null, extraction_confidence: 0.55, source_page: 1, products: product }));
const purchaseOrder = { id: "synthetic-0", organization_id: "fixture-a", customer_id: customer.id, quote_id: quote.id, po_number: identifier, quote_reference: identifier, status: "needs_review", currency: "EUR", order_date: "2026-10-15", source_type: "pdf", extraction_confidence: 0.55, extraction_warnings: ["Synteettinen PO-varoitus"], customers: customer, quotes: quote, received_at: timestamp, created_at: timestamp, updated_at: timestamp };
const reconciliation = { id: "synthetic-reconciliation", organization_id: "fixture-a", purchase_order_id: purchaseOrder.id, quote_id: quote.id, run_number: 1, algorithm_version: "synthetic-v1", status: "needs_review", header_exceptions: ["quote_reference_mismatch"], header_review_status: "open", summary: { cleanMatches: 7, exceptionLines: 1 } };
const tables: Record<string, Record<string, any>[]> = {
  products: [product], customers: [customer], quotes: [quote], rfqs: [rfq],
  quote_lines: lines, rfq_lines: lines, purchase_order_lines: lines,
  purchase_orders: [purchaseOrder],
  customer_contacts: [{ id: "synthetic-contact", customer_id: customer.id, name: "Synteettinen Yhteyshenkilö", email: "fixture@example.invalid", phone: "+358000000000", title: "Ostaja", is_primary: true }],
  erp_entity_mappings: [{ organization_id: "fixture-a", provider: "business_central", entity_type: "product", local_entity_id: product.id, external_number: identifier, metadata: { businessCentralDisplayName: product.name }, updated_at: timestamp }],
  customer_product_mappings: [{ id: "synthetic-memory", customer_id: customer.id, customer_sku: identifier, customer_description: product.name, products: product, times_used: 3, updated_at: timestamp }],
  product_match_candidates: lines.slice(0, 4).map(line => ({ rfq_line_id: line.id, product_id: product.id, confidence: 85, method: "exact_sku", rank: 1, products: product })),
  quote_email_attempts: [], quote_email_events: [], purchase_order_files: [],
  purchase_order_reconciliations: [reconciliation], sales_order_drafts: [],
  purchase_order_reconciliation_lines: [{
    id: "synthetic-exception", organization_id: "fixture-a", reconciliation_id: reconciliation.id,
    exception_codes: ["unit_mismatch", "unit_price_mismatch"], review_status: "open",
    po_snapshot: { lineNumber: 1, customerSku: identifier, description: product.name, quantity: 1, unit: "pcs", unitPrice: 125.5, lineTotal: 125.5 },
    quote_snapshot: { lineNumber: 1, sku: identifier, description: product.name, quantity: 1, unit: "kpl", lineTotal: 120 },
  }],
};

export async function requireWorkspace() {
  return { workspace: { id: "fixture-a", role: "owner" }, claims: { sub: "synthetic-actor" }, supabase: {
    from(table: string) {
      if (!Object.hasOwn(tables, table)) throw new Error(`Unexpected fixture table: ${table}`);
      let rows = [...tables[table]];
      let single = false;
      const chain = {
        select() { return chain; },
        eq(column: string, value: unknown) { rows = rows.filter(row => row[column] === value); return chain; },
        in(column: string, values: unknown[]) { rows = rows.filter(row => values.includes(row[column])); return chain; },
        order() { return chain; },
        limit(count: number) { rows = rows.slice(0, count); return chain; },
        maybeSingle() { single = true; return chain; },
        then(resolve: (result: { data: any; error: null }) => unknown) { return Promise.resolve({ data: single ? rows[0] ?? null : rows, error: null }).then(resolve); },
      };
      return chain;
    },
  } };
}

export function createAdminClient() {
  return { async rpc(name: string, args: { target_rfq_id: string; target_actor_id: string }) {
    if (name !== "get_rfq_product_memory_explanations_server" || args.target_rfq_id !== rfq.id || args.target_actor_id !== "synthetic-actor") throw new Error("Unexpected synthetic RPC");
    return { data: [], error: null };
  } };
}
