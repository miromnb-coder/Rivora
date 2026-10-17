import { NextResponse } from "next/server";
import { getAuthContext } from "@/lib/rivora/workspace";
import {
  copilotActivationReadiness, copilotActorAuthorizedForEnvironment,
} from "@/lib/rivora/copilot-live";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Read-only status for the authenticated person. Never reveal tenant IDs,
 * credentials, activation-flag values or prices to other users. */
export async function GET() {
  const headers = { "Cache-Control": "private, no-store" };
  try {
    const context = await getAuthContext();
    if (!context.claims?.sub || !context.workspace)
      return NextResponse.json({ available: false, pilot: false, contextAvailable: false, activeRecordAvailable: false, rfqIntelligenceAvailable: false }, { status: 401, headers });
    const ready = copilotActivationReadiness();
    const authorized = copilotActorAuthorizedForEnvironment(
      context.claims.sub, context.workspace.id, context.workspace.role,
    );
    const available = ready.ready && authorized;
    const pilot = available && process.env.VERCEL_ENV === "production" &&
      process.env.AVEROMIRA_COPILOT_PILOT_ENABLED === "true";
    const contextAvailable = available && process.env.AVEROMIRA_COPILOT_CONTEXT_ENABLED === "true";
    const activeRecordAvailable = contextAvailable &&
      process.env.AVEROMIRA_COPILOT_ACTIVE_RECORD_ENABLED === "true";
    const rfqIntelligenceAvailable = activeRecordAvailable &&
      process.env.AVEROMIRA_COPILOT_RFQ_INTELLIGENCE_ENABLED === "true";
    return NextResponse.json({ available, pilot, contextAvailable, activeRecordAvailable, rfqIntelligenceAvailable }, { headers });
  } catch {
    return NextResponse.json({ available: false, pilot: false, contextAvailable: false, activeRecordAvailable: false, rfqIntelligenceAvailable: false }, { headers });
  }
}
