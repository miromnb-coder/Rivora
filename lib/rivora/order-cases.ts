// Shared deterministic order-case projection used by both UI and AI context.
// Must remain read-only and cannot use an administrative database client.
import type { createClient } from "@/lib/supabase/server";

type ScopedDb = Awaited<ReturnType<typeof createClient>>;
function relationOne<T>(value: T | T[] | null | undefined): T | null {
  return Array.isArray(value) ? value[0] ?? null : value ?? null;
}

export type CaseRow = {
  key: string;
  customer: string;
  rfqReference: string | null;
  quoteNumber: string | null;
  poNumber: string | null;
  stage: "rfq" | "quote" | "po" | "erp" | "done";
  stageLabel: string;
  nextAction: string;
  attention: boolean;
  href: string;
  updatedAt: string;
};

function newest(left: string, right: string) {
  return new Date(left).getTime() >= new Date(right).getTime() ? left : right;
}

function normalizedKey(...parts: Array<string | null | undefined>) {
  return parts
    .map((part) => String(part || "").trim().toLowerCase())
    .filter(Boolean)
    .join("::");
}

function stageRank(stage: CaseRow["stage"]) {
  return { rfq: 1, quote: 2, po: 3, erp: 4, done: 5 }[stage];
}


export type OrderCaseInput = {
 rfqs: any[];
 quotes: any[];
 purchaseOrders: any[];
 salesOrders: any[];
};

