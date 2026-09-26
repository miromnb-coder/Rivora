"use server";

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
