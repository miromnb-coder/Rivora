// Server-only authorization boundary for Phase 5.1B.1.
// Must be used by future Copilot resolver, never call loader with admin client.
import type { createClient } from "@/lib/supabase/server";
import { verifyContextMembership } from "./authorization";
import { verifyActiveRecordAccess } from "./active-record";
import { loadRfqSnapshot, type RfqDataSnapshot } from "./rfq";
import { ContextReadError } from "./types";

type ScopedDb = Awaited<ReturnType<typeof createClient>>;

/** Requires the authenticated user's RLS-scoped db, actor and verified workspace. */
export async function readAuthorizedRfqSnapshot(args: {
  db: ScopedDb;
  actorId: string;
  organizationId: string;
  rfqId: string;
  signal: AbortSignal;
}): Promise<RfqDataSnapshot> {
  if (args.signal.aborted) throw new ContextReadError("COPILOT_RFQ_ABORTED");
  await verifyContextMembership(args.db, args.actorId, args.organizationId, args.signal);
  await verifyActiveRecordAccess(args.db, args.organizationId, {
    kind: "rfq", id: args.rfqId,
  }, args.signal);
  return loadRfqSnapshot(args.db, args.organizationId, args.rfqId, args.signal);
}
