import { login } from "./actions";
import { getDictionary } from "@/lib/i18n";
import { getLocale } from "@/lib/locale";
import { LocaleSwitcher } from "@/components/LocaleSwitcher";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; message?: string }>;
}) {
  const [params, locale] = await Promise.all([searchParams, getLocale()]);
  const copy = getDictionary(locale).login;

  return (
    <main className="nodra-auth min-h-screen px-5 py-12">
      <div className="mx-auto max-w-md">
        <div className="mb-7 flex items-start justify-between gap-4">
          <div>
            <div className="text-2xl font-extrabold tracking-[-.04em] text-[#171a18]">Nodra</div>
            <div className="mt-2 text-sm text-[var(--muted)]">{copy.product}</div>
          </div>
          <LocaleSwitcher locale={locale} label="" />
        </div>

        <div className="surface p-6 sm:p-8">
          <div className="kicker">{copy.secure}</div>
          <h1 className="mt-2 text-2xl font-extrabold tracking-[-.03em]">{copy.title}</h1>
          <p className="mt-2 text-sm leading-6 text-[var(--muted)]">{copy.description}</p>

          {params.error ? (
            <div className="nodra-alert nodra-alert-error mt-5">{params.error}</div>
          ) : null}
          {params.message ? (
            <div className="nodra-alert mt-5">{params.message}</div>
          ) : null}

          <form className="mt-6 space-y-4">
            <label className="block">
              <span className="nodra-field-label">{copy.email}</span>
              <input name="email" type="email" required className="nodra-input mt-2 w-full" />
            </label>
            <label className="block">
              <span className="nodra-field-label">{copy.password}</span>
              <input name="password" type="password" minLength={8} required className="nodra-input mt-2 w-full" />
            </label>
            <div className="pt-2">
              <button formAction={login} className="btn-primary w-full">{copy.signIn}</button>
            </div>
            <p className="mt-4 text-center text-xs leading-5 text-[var(--muted)]">
              {locale === "fi"
                ? "Uudet Nodra-tilit luodaan vain hyväksytyn pilotin kutsusta."
                : "New Nodra accounts are created by approved pilot invitation only."}
            </p>
          </form>
        </div>
      </div>
    </main>
  );
}
