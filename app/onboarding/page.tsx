import { redirect } from "next/navigation";
import { getAuthContext } from "@/lib/rivora/workspace";
import { createWorkspace } from "./actions";
import { getLocale } from "@/lib/locale";
import { getOnboardingCopy } from "@/lib/i18n/extra";
import { LocaleSwitcher } from "@/components/LocaleSwitcher";

export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const [params, locale, auth] = await Promise.all([searchParams, getLocale(), getAuthContext()]);
  const { claims, workspace } = auth;
  if (!claims) redirect("/login");
  if (workspace) redirect("/app/inbox");
  const copy = getOnboardingCopy(locale);

  return (
    <main className="nodra-auth min-h-screen px-5 py-12">
      <div className="mx-auto max-w-lg">
        <div className="mb-5 flex justify-end"><LocaleSwitcher locale={locale} label="" /></div>
        <div className="surface p-7">
          <div className="kicker">{copy.kicker}</div>
          <h1 className="mt-2 text-3xl font-extrabold tracking-[-.04em]">{copy.title}</h1>
          <p className="mt-2 text-sm leading-6 text-[var(--muted)]">{copy.body}</p>
          {params.error ? <div className="nodra-alert nodra-alert-error mt-5">{params.error}</div> : null}
          <form action={createWorkspace} className="mt-6">
            <label className="block">
              <span className="nodra-field-label">{copy.name}</span>
              <input name="workspaceName" required placeholder={copy.placeholder} className="nodra-input mt-2 w-full" />
            </label>
            <button className="btn-primary mt-5 w-full">{copy.create}</button>
          </form>
        </div>
      </div>
    </main>
  );
}
