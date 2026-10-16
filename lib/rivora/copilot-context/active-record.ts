// Phase 5.1A: active record hints are untrusted; server validates read access.
// This module exposes no business data and has no write operations.
import type { createClient } from "@/lib/supabase/server";
import { ContextReadError, type ActiveRecord } from "./types.ts";

type ScopedDb = Awaited<ReturnType<typeof createClient>>;
const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
const UUID_RE = new RegExp("^" + UUID + "$", "i");
const CASE_PATH = new RegExp("^/app/orders/case/(rfq|quote|po|sales)/(" + UUID + ")/?$", "i");
const DIRECT_PATH = new RegExp("^/app/(rfq|quotes|purchase-orders|sales-orders)/(" + UUID + ")/?$", "i");
const DIRECT_KINDS: Record<string, ActiveRecord["kind"]> = {
  rfq: "rfq", quotes: "quote", "purchase-orders": "po", "sales-orders": "sales",
};
const TABLE: Record<ActiveRecord["kind"], "rfqs" | "quotes" | "purchase_orders" | "sales_order_drafts"> = {
  rfq: "rfqs", quote: "quotes", po: "purchase_orders", sales: "sales_order_drafts",
};

export function isActiveRecordUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_RE.test(value);
}

/** UI hint only: pathname is never an access grant. */
export function parseActiveRecordPath(pathname: unknown): ActiveRecord | null {
  if (typeof pathname !== "string" || pathname.length > 160) return null;
  const caseMatch = CASE_PATH.exec(pathname);
  if (caseMatch) return { kind: caseMatch[1].toLowerCase() as ActiveRecord["kind"],
    id: caseMatch[2].toLowerCase() };
  const direct = DIRECT_PATH.exec(pathname);
  if (!direct) return null;
  return { kind: DIRECT_KINDS[direct[1].toLowerCase()], id: direct[2].toLowerCase() };
}

/** Disallow arbitrary fields, record kinds and non-UUID identifiers. */
export function normalizeActiveRecord(value: unknown): ActiveRecord | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const item = value as Record<string, unknown>;
  if (Object.keys(item).some(key => key !== "kind" && key !== "id")) return null;
  if (!["rfq", "quote", "po", "sales"].includes(String(item.kind)) ||
      !isActiveRecordUuid(item.id)) return null;
  return { kind: item.kind as ActiveRecord["kind"], id: item.id.toLowerCase() };
}

/** Uses the authenticated JWT/RLS client and exact organization equality. */
export async function verifyActiveRecordAccess(
  db: ScopedDb, organizationId: string, record: ActiveRecord, signal: AbortSignal,
): Promise<void> {
  const parsed = normalizeActiveRecord(record);
  if (!parsed || !isActiveRecordUuid(organizationId) || signal.aborted)
    throw new ContextReadError("CONTEXT_RECORD_UNAVAILABLE");
  const { data, error } = await db.from(TABLE[parsed.kind])
    .select("id")
    .eq("organization_id", organizationId)
    .eq("id", parsed.id)
    .abortSignal(signal)
    .maybeSingle();
  if (error || !data || signal.aborted)
    throw new ContextReadError("CONTEXT_RECORD_UNAVAILABLE");
}
