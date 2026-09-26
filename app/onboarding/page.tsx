import { redirect } from "next/navigation";
import { getAuthContext } from "@/lib/rivora/workspace";
import { createWorkspace } from "./actions";
import { getLocale } from "@/lib/locale";
import { getOnboardingCopy } from "@/lib/i18n/extra";
import { LocaleSwitcher } from "@/components/LocaleSwitcher";
import { signOut } from "@/app/app/actions";

export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const [params, locale, auth] = await Promise.all([searchParams, getLocale(), getAuthContext()]);
  const { claims, workspace, supabase } = auth;
  if (!claims) redirect("/login");
  if (workspace) redirect("/app/inbox");

  const email = String(claims.email ?? "").trim().toLowerCase();
  const { data: invite } = email
    ? await supabase
        .from("pilot_access_invites")
        .select("id, company_name, accepted_at")
        .eq("email", email)
        .is("revoked_at", null)
        .maybeSingle()
    : { data: null };

  const copy = getOnboardingCopy(locale);
  const fi = locale === "fi";

  if (!invite) {
    return (
      <main className="nodra-auth min-h-screen px-5 py-12">
        <div className="mx-auto max-w-lg">
          <div className="mb-5 flex justify-end"><LocaleSwitcher locale={locale} label="" /></div>
          <div className="surface p-7">
            <div className="kicker">{fi ? "Kutsu vaaditaan" : "Invitation required"}</div>
            <h1 className="mt-2 text-3xl font-extrabold tracking-[-.04em]">
              {fi ? "Tällä tilillä ei ole hyväksyttyä Nodra Pilot -kutsua." : "This account does not have an approved Nodra Pilot invitation."}
            </h1>
            <p className="mt-3 text-sm leading-6 text-[var(--muted)]">
              {fi
                ? "Uudet työtilat avataan hyväksytyn pilotin jälkeen. Jos olet jo sopinut pilotista, pyydä uusi kutsu Nodra-yhteyshenkilöltäsi."
                : "New workspaces are opened after an approved pilot. If you have already agreed a pilot, ask your Nodra contact for a new invitation."}
            </p>
            <form action={signOut} className="mt-6">
              <button className="btn-secondary w-full">{fi ? "Kirjaudu ulos" : "Sign out"}</button>
            </form>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="nodra-auth min-h-screen px-5 py-12">
      <div className="mx-auto max-w-lg">
        <div className="mb-5 flex justify-end"><LocaleSwitcher locale={locale} label="" /></div>
        <div className="surface p-7">
          <div className="kicker">{copy.kicker}</div>
          <h1 className="mt-2 text-3xl font-extrabold tracking-[-.04em]">{copy.title}</h1>
          <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
            {fi
              ? "Kutsusi on vahvistettu. Luo työtila ja aseta salasana tulevia kirjautumisia varten."
              : "Your invitation is verified. Create the workspace and set a password for future sign-ins."}
          </p>
          {params.error ? <div className="nodra-alert nodra-alert-error mt-5">{params.error}</div> : null}
          <form action={createWorkspace} className="mt-6 space-y-4">
            <label className="block">
              <span className="nodra-field-label">{copy.name}</span>
              <input
                name="workspaceName"
                required
                defaultValue={invite.company_name ?? ""}
                placeholder={copy.placeholder}
                className="nodra-input mt-2 w-full"
              />
            </label>
            <label className="block">
              <span className="nodra-field-label">{fi ? "Salasana" : "Password"}</span>
              <input name="password" type="password" minLength={8} required className="nodra-input mt-2 w-full" />
            </label>
            <label className="block">
              <span className="nodra-field-label">{fi ? "Vahvista salasana" : "Confirm password"}</span>
              <input name="passwordConfirm" type="password" minLength={8} required className="nodra-input mt-2 w-full" />
            </label>
            <button className="btn-primary mt-2 w-full">{copy.create}</button>
          </form>
        </div>
      </div>
    </main>
  );
}
