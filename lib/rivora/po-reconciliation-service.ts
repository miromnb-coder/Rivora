import type { SupabaseClient } from "@supabase/supabase-js";
import {
  PO_RECONCILIATION_VERSION,
  reconcilePurchaseOrder,
  type PurchaseOrderLineInput,
  type QuoteLineInput,
} from "@/lib/rivora/po-reconciliation";

function relationOne<T>(value: T | T[] | null | undefined): T | null {
  return Array.isArray(value) ? value[0] ?? null : value ?? null;
}

function normalizedReference(value: string | null | undefined) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

export async function reconcilePurchaseOrderForWorkspace({
  supabase,
  organizationId,
  purchaseOrderId,
}: {
  supabase: SupabaseClient;
  organizationId: string;
  purchaseOrderId: string;
}) {
  const { data: purchaseOrder, error: poError } = await supabase
    .from("purchase_orders")
    .select("id,customer_id,quote_id,currency,quote_reference,status")
    .eq("id", purchaseOrderId)
    .eq("organization_id", organizationId)
    .maybeSingle();

  if (poError) throw poError;
  if (!purchaseOrder) throw new Error("Purchase order was not found in this workspace.");
  if (!purchaseOrder.quote_id) {
    throw new Error("Link the purchase order to an approved or sent quote before reconciliation.");
  }

  const { data: quote, error: quoteError } = await supabase
    .from("quotes")
    .select("id,customer_id,quote_number,currency,status")
    .eq("id", purchaseOrder.quote_id)
    .eq("organization_id", organizationId)
    .maybeSingle();

  if (quoteError) throw quoteError;
  if (!quote) throw new Error("Linked quote was not found.");
  if (!["approved", "sent"].includes(String(quote.status))) {
    throw new Error("Purchase order reconciliation requires an approved or sent quote.");
  }
  if (String(quote.customer_id) !== String(purchaseOrder.customer_id)) {
    throw new Error("Linked quote customer does not match the purchase order customer.");
  }

  const [{ data: poRows, error: poLinesError }, { data: quoteRows, error: quoteLinesError }] =
    await Promise.all([
      supabase
        .from("purchase_order_lines")
        .select(
          "id,line_number,customer_sku,manufacturer_part_number,raw_description,quantity,unit,unit_price,line_total"
        )
        .eq("purchase_order_id", purchaseOrderId)
        .eq("organization_id", organizationId)
        .order("line_number"),
      supabase
        .from("quote_lines")
        .select(
          "id,line_number,sku_snapshot,description_snapshot,quantity,unit,unit_price,discount_percent,line_total,products(sku,name,manufacturer_part_number),rfq_lines(customer_sku,raw_description)"
        )
        .eq("quote_id", quote.id)
        .eq("organization_id", organizationId)
        .order("line_number"),
    ]);

  if (poLinesError) throw poLinesError;
  if (quoteLinesError) throw quoteLinesError;
  if (!poRows?.length) throw new Error("Purchase order has no lines to reconcile.");
  if (!quoteRows?.length) throw new Error("Linked quote has no lines to reconcile.");

  const purchaseOrderLines: PurchaseOrderLineInput[] = poRows.map((line: any) => ({
    id: String(line.id),
    lineNumber: Number(line.line_number),
    customerSku: line.customer_sku ? String(line.customer_sku) : null,
    manufacturerPartNumber: line.manufacturer_part_number
      ? String(line.manufacturer_part_number)
      : null,
    description: String(line.raw_description ?? ""),
    quantity: Number(line.quantity),
    unit: line.unit ? String(line.unit) : null,
    unitPrice: line.unit_price == null ? null : Number(line.unit_price),
    lineTotal: line.line_total == null ? null : Number(line.line_total),
  }));

  const quoteLines: QuoteLineInput[] = quoteRows.map((line: any) => {
    const product = relationOne<any>(line.products);
    const sourceRfqLine = relationOne<any>(line.rfq_lines);

    return {
      id: String(line.id),
      lineNumber: Number(line.line_number),
      sku: line.sku_snapshot ? String(line.sku_snapshot) : null,
      productSku: product?.sku ? String(product.sku) : null,
      manufacturerPartNumber: product?.manufacturer_part_number
        ? String(product.manufacturer_part_number)
        : null,
      description: String(line.description_snapshot ?? product?.name ?? ""),
      sourceCustomerSku: sourceRfqLine?.customer_sku
        ? String(sourceRfqLine.customer_sku)
        : null,
      sourceDescription: sourceRfqLine?.raw_description
        ? String(sourceRfqLine.raw_description)
        : null,
      quantity: Number(line.quantity),
      unit: line.unit ? String(line.unit) : null,
      unitPrice: Number(line.unit_price),
      discountPercent: Number(line.discount_percent ?? 0),
      lineTotal: Number(line.line_total),
    };
  });

  const reconciliation = reconcilePurchaseOrder(purchaseOrderLines, quoteLines);
  const headerExceptions: string[] = [];

  if (
    String(purchaseOrder.currency ?? "").trim().toUpperCase() !==
    String(quote.currency ?? "").trim().toUpperCase()
  ) {
    headerExceptions.push("currency_mismatch");
  }

  const poQuoteReference = normalizedReference(purchaseOrder.quote_reference);
  const quoteNumber = normalizedReference(quote.quote_number);
  if (poQuoteReference && quoteNumber && poQuoteReference !== quoteNumber) {
    headerExceptions.push("quote_reference_mismatch");
  }

  const summary = {
    ...reconciliation.summary,
    headerExceptionCount: headerExceptions.length,
  };

  const payload = reconciliation.lines.map((line) => ({
    po_line_id: line.poLineId,
    quote_line_id: line.quoteLineId,
    line_kind: line.lineKind,
    match_method: line.matchMethod,
    match_score: line.matchScore,
    exception_codes: line.exceptionCodes,
    review_status: line.reviewStatus,
    po_snapshot: line.poSnapshot,
    quote_snapshot: line.quoteSnapshot,
  }));

  const { data: reconciliationId, error: commitError } = await supabase.rpc(
    "commit_purchase_order_reconciliation",
    {
      target_purchase_order_id: purchaseOrderId,
      target_quote_id: quote.id,
      target_algorithm_version: PO_RECONCILIATION_VERSION,
      target_header_exceptions: headerExceptions,
      target_summary: summary,
      target_lines: payload,
    }
  );

  if (commitError) throw commitError;

  return {
    reconciliationId: String(reconciliationId),
    quoteId: String(quote.id),
    status:
      headerExceptions.length || reconciliation.summary.exceptionLines
        ? ("needs_review" as const)
        : ("matched" as const),
    headerExceptions,
    summary,
  };
}
