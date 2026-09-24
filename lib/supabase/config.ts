const FALLBACK_SUPABASE_URL = "https://utvxopmdxqnxqgaxugxm.supabase.co";
const FALLBACK_SUPABASE_PUBLISHABLE_KEY = "sb_publishable_SBBsbkvXo1JHzmiYdaucwA_nSZtfF-w";

export function getSupabaseConfig() {
  return {
    url: process.env.NEXT_PUBLIC_SUPABASE_URL || FALLBACK_SUPABASE_URL,
    key:
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
      FALLBACK_SUPABASE_PUBLISHABLE_KEY,
  };
}