export function combineOrderCases({ rfqs, quotes, purchaseOrders, salesOrders }: OrderCaseInput, fi: boolean): CaseRow[] {
  const rows = new Map<string, CaseRow>();
  const quoteToCase = new Map<string, string>();
  const poToCase = new Map<string, string>();
  const quotesWithPurchaseOrders = new Set<string>();

  for (const rfq of rfqs ?? []) {
    const customer = relationOne<any>((rfq as any).customers);
    const attention = rfq.status === "needs_review";
    const stageLabel =
      rfq.status === "needs_review"
        ? fi ? "Tarkista RFQ" : "Review RFQ"
        : rfq.status === "ready"
          ? fi ? "Valmis tarjoukseen" : "Ready to quote"
          : fi ? "Tarjouspyyntö" : "RFQ";
    const nextAction =
      rfq.status === "needs_review"
        ? fi ? "Tarkista tarjouspyyntö" : "Review RFQ"
        : rfq.status === "ready"
          ? fi ? "Luo tarjous" : "Create quote"
          : fi ? "Avaa tarjouspyyntö" : "Open RFQ";

    rows.set(`rfq:${rfq.id}`, {
      key: `rfq:${rfq.id}`,
      customer: customer?.name || (fi ? "Tuntematon asiakas" : "Unknown customer"),
      rfqReference: rfq.reference || null,
      quoteNumber: null,
      poNumber: null,
      stage: "rfq",
      stageLabel,
      nextAction,
      attention,
      href: `/app/orders/case/rfq/${rfq.id}`,
      updatedAt: rfq.received_at,
    });
  }

  for (const quote of quotes ?? []) {
    const rfq = relationOne<any>((quote as any).rfqs);
    const customer = relationOne<any>((quote as any).customers);
    const key = rfq?.id && rows.has(`rfq:${rfq.id}`) ? `rfq:${rfq.id}` : `quote:${quote.id}`;
    const existing = rows.get(key);
    const attention = ["draft", "ready", "approved"].includes(String(quote.status));
    const stageLabel =
      quote.status === "sent"
        ? fi ? "Odottaa PO:ta" : "Waiting for PO"
        : quote.status === "approved"
          ? fi ? "Valmis lähetettäväksi" : "Ready to send"
          : quote.status === "ready"
            ? fi ? "Hyväksy tarjous" : "Approve quote"
            : fi ? "Tarjous kesken" : "Quote in progress";
    const nextAction =
      quote.status === "sent"
        ? fi ? "Lisää ostotilaus" : "Add purchase order"
        : quote.status === "approved"
          ? fi ? "Lähetä tarjous" : "Send quote"
          : quote.status === "ready"
            ? fi ? "Hyväksy tarjous" : "Approve quote"
            : fi ? "Viimeistele tarjous" : "Finish quote";

    rows.set(key, {
      key,
      customer: customer?.name || existing?.customer || (fi ? "Tuntematon asiakas" : "Unknown customer"),
      rfqReference: existing?.rfqReference || rfq?.reference || null,
      quoteNumber: quote.quote_number || null,
      poNumber: existing?.poNumber || null,
      stage: "quote",
      stageLabel,
      nextAction,
      attention,
      href: `/app/orders/case/quote/${quote.id}`,
      updatedAt: existing ? newest(existing.updatedAt, quote.updated_at) : quote.updated_at,
    });
    quoteToCase.set(String(quote.id), key);
  }

  for (const po of purchaseOrders ?? []) {
    const quote = relationOne<any>((po as any).quotes);
    const customer = relationOne<any>((po as any).customers);
    const upstreamKey =
      quote?.id && quoteToCase.has(String(quote.id))
        ? quoteToCase.get(String(quote.id))!
        : null;
    const key = `po:${po.id}`;
    const existing = upstreamKey ? rows.get(upstreamKey) : undefined;
    if (quote?.id) quotesWithPurchaseOrders.add(String(quote.id));
    const attention = ["extracted", "needs_review", "matched"].includes(String(po.status));
    const stageLabel =
      po.status === "matched"
        ? fi ? "PO täsmää" : "PO matched"
        : po.status === "approved" || po.status === "ready_for_erp"
          ? fi ? "PO hyväksytty" : "PO approved"
          : po.status === "erp_created"
            ? fi ? "Valmis" : "Complete"
            : fi ? "PO tarkistettavana" : "PO review";
    const nextAction =
      po.status === "matched"
        ? fi ? "Hyväksy tilaus" : "Approve order"
        : po.status === "approved" || po.status === "ready_for_erp"
          ? fi ? "Luo myyntitilausluonnos" : "Create sales order draft"
          : po.status === "erp_created"
            ? fi ? "Avaa valmis tilaus" : "Open completed order"
            : fi ? "Tarkista tilaus" : "Review order";

    rows.set(key, {
      key,
      customer: customer?.name || existing?.customer || (fi ? "Tuntematon asiakas" : "Unknown customer"),
      rfqReference: existing?.rfqReference || null,
      quoteNumber: existing?.quoteNumber || quote?.quote_number || null,
      poNumber: po.po_number || null,
      stage: po.status === "erp_created" ? "done" : "po",
      stageLabel,
      nextAction,
      attention,
      href: `/app/orders/case/po/${po.id}`,
      updatedAt: existing ? newest(existing.updatedAt, po.updated_at) : po.updated_at,
    });
    poToCase.set(String(po.id), key);
  }

  for (const order of salesOrders ?? []) {
    const quote = relationOne<any>((order as any).quotes);
    const po = relationOne<any>((order as any).purchase_orders);
    const customer = relationOne<any>((order as any).customers);
    const key =
      po?.id && poToCase.has(String(po.id))
        ? poToCase.get(String(po.id))!
        : quote?.id && quoteToCase.has(String(quote.id))
          ? quoteToCase.get(String(quote.id))!
          : `sales:${order.id}`;
    const existing = rows.get(key);
    const done = order.status === "erp_created";
    const attention = ["draft", "erp_failed", "erp_partial"].includes(String(order.status));
    const stageLabel = done
      ? fi ? "Business Centralissa" : "In Business Central"
      : order.status === "erp_failed" || order.status === "erp_partial"
        ? fi ? "ERP vaatii huomiota" : "ERP needs attention"
        : fi ? "Valmis ERP:iin" : "Ready for ERP";
    const nextAction = done
      ? fi ? "Avaa myyntitilaus" : "Open sales order"
      : order.status === "erp_failed" || order.status === "erp_partial"
        ? fi ? "Tarkista ERP-vienti" : "Review ERP export"
        : fi ? "Luo Business Centraliin" : "Create in Business Central";

    rows.set(key, {
      key,
      customer: customer?.name || existing?.customer || (fi ? "Tuntematon asiakas" : "Unknown customer"),
      rfqReference: existing?.rfqReference || null,
      quoteNumber: existing?.quoteNumber || quote?.quote_number || null,
      poNumber: existing?.poNumber || po?.po_number || order.customer_po_number || null,
      stage: done ? "done" : "erp",
      stageLabel,
      nextAction,
      attention,
      href: `/app/orders/case/sales/${order.id}`,
      updatedAt: existing ? newest(existing.updatedAt, order.updated_at) : order.updated_at,
    });
  }

  for (const quoteId of quotesWithPurchaseOrders) {
    const upstreamKey = quoteToCase.get(quoteId);
    if (upstreamKey) {
      const upstream = rows.get(upstreamKey);
      if (upstream && (upstream.stage === "rfq" || upstream.stage === "quote")) {
        rows.delete(upstreamKey);
      }
    }
  }

  const displayCases = new Map<string, CaseRow>();
  for (const row of rows.values()) {
    const businessKey = row.poNumber
      ? normalizedKey(row.customer, row.quoteNumber, row.poNumber)
      : normalizedKey(
          row.customer,
          row.rfqReference || row.quoteNumber || row.key,
        );
    const existing = displayCases.get(businessKey);
    if (
      !existing ||
      stageRank(row.stage) > stageRank(existing.stage) ||
      (stageRank(row.stage) === stageRank(existing.stage) &&
        new Date(row.updatedAt).getTime() > new Date(existing.updatedAt).getTime())
    ) {
      displayCases.set(businessKey, row);
    }
  }

  const allCases = [...displayCases.values()].sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
  );

  return allCases;
}

