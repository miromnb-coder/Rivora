"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

function messageUrl(kind: "error" | "message", message: string) {
  return `/login?${kind}=${encodeURIComponent(message)}`;
}

export async function login(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const supabase = await createClient();

  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) redirect(messageUrl("error", error.message));

  redirect("/app/inbox");
}

export async function signup(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const requestHeaders = await headers();
  const origin = requestHeaders.get("origin") ?? requestHeaders.get("host");
  const emailRedirectTo = origin
    ? `${origin.startsWith("http") ? origin : `https://${origin}`}/auth/confirm?next=/onboarding`
    : undefined;

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: emailRedirectTo ? { emailRedirectTo } : undefined,
  });

  if (error) redirect(messageUrl("error", error.message));
  if (data.session) redirect("/onboarding");

  redirect(messageUrl("message", "Check your email to confirm your account, then sign in."));
}
