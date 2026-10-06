import Link from "next/link";
import { redirect } from "next/navigation";
import { getLocale } from "@/lib/locale";
import { requireWorkspace } from "@/lib/rivora/workspace";
import { isSupportOperatorEmail } from "@/lib/rivora/support-operator";
import { SupportInbox } from "@/components/support/SupportInbox";

export const dynamic = "force-dynamic";

export default async function SupportInboxPage() {
  const [context, locale] = await Promise.all([
    requireWorkspace(),
    getLocale(),
  ]);
  const fi = locale === "fi";
  const email =
    typeof context.claims.email === "string" ? context.claims.email : null;

  if (!isSupportOperatorEmail(email)) {
    redirect("/app/settings");
  }

  return (
    <div className="app-page-v2 support-ops-page">
      <div className="mb-5">
        <Link href="/app/settings" className="text-sm font-semibold">
          ← {fi ? "Asetukset" : "Settings"}
        </Link>
      </div>

      <header className="mb-7">
        <div className="app-kicker-v2">Averomira Support</div>
        <h1 className="mt-2 max-w-4xl text-4xl font-bold tracking-tight">
          {fi ? "Tukipyyntöjen käsittely" : "Support inbox"}
        </h1>
        <p className="mt-3 max-w-3xl text-[var(--muted)]">
          {fi
            ? "Vastaa asiakkaiden tukipyyntöihin, päivitä tila ja pidä keskustelu Averomiran sisällä."
            : "Reply to customer support requests, update status and keep the conversation inside Averomira."}
        </p>
      </header>

      <SupportInbox locale={locale} />
    </div>
  );
}
