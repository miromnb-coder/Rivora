import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  observeSupabaseFetch,
  p0DiagnosticOperatorAllowed,
  P0_DIAGNOSTICS_EXPIRES_AT,
  P0_PRODUCTION_PROJECT_ID,
} from "@/lib/rivora/p0-diagnostics";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 10;

const headers = {
  "Cache-Control": "private, no-store, max-age=0",
  "Vary": "Cookie",
  "X-Content-Type-Options": "nosniff",
};

export async function GET() {
  try {
    // Deny before creating any client in Preview/development/expired builds.
    if (process.env.VERCEL_ENV !== "production"
        || process.env.VERCEL_PROJECT_ID !== P0_PRODUCTION_PROJECT_ID
        || Date.now() >= P0_DIAGNOSTICS_EXPIRES_AT
        || !process.env.AVEROMIRA_SUPPORT_ADMIN_EMAILS?.trim()) {
      return Response.json({ error: "Not available." }, { status: 404, headers });
    }
    // getUser validates the current session with Auth; no JWT is saved.
    const session = await createClient();
    const { data, error } = await session.auth.getUser();
    const user = data.user;
    if (error || !user || !p0DiagnosticOperatorAllowed({
      deploymentEnvironment: process.env.VERCEL_ENV,
      deploymentProjectId: process.env.VERCEL_PROJECT_ID,
      now: Date.now(),
      email: user.email,
      emailConfirmed: Boolean(user.email_confirmed_at),
      configuredEmails: process.env.AVEROMIRA_SUPPORT_ADMIN_EMAILS,
    })) return Response.json({ error: "Not available." }, { status: 404, headers });

    const observation = observeSupabaseFetch(fetch);
    const admin = createAdminClient({ fetch: observation.fetch });
    // HEAD fetches no customer rows. The same admin factory serves /api/health.
    const { error: probeError } = await admin.from("organizations")
      .select("id", { head: true }).limit(0)
      .abortSignal(AbortSignal.timeout(5_000));
    const projectRef = observation.projectRef();
    if (probeError || !projectRef) throw new Error("Diagnostic unavailable");
    const commit = process.env.VERCEL_GIT_COMMIT_SHA;
    return Response.json({
      projectRef,
      connection: "server-admin",
      deploymentCommit: commit && /^[a-f0-9]{40}$/.test(commit) ? commit : null,
      checkedAt: new Date().toISOString(),
    }, { headers });
  } catch {
    // No provider messages, headers, URLs or session details enter logs/output.
    return Response.json({ error: "Diagnostic unavailable." }, { status: 503, headers });
  }
}
