import { createClient } from "@supabase/supabase-js";
import { getSupabaseConfig } from "@/lib/supabase/config";

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
