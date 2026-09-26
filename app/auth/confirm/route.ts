import type { EmailOtpType } from "@supabase/supabase-js";
import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getCanonicalAppUrl } from "@/lib/rivora/app-url";

function safeNext(value: string | null) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return "/onboarding";
  return value;
}

export async function GET(request: NextRequest) {
  const tokenHash = request.nextUrl.searchParams.get("token_hash");
  const type = request.nextUrl.searchParams.get("type") as EmailOtpType | null;
  const next = safeNext(request.nextUrl.searchParams.get("next"));
  const baseUrl = getCanonicalAppUrl();

  if (tokenHash && type) {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type,
    });

    if (!error) {
      return NextResponse.redirect(new URL(next, baseUrl));
    }
  }

  const errorUrl = new URL("/login", baseUrl);
  errorUrl.searchParams.set(
    "error",
    "The confirmation link is invalid or expired. Ask Nodra for a new pilot invitation.",
  );
  return NextResponse.redirect(errorUrl);
}
