// Temporary recovery diagnostic. It never returns a URL, credential or document.
export const P0_DIAGNOSTICS_EXPIRES_AT = Date.parse("2026-10-12T23:59:00Z");
export const P0_PRODUCTION_PROJECT_ID = "prj_69utcxbvaCPDSle5W3zptTa946rv";

export function supabaseProjectRef(value: string): string | null {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.username || url.password || url.port) return null;
    const match = /^([a-z0-9]{20})\.supabase\.co$/.exec(url.hostname);
    return match?.[1] ?? null;
  } catch { return null; }
}

export function p0DiagnosticOperatorAllowed(input: {
  deploymentEnvironment: string | undefined;
  deploymentProjectId: string | undefined;
  now: number;
  email: string | undefined;
  emailConfirmed: boolean;
  configuredEmails: string | undefined;
}): boolean {
  // Use the explicit existing support-admin allowlist only. No workspace role,
  // reply-to address, user_metadata or default address grants access.
  if (input.deploymentEnvironment !== "production"
      || input.deploymentProjectId !== P0_PRODUCTION_PROJECT_ID || !Number.isFinite(input.now)
      || input.now >= P0_DIAGNOSTICS_EXPIRES_AT || !input.emailConfirmed) return false;
  const email = input.email?.trim().toLowerCase();
  if (!email) return false;
  return (input.configuredEmails ?? "").split(/[;,]/)
    .map(value => value.trim().toLowerCase()).filter(Boolean).includes(email);
}

export function observeSupabaseFetch(delegate: typeof fetch): {
  fetch: typeof fetch;
  projectRef: () => string | null;
} {
  let contacted: string | null = null;
  const observedFetch: typeof fetch = async (input, init) => {
    const url = input instanceof Request ? input.url : String(input);
    const ref = supabaseProjectRef(url);
    const parsed = new URL(url);
    const method = init?.method ?? (input instanceof Request ? input.method : "GET");
    // Only the fixed, row-free health probe is permitted. Caller-controlled
    // URLs, paths, bodies and write methods can never become a network probe.
    if (!ref || method !== "HEAD" || parsed.pathname !== "/rest/v1/organizations"
        || parsed.hash || init?.body || parsed.searchParams.get("select") !== "id"
        || parsed.searchParams.get("limit") !== "0"
        || [...parsed.searchParams.keys()].some(key => key !== "select" && key !== "limit")
        || parsed.searchParams.getAll("select").length !== 1
        || parsed.searchParams.getAll("limit").length !== 1) {
      throw new Error("Unsupported diagnostic destination");
    }
    // Disable redirects so captured host is the actual destination.
    const response = await delegate(input, { ...init, redirect: "error" });
    if (response.ok) contacted = ref;
    return response;
  };
  return { fetch: observedFetch, projectRef: () => contacted };
}
