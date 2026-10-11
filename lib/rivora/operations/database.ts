import postgres from "postgres";
import { OperationError } from "./policy";
let pool: ReturnType<typeof postgres> | undefined;
export function workerDatabase() {
  const value = process.env.AVEROMIRA_WORKER_DATABASE_URL?.trim();
  if (!value) throw new OperationError("config");
  const url = new URL(value);
  // The limited login is provisioned separately. Never fall back to postgres/service role.
  if (!/^averomira_worker(?:\.[a-z0-9]{20})?$/.test(decodeURIComponent(url.username))) throw new OperationError("config");
  pool ??= postgres(value, { max: 1, ssl: "verify-full", prepare: false, connect_timeout: 5, idle_timeout: 20, max_lifetime: 60, onnotice: () => {} });
  return pool;
}
// Only known, statically selected operations can be invoked. No SQL from HTTP/input.
export async function workerCall<T = unknown>(name: string, parameters: unknown[] = []): Promise<T> {
  const functions = new Set(["operation_claim","operation_heartbeat","operation_checkpoint","operation_finish","operation_reserve_ai","operation_settle_ai","operation_publish_document","operation_complete_document","operation_po_context","operation_commit_po_reconciliation","operation_monitor","operation_worker_status","operation_worker_finish","operation_notification_payload","operation_notification_started","operation_notification_accepted","operation_email_reconcile","operation_cleanup_candidates"]);
  if (!functions.has(name)) throw new OperationError("permission");
  const sql = workerDatabase();
  const values = parameters.map((x) => x && typeof x === "object" ? JSON.stringify(x) : x);
  const rows = await sql.unsafe(`select private.${name}(${values.map((_,i)=>`$${i+1}`).join(",")}) as result`, values as postgres.ParameterOrJSON<never>[]);
  return rows[0]?.result as T;
}
