import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { supportRecordTarget, readSupportEvidence, supportEvidenceExcerpt } from "../lib/rivora/support-record.ts";

const src = readFileSync(join(process.cwd(), "app/api/support/ask/route.ts"), "utf8");
const ui = readFileSync(join(process.cwd(), "components/support/SupportCenter.tsx"), "utf8");
const ORG = "11111111-1111-4111-8111-111111111111";
const ID = "22222222-2222-4222-8222-222222222222";

type Row = Record<string, unknown>;
function fakeDb(tables: Record<string, Row[]>) {
  const calls: Array<{ table: string; filters: Array<[string, unknown]> }> = [];
  const db = {
    from(table: string) {
      const filters: Array<[string, unknown]> = [];
      calls.push({ table, filters });
      let headCount = false;
      let maximum = 100000;
      let orderColumn = "";
      let descending = false;
      const records = () => {
        let rows = (tables[table] || []).filter(row => filters.every(([key, value]) => row[key] === value));
        if (orderColumn) rows = [...rows].sort((a,b) => Number(a[orderColumn] || 0) - Number(b[orderColumn] || 0) * (descending ? -1 : 1));
        return rows;
      };
      const response = () => ({ data: headCount ? null : records().slice(0, maximum), count: records().length, error: null });
      const query = {
        select(_columns: string, options?: {count?: string; head?: boolean}) { headCount = options?.head === true; return query; },
        eq(key: string, value: unknown) { filters.push([key, value]); return query; },
        order(key: string, options?: {ascending?: boolean}) { orderColumn = key; descending = options?.ascending === false; return query; },
        limit(value: number) { maximum = value; return Promise.resolve(response()); },
        maybeSingle() { return Promise.resolve({ data: records()[0] || null, error: null }); },
        then(resolve: (value: ReturnType<typeof response>) => void) { resolve(response()); },
      };
      return query;
    },
  };
  return { db, calls };
}

test("S7 accepts only exact allowlisted UUID record paths and known settings", () => {
  assert.deepEqual(supportRecordTarget("/app/rfq/" + ID), {kind:"rfq",id:ID});
  assert.deepEqual(supportRecordTarget("/app/quotes/" + ID + "?tab=1"), {kind:"quote",id:ID});
  assert.deepEqual(supportRecordTarget("/app/orders/case/po/" + ID), {kind:"purchase_order",id:ID});
  assert.deepEqual(supportRecordTarget("/app/orders/case/sales/" + ID), {kind:"sales_order",id:ID});
  assert.equal(supportRecordTarget("/app/rfq/../../settings"), null);
  assert.equal(supportRecordTarget("/app/quotes/not-an-id"), null);
  assert.equal(supportRecordTarget("/app/support/operator/tickets"), null);
  assert.deepEqual(supportRecordTarget("/app/settings/business-central"), {kind:"business_central"});
});

test("S7 verifies tenant-scoped parent before fetching record lines", async () => {
  const x = fakeDb({
    rfqs: [{id:ID,organization_id:ORG,status:"needs_review"}],
    rfq_lines: [{rfq_id:ID,review_status:"needs_review",selected_product_id:null}],
  });
  const yes = await readSupportEvidence(x.db as never, ORG, "member", "/app/rfq/" + ID);
  assert.equal(yes?.facts.awaitingConfirmation, 1);
  assert.equal(yes?.facts.unmatchedLines, 1);
  assert.equal(supportEvidenceExcerpt(yes).includes("needs_review"), true);
  assert.equal(x.calls[0].filters.some(([key,value]) => key === "organization_id" && value === ORG), true);
  const denied = fakeDb({rfqs: [{id:ID,organization_id:"another-organization",status:"ready"}]});
  const no = await readSupportEvidence(denied.db as never, ORG, "member", "/app/rfq/" + ID);
  assert.equal(no, null);
  assert.deepEqual(denied.calls.map(x => x.table), ["rfqs"]);
});

test("S7 hides mapping counts from non-admin users", async () => {
  const denied = fakeDb({});
  assert.equal(await readSupportEvidence(denied.db as never, ORG, "member", "/app/settings/business-central"), null);
  assert.deepEqual(denied.calls, []);
  const owner = fakeDb({erp_entity_mappings:[
    {organization_id:ORG,provider:"business_central"},
    {organization_id:ORG,provider:"business_central"},
    {organization_id:"another-organization",provider:"business_central"},
  ]});
  const evidence = await readSupportEvidence(owner.db as never, ORG, "owner", "/app/settings/business-central");
  assert.deepEqual(evidence?.facts, {mappingCount:2});
});

test("S7 only reads aggregate facts and requires explicit client opt-in", () => {
  assert.match(src, /const useCurrentRecord = body\.useCurrentRecord === true/);
  assert.match(src, /readSupportEvidence\(context\.supabase, context\.workspace\.id, context\.workspace\.role, contextPath\)/);
  assert.match(src, /supportEvidenceExcerpt\(recordEvidence\)/);
  assert.match(ui, /checked=\{useCurrentRecord\}/);
  assert.match(ui, /setUseCurrentRecord\(false\)/);
  assert.match(src, /Set supported=true only when the answer is directly supported/);
});

test("S7 only reports persisted PO exception counts, not raw exception text", async () => {
  const x = fakeDb({
    purchase_orders: [{id:ID,organization_id:ORG,status:"needs_review",raw_description:"private"}],
    purchase_order_reconciliations: [{id:"a",purchase_order_id:ID,organization_id:ORG,status:"needs_review",header_review_status:"open"}],
    purchase_order_reconciliation_lines: [
      {reconciliation_id:"a",organization_id:ORG,review_status:"open",exception_codes:["qty_change"],po_snapshot:"sensitive"},
      {reconciliation_id:"a",organization_id:ORG,review_status:"accepted",exception_codes:["price_change"],po_snapshot:"sensitive"},
    ],
  });
  const evidence = await readSupportEvidence(x.db as never, ORG, "member", "/app/orders/case/po/" + ID);
  assert.deepEqual(evidence?.facts, {
    hasReconciliation: true, reconciliationStatus:"needs_review", headerReviewStatus:"open",
    linesInspected:2, completeLineCount:true, linesWithExceptions:2, unreviewedLines:1,
  });
  assert.doesNotMatch(supportEvidenceExcerpt(evidence), /sensitive|price_change|qty_change/);
});

test("S7 returns only safe quote and ERP attempt statuses", async () => {
  const quote = fakeDb({
    quotes: [{id:ID,organization_id:ORG,status:"approved",delivery_status:"delivered",recipient_email:"secret@example.test"}],
    quote_lines: [{quote_id:ID,pricing_required:false,unit_price:99999}],
  });
  const qe = await readSupportEvidence(quote.db as never, ORG, "member", "/app/orders/case/quote/" + ID);
  assert.equal(qe?.status, "approved");
  assert.equal(qe?.facts.pricingRequired, 0);
  assert.doesNotMatch(supportEvidenceExcerpt(qe), /99999|secret@example/);

  const erp = fakeDb({
    sales_order_drafts: [{id:ID,organization_id:ORG,status:"erp_failed",erp_error:"private error detail"}],
    erp_delivery_attempts: [{sales_order_draft_id:ID,organization_id:ORG,status:"failed"}],
  });
  const se = await readSupportEvidence(erp.db as never, ORG, "owner", "/app/sales-orders/" + ID);
  assert.equal(se?.facts.latestAttemptStatus, "failed");
  assert.doesNotMatch(supportEvidenceExcerpt(se), /private error/);
});
