"use client";

import { useRouter } from "next/navigation";
import type { Locale } from "@/lib/locale";

export function LocaleSwitcher({ locale, label }: { locale: Locale; label: string }) {
  const router = useRouter();

  function changeLocale(next: Locale) {
    document.cookie = `nodra_locale=${next}; Path=/; Max-Age=31536000; SameSite=Lax`;
    document.documentElement.lang = next;
    router.refresh();
  }

  return (
    <label className="app-locale-switcher">
      <span>{label}</span>
      <select value={locale} onChange={(event) => changeLocale(event.target.value as Locale)}>
        <option value="fi">Suomi</option>
        <option value="en">English</option>
      </select>
    </label>
  );
}
