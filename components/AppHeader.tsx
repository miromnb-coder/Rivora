import Link from "next/link";
import { signOut } from "@/app/app/actions";
import { LocaleSwitcher } from "@/components/LocaleSwitcher";
import type { Locale } from "@/lib/locale";

export function AppHeader({ workspaceName, workspaceLabel, userEmail, locale, languageLabel, signOutLabel }: {
  workspaceName: string;
  workspaceLabel: string;
  userEmail?: string;
  locale: Locale;
  languageLabel: string;
  signOutLabel: string;
}) {
  return (
    <header className="atelier-app-header">
      <Link href="/app" className="atelier-app-header-brand nodra-wordmark" aria-label="Averomira">Averomira</Link>
      <div className="atelier-app-header-workspace">
        <span>{workspaceLabel}</span>
        <strong>{workspaceName}</strong>
      </div>
      <div className="atelier-app-header-actions">
        <LocaleSwitcher locale={locale} label={languageLabel} />
        {userEmail ? <span className="atelier-app-header-email" title={userEmail}>{userEmail}</span> : null}
        <form action={signOut}><button type="submit" className="atelier-app-header-signout">{signOutLabel}</button></form>
      </div>
    </header>
  );
}
