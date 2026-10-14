import { createClient } from "@supabase/supabase-js";
import { getSupabaseConfig } from "@/lib/supabase/config";

/** Server-only capability check for optional read-only UI status panels.
 * Never use this to bypass a privileged write or to grant browser access.
 */
export function hasSupabaseAdminKey(): boolean {
  return Boolean(
    process.env.SUPABASE_SECRET_KEY?.trim() ||
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim(),
  );
}

export function createAdminClient(options?: { fetch?: typeof fetch }) {
  const secret =
    process.env.SUPABASE_SECRET_KEY?.trim() ||
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

  if (!secret) {
    throw new Error("Supabase admin key is not configured.");
  }

  const { url } = getSupabaseConfig();
  return createClient(url, secret, {
    ...(options?.fetch ? { global: { fetch: options.fetch } } : {}),
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  });
}
