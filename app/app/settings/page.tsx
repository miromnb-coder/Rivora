import Image from "next/image";
import Link from "next/link";
import { requireWorkspace } from "@/lib/rivora/workspace";
import {
  inviteWorkspaceMember,
  removeWorkspaceLogo,
  updateWorkspaceMemberRole,
  updateWorkspaceSettings,
} from "./actions";
import { getLocale } from "@/lib/locale";
import { getSettingsCopy } from "@/lib/i18n/extra";
import { getBusinessCentralConfigurationStatus } from "@/lib/rivora/erp/business-central";
import { createAdminClient } from "@/lib/supabase/admin";

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string; message?: string; tone?: string }>;
}) {
  const [params, locale, workspaceContext] = await Promise.all([
    searchParams,
    getLocale(),
    requireWorkspace(),
  ]);
  const { supabase, workspace, claims } = workspaceContext;
  const copy = getSettingsCopy(locale);
  const fi = locale === "fi";
  const canManage = ["owner", "admin"].includes(workspace.role);
  const config = getBusinessCentralConfigurationStatus(workspace.id);

  const [{ data: organization }, { data: memberships }] = await Promise.all([
    supabase
      .from("organizations")
      .select(
        "name,business_id,address_line1,address_line2,postal_code,city,country,email,phone,logo_path,default_tax_rate,default_quote_validity_days,onboarding_completed_at",
      )
      .eq("id", workspace.id)
      .maybeSingle(),
    supabase
      .from("organization_members")
      .select("user_id,role,created_at")
      .eq("organization_id", workspace.id)
      .order("created_at"),
  ]);

  let logoDataUrl: string | null = null;
  if (organization?.logo_path) {
    const { data: logo } = await supabase.storage
      .from("workspace-assets")
      .download(organization.logo_path);

    if (logo) {
      const bytes = Buffer.from(await logo.arrayBuffer());
      const mime =
        logo.type ||
        (organization.logo_path.endsWith(".png") ? "image/png" : "image/jpeg");
      logoDataUrl = `data:${mime};base64,${bytes.toString("base64")}`;
    }
  }

  const memberRows = await Promise.all(
    (memberships ?? []).map(async (membership: any) => {
      let email = "";
      if (canManage) {
        try {
          const admin = createAdminClient();
          const { data } = await admin.auth.admin.getUserById(String(membership.user_id));
          email = String(data.user?.email || "");
        } catch {
          email = "";
        }
      }
      return {
        ...membership,
        email,
        isCurrent: String(membership.user_id) === String(claims.sub),
      };
    }),
  );

  const message = params.saved ? copy.saved : params.message;
  const tone = params.tone === "error" ? "error" : "ok";

  return (
    <div className="app-page-v2 self-service-settings">
      <header className="mb-7 flex flex-wrap items-end justify-between gap-4">
        <div className="max-w-3xl">
          <div className="app-kicker-v2">{copy.kicker}</div>
          <h1 className="mt-2 text-4xl font-extrabold tracking-[-.04em]">
            {fi ? "Asetukset" : "Settings"}
          </h1>
          <p className="mt-3 text-sm leading-6 text-[var(--muted)]">
            {fi
              ? "Hallitse yritystä, tarjouksia, Business Centralia ja käyttäjiä samasta paikasta."
              : "Manage company details, quoting, Business Central and users from one place."}
          </p>
        </div>
      </header>

      {message ? (
        <div
          className={
            "mb-5 rounded-xl border p-4 text-sm " +
            (tone === "error"
              ? "border-[#ead7d5] bg-[#fff8f7] text-[#8c3f38]"
              : "border-[#dfe7df] bg-[#f7faf7] text-[#426048]")
          }
        >
          {message}
        </div>
      ) : null}

      <nav className="settings-section-nav" aria-label={fi ? "Asetusosiot" : "Settings sections"}>
        <a href="#company">{fi ? "Yritystiedot" : "Company"}</a>
        <a href="#quote-settings">{fi ? "Tarjousasetukset" : "Quote settings"}</a>
        <a href="#brand">{fi ? "Brändi / PDF" : "Brand / PDF"}</a>
        <a href="#business-central">Business Central</a>
        <a href="#users">{fi ? "Käyttäjät" : "Users"}</a>
      </nav>

      <form action={updateWorkspaceSettings} className="grid gap-5">
        <section id="company" className="surface settings-self-section">
          <div className="settings-self-head">
            <div>
              <div className="upload-v2-section-label">{fi ? "Yritystiedot" : "Company"}</div>
              <h2>{fi ? "Yrityksen perustiedot" : "Company details"}</h2>
              <p>{fi ? "Näitä tietoja käytetään tarjouksissa ja asiakas-PDF:issä." : "These details are used in quotes and customer PDFs."}</p>
            </div>
          </div>

          <div className="settings-form-grid">
            <label className="sm:col-span-2">
              <span>{copy.company}</span>
              <input name="name" required maxLength={200} defaultValue={organization?.name || workspace.name} />
            </label>
            <label>
              <span>{copy.businessId} <em>{copy.optional}</em></span>
              <input name="businessId" maxLength={64} defaultValue={organization?.business_id || ""} />
            </label>
            <label>
              <span>{copy.email}</span>
              <input name="email" type="email" maxLength={320} defaultValue={organization?.email || ""} />
            </label>
            <label>
              <span>{copy.phone}</span>
              <input name="phone" maxLength={80} defaultValue={organization?.phone || ""} />
            </label>
            <label className="sm:col-span-2">
              <span>{copy.address}</span>
              <input name="addressLine1" maxLength={200} defaultValue={organization?.address_line1 || ""} placeholder={copy.street} />
              <input name="addressLine2" maxLength={200} defaultValue={organization?.address_line2 || ""} placeholder={copy.address2} />
            </label>
            <label>
              <span>{copy.postal}</span>
              <input name="postalCode" maxLength={32} defaultValue={organization?.postal_code || ""} />
            </label>
            <label>
              <span>{copy.city}</span>
              <input name="city" maxLength={120} defaultValue={organization?.city || ""} />
            </label>
            <label>
              <span>{copy.country}</span>
              <input name="country" maxLength={120} defaultValue={organization?.country || "Finland"} />
            </label>
          </div>
        </section>

        <section id="quote-settings" className="surface settings-self-section">
          <div className="settings-self-head">
            <div>
              <div className="upload-v2-section-label">{fi ? "Tarjousasetukset" : "Quote settings"}</div>
              <h2>{fi ? "Uusien tarjousten oletukset" : "Defaults for new quotes"}</h2>
            </div>
          </div>
          <div className="settings-form-grid">
            <label>
              <span>{copy.vat}</span>
              <input name="defaultTaxRate" type="number" min="0" max="100" step="0.01" required defaultValue={Number(organization?.default_tax_rate ?? 25.5)} />
            </label>
            <label>
              <span>{copy.validity}</span>
              <input name="defaultQuoteValidityDays" type="number" min="1" max="365" step="1" required defaultValue={Number(organization?.default_quote_validity_days ?? 14)} />
            </label>
          </div>
        </section>

        <section id="brand" className="surface settings-self-section">
          <div className="settings-self-head">
            <div>
              <div className="upload-v2-section-label">{fi ? "Brändi / PDF" : "Brand / PDF"}</div>
              <h2>{fi ? "Tarjouksen visuaalinen identiteetti" : "Quote identity"}</h2>
            </div>
          </div>

          <div className="grid gap-5 lg:grid-cols-[1fr_280px]">
            <label>
              <span className="settings-field-label">{copy.logo}</span>
              <input name="logo" type="file" accept="image/png,image/jpeg" />
              <small className="mt-2 block text-xs text-[var(--muted)]">PNG / JPEG · max 2 MB</small>
            </label>
            <div className="settings-brand-preview">
              {logoDataUrl ? (
                <Image
                  src={logoDataUrl}
                  alt={`${organization?.name || workspace.name} logo`}
                  width={220}
                  height={80}
                  unoptimized
                  className="max-h-16 w-auto object-contain"
                />
              ) : (
                <span>{copy.noLogo}</span>
              )}
              <strong>{organization?.name || workspace.name}</strong>
            </div>
          </div>
        </section>

        <div className="settings-save-row">
          {canManage ? (
            <button className="btn-primary">{copy.save}</button>
          ) : (
            <p className="text-sm text-[var(--muted)]">{copy.permission}</p>
          )}
        </div>
      </form>

      {organization?.logo_path && canManage ? (
        <form action={removeWorkspaceLogo} className="mt-3">
          <button className="btn-secondary">{copy.removeLogo}</button>
        </form>
      ) : null}

      <section id="business-central" className="surface settings-self-section mt-5">
        <div className="settings-self-head settings-self-head-row">
          <div>
            <div className="upload-v2-section-label">Business Central</div>
            <h2>{fi ? "ERP-yhteys" : "ERP connection"}</h2>
            <p>
              {config.configured
                ? fi
                  ? "Business Central on yhdistetty tähän työtilaan."
                  : "Business Central is connected to this workspace."
                : fi
                  ? "Yhteys vaatii vielä määrityksiä ennen ERP-vientiä."
                  : "The connection still needs configuration before ERP export."}
            </p>
          </div>
          <span className={config.configured ? "settings-status is-ready" : "settings-status is-warning"}>
            {config.configured ? (fi ? "Yhdistetty" : "Connected") : (fi ? "Vaatii huomiota" : "Needs attention")}
          </span>
        </div>
        <div className="settings-connection-grid">
          <div><span>{fi ? "Ympäristö" : "Environment"}</span><strong>{config.environment || "—"}</strong></div>
          <div><span>Company ID</span><strong>{config.companyId || "—"}</strong></div>
          <div><span>{fi ? "Työtila" : "Workspace"}</span><strong>{config.workspaceMatches ? (fi ? "Täsmää" : "Matched") : (fi ? "Ei täsmää" : "Mismatch")}</strong></div>
        </div>
        <div className="mt-4">
          <Link href="/app/settings/business-central" className="btn-secondary">
            {fi ? "Hallitse BC-vastineita" : "Manage BC mappings"} →
          </Link>
        </div>
      </section>

      <section id="users" className="surface settings-self-section mt-5">
        <div className="settings-self-head">
          <div>
            <div className="upload-v2-section-label">{fi ? "Käyttäjät" : "Users"}</div>
            <h2>{fi ? "Työtilan käyttäjät ja roolit" : "Workspace users and roles"}</h2>
            <p>{fi ? "Adminit voivat kutsua käyttäjiä ja hallita käyttöoikeuksia." : "Admins can invite users and manage access."}</p>
          </div>
        </div>

        {canManage ? (
          <form action={inviteWorkspaceMember} className="settings-invite-row">
            <input name="email" type="email" required placeholder={fi ? "käyttäjä@yritys.fi" : "user@company.com"} />
            <select name="role" defaultValue="member">
              <option value="member">{fi ? "Jäsen" : "Member"}</option>
              <option value="reviewer">{fi ? "Tarkistaja" : "Reviewer"}</option>
              <option value="admin">Admin</option>
            </select>
            <button className="btn-primary">{fi ? "Kutsu käyttäjä" : "Invite user"}</button>
          </form>
        ) : null}

        <div className="settings-members">
          {memberRows.map((member: any) => (
            <div key={member.user_id} className="settings-member-row">
              <div>
                <strong>{member.isCurrent ? (fi ? "Sinä" : "You") : member.email || String(member.user_id).slice(0, 8)}</strong>
                <span>{member.email || (fi ? "Käyttäjä" : "User")}</span>
              </div>
              {canManage && !member.isCurrent ? (
                <form action={updateWorkspaceMemberRole}>
                  <input type="hidden" name="userId" value={member.user_id} />
                  <select name="role" defaultValue={member.role}>
                    {workspace.role === "owner" ? <option value="owner">{fi ? "Omistaja" : "Owner"}</option> : null}
                    <option value="admin">Admin</option>
                    <option value="member">{fi ? "Jäsen" : "Member"}</option>
                    <option value="reviewer">{fi ? "Tarkistaja" : "Reviewer"}</option>
                  </select>
                  <button className="btn-secondary">{fi ? "Päivitä" : "Update"}</button>
                </form>
              ) : (
                <span className="settings-role-badge">{member.role}</span>
              )}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
