import { cookies, headers } from "next/headers";

export type Locale = "fi" | "en";

export async function getLocale(): Promise<Locale> {
  const cookieStore = await cookies();
  const saved = cookieStore.get("nodra_locale")?.value;
  if (saved === "fi" || saved === "en") return saved;

  const headerStore = await headers();
  const language = headerStore.get("accept-language")?.toLowerCase() ?? "";
  return language.split(",").some((part) => part.trim().startsWith("fi")) ? "fi" : "en";
}

export function formatLocale(locale: Locale) {
  return locale === "fi" ? "fi-FI" : "en-US";
}
