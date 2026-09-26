import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseConfig } from "@/lib/supabase/config";

export async function updateSession(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  const isPublic =
    pathname === "/" ||
    pathname.startsWith("/login") ||
    pathname.startsWith("/auth") ||
    pathname === "/api/leads" ||
    pathname === "/api/webhooks/resend";

  // Public marketing/auth routes do not need an authenticated Supabase roundtrip.
  if (isPublic) {
    return NextResponse.next({ request });
  }

  let response = NextResponse.next({ request });
  const { url, key } = getSupabaseConfig();

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value)
        );
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options)
        );
        Object.entries(headers).forEach(([header, value]) =>
          response.headers.set(header, value)
        );
      },
    },
  });

  const { data } = await supabase.auth.getClaims();

  if (!data?.claims) {
    const target = request.nextUrl.clone();
    target.pathname = "/login";
    target.search = "";
    return NextResponse.redirect(target);
  }

  return response;
}