/** Fetch at most 200 records per table, plus a sentinel for completeness.
 * The JWT-scoped client enforces RLS. Org equality is additional defense.
 * The display page retains its historical non-strict failure posture; AI
 * requests MUST use strict=true to avoid misrepresenting failed queries as empty.
 */
export async function loadOrderCases(
  supabase: ScopedDb, orgId: string, fi: boolean,
  options: { strict?: boolean; detectTruncation?: boolean; signal?: AbortSignal } = {},
) {
  const limit = options.detectTruncation ? 201 : 200;
  const [r, q, p, so] = await Promise.all([
    supabase.from("rfqs")
      .select("id,reference,status,received_at,customers(id,name)")
      .eq("organization_id", orgId)
      .order("received_at", { ascending: false }).limit(limit).abortSignal(options.signal ?? new AbortController().signal),
    supabase.from("quotes")
      .select("id,quote_number,status,updated_at,customers(id,name),rfqs(id,reference)")
      .eq("organization_id", orgId)
      .order("updated_at", { ascending: false }).limit(limit).abortSignal(options.signal ?? new AbortController().signal),
    supabase.from("purchase_orders")
      .select("id,po_number,status,updated_at,customers(id,name),quotes(id,quote_number)")
      .eq("organization_id", orgId)
      .order("updated_at", { ascending: false }).limit(limit).abortSignal(options.signal ?? new AbortController().signal),
    supabase.from("sales_order_drafts")
      .select("id,status,customer_po_number,updated_at,customers(id,name),quotes(id,quote_number),purchase_orders(id,po_number)")
      .eq("organization_id", orgId)
      .order("updated_at", { ascending: false }).limit(limit).abortSignal(options.signal ?? new AbortController().signal),
  ]);
  if (options.strict && [r,q,p,so].some(x=>Boolean(x.error))) {
    throw new Error("COPILOT_CONTEXT_READ_FAILED");
  }
  const raw = [r.data ?? [],q.data ?? [],p.data ?? [],so.data ?? []];
  const truncated = raw.some(x=>x.length>200);
  const [rfqs,quotes,purchaseOrders,salesOrders] = raw.map(x=>x.slice(0,200));
  return { cases: combineOrderCases({rfqs,quotes,purchaseOrders,salesOrders},fi), truncated };
}
