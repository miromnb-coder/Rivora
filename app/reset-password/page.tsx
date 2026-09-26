import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getLocale } from "@/lib/locale";
import { LocaleSwitcher } from "@/components/LocaleSwitcher";
import { updatePassword } from "./actions";

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const [params, locale, supabase] = await Promise.all([
    searchParams,
    getLocale(),
    createClient(),
  ]);
  const { data } = await supabase.auth.getClaims();

  if (!data?.claims?.sub) {
    redirect("/forgot-password");
  }

  const fi = locale === "fi";

  return (
    <main className="nodra-auth min-h-screen px-5 py-12">
      <div className="mx-auto max-w-md">
        <div className="mb-7 flex items-start justify-between gap-4">
          <Link href="/" className="nodra-wordmark">NODRA</Link>
          <LocaleSwitcher locale={locale} label="" />
        </div>

        <div className="surface p-6 sm:p-8">
          <div className="kicker">{fi ? "Uusi salasana" : "New password"}</div>
          <h1 className="mt-2 text-2xl font-extrabold tracking-[-.03em]">
            {fi ? "Aseta uusi salasana" : "Set a new password"}
          </h1>
          <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
            {fi
              ? "Valitse vähintään 8 merkin salasana Nodra-tilillesi."
              : "Choose a password with at least 8 characters for your Nodra account."}
          </p>

          {params.error ? (
            <div className="nodra-alert nodra-alert-error mt-5">{params.error}</div>
          ) : null}

          <form action={updatePassword} className="mt-6 space-y-4">
            <label className="block">
              <span className="nodra-field-label">{fi ? "Uusi salasana" : "New password"}</span>
              <input name="password" type="password" minLength={8} autoComplete="new-password" required className="nodra-input mt-2 w-full" />
            </label>
            <label className="block">
              <span className="nodra-field-label">{fi ? "Vahvista salasana" : "Confirm password"}</span>
              <input name="passwordConfirm" type="password" minLength={8} autoComplete="new-password" required className="nodra-input mt-2 w-full" />
            </label>
            <button className="btn-primary w-full">
              {fi ? "Tallenna uusi salasana" : "Save new password"}
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}
