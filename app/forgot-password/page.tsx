import Link from "next/link";
import { getLocale } from "@/lib/locale";
import { LocaleSwitcher } from "@/components/LocaleSwitcher";
import { requestPasswordReset } from "./actions";

export default async function ForgotPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ sent?: string }>;
}) {
  const [params, locale] = await Promise.all([searchParams, getLocale()]);
  const fi = locale === "fi";
  const sent = params.sent === "1";

  return (
    <main className="nodra-auth min-h-screen px-5 py-12">
      <div className="mx-auto max-w-md">
        <div className="mb-7 flex items-start justify-between gap-4">
          <Link href="/" className="nodra-wordmark">NODRA</Link>
          <LocaleSwitcher locale={locale} label="" />
        </div>

        <div className="surface p-6 sm:p-8">
          <div className="kicker">{fi ? "Tilin palautus" : "Account recovery"}</div>
          <h1 className="mt-2 text-2xl font-extrabold tracking-[-.03em]">
            {fi ? "Unohditko salasanasi?" : "Forgot your password?"}
          </h1>
          <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
            {fi
              ? "Syötä Nodra-tilisi sähköpostiosoite. Jos osoitteella on tili, lähetämme turvallisen palautuslinkin."
              : "Enter the email address for your Nodra account. If an account exists, we will send a secure recovery link."}
          </p>

          {sent ? (
            <div className="nodra-alert mt-5" role="status">
              {fi
                ? "Jos osoitteella on Nodra-tili, palautuslinkki on lähetetty. Tarkista myös roskapostikansio."
                : "If a Nodra account exists for that address, a recovery link has been sent. Check your spam folder too."}
            </div>
          ) : null}

          <form action={requestPasswordReset} className="mt-6 space-y-4">
            <label className="block">
              <span className="nodra-field-label">{fi ? "Sähköposti" : "Email"}</span>
              <input
                name="email"
                type="email"
                autoComplete="email"
                maxLength={320}
                required
                className="nodra-input mt-2 w-full"
              />
            </label>
            <button className="btn-primary w-full">
              {fi ? "Lähetä palautuslinkki" : "Send recovery link"}
            </button>
          </form>

          <Link href="/login" className="mt-5 block text-center text-xs font-semibold text-[#5f6560] hover:text-[#171a18]">
            ← {fi ? "Takaisin kirjautumiseen" : "Back to sign in"}
          </Link>
        </div>
      </div>
    </main>
  );
}
