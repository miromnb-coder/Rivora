import Image from "next/image";
import Link from "next/link";
import { requireWorkspace } from "@/lib/rivora/workspace";
import {
  inviteWorkspaceMember,
  removeWorkspaceLogo,
  updateWorkspaceErpProvider,
  updateWorkspaceRequestedErp,
  updateWorkspaceMemberRole,
  updateWorkspaceSettings,
} from "./actions";
import { getLocale } from "@/lib/locale";
import { getSettingsCopy } from "@/lib/i18n/extra";
import {
  getErpAdapter,
  getErpProviderCapability,
} from "@/lib/rivora/erp";
import { createAdminClient } from "@/lib/supabase/admin";
import { isSupportOperatorEmail } from "@/lib/rivora/support-operator";
import {
  disconnectBusinessCentralConnectionAction,
  saveBusinessCentralConnectionAction,
  verifyBusinessCentralConnectionAction,
} from "./erp-actions";

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
  const erpAdapter = getErpAdapter(workspace.erpProvider);
  const config = erpAdapter
    ? await erpAdapter.getConfigurationStatus(workspace.id)
    : {
        configured: false,
        workspaceMatches: false,
        missing: [],
        environment: null,
        companyId: null,
        source: null,
        connectionStatus: null,
        verifiedAt: null,
        verifiedCompanyName: null,
        lastError: null,
        tenantId: null,
        clientId: null,
      };

  const [{ data: organization }, { data: memberships }] = await Promise.all([
    supabase
      .from("organizations")
      .select(
        "name,business_id,address_line1,address_line2,postal_code,city,country,email,phone,logo_path,default_tax_rate,default_quote_validity_days,onboarding_completed_at,erp_provider,erp_requested_name",
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

  const erpProvider = String(organization?.erp_provider || workspace.erpProvider || "none");
  const erpCapability = getErpProviderCapability(erpProvider);
  const requestedErpName = String(
    organization?.erp_requested_name || workspace.erpRequestedName || "",
  ).trim();
  const message = params.saved ? copy.saved : params.message;
  const tone = params.tone === "error" ? "error" : "ok";

  return (
    <div className="app-page-v2 self-service-settings">
      <header className="product-page-head settings-page-head">
        <div className="max-w-3xl">
          <div className="app-kicker-v2">{copy.kicker}</div>
          <h1 className="mt-2 text-4xl font-extrabold tracking-[-.04em]">
            {fi ? "Asetukset" : "Settings"}
          </h1>
          <p className="mt-3 text-sm leading-6 text-[var(--muted)]">
            {fi
              ? "Hallitse yritystä, tarjouksia, ERP-yhteyttä ja käyttäjiä samasta paikasta."
              : "Manage company details, quoting, the ERP connection and users from one place."}
          </p>
        </div>
      </header>

      <nav aria-label={fi ? "Asetusten osiot" : "Settings sections"}
        className="mb-7 flex flex-wrap gap-2 border-b border-[var(--app-line)] pb-5">
        {([
          ["#company", fi ? "Yritys" : "Company"],
          ["#quote-settings", fi ? "Tarjoukset" : "Quotes"],
          ["#brand", fi ? "Brändi" : "Brand"],
          ["#erp", "Business Central"],
          ["#users", fi ? "Käyttäjät" : "Users"],
          ["/app/memory", fi ? "Älykäs muisti" : "Smart memory"],
        ] as const).map(([href, label]) => (
          <Link key={href} href={href}
            className="inline-flex min-h-10 items-center rounded-[7px] border border-[var(--app-line)] bg-white px-3 text-[13px] font-semibold text-[var(--app-ink)] hover:bg-[var(--app-selected)]">
            {label}
          </Link>
        ))}
        {canManage ? (
          <Link href="/app/settings/operations"
            className="inline-flex min-h-10 items-center rounded-[7px] border border-[var(--app-line)] bg-white px-3 text-[13px] font-semibold text-[var(--app-ink)] hover:bg-[var(--app-selected)]">
            {fi ? "Toiminnan hallinta" : "Operations"}
          </Link>
        ) : null}
        {isSupportOperatorEmail(typeof claims.email === "string" ? claims.email : null) ? (
          <Link href="/app/settings/support"
            className="inline-flex min-h-10 items-center rounded-[7px] border border-[var(--app-line)] bg-white px-3 text-[13px] font-semibold text-[var(--app-ink)] hover:bg-[var(--app-selected)]">
            {fi ? "Tukipyynnöt" : "Support inbox"}
          </Link>
        ) : null}
      </nav>

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


      <form action={updateWorkspaceSettings} className="settings-core-form">
        <section id="company" className="settings-core-section scroll-mt-5">
          <div className="mb-5">
            <div>
              <div className="upload-v2-section-label">{fi ? "Yritystiedot" : "Company"}</div>
              <h2 className="mt-1 text-xl font-bold tracking-[-.02em]">{fi ? "Yrityksen perustiedot" : "Company details"}</h2>
              <p className="mt-2 text-sm text-[var(--muted)]">{fi ? "Näitä tietoja käytetään tarjouksissa ja asiakas-PDF:issä." : "These details are used in quotes and customer PDFs."}</p>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="sm:col-span-2">
              <span>{copy.company}</span>
              <input name="name" required maxLength={200} defaultValue={organization?.name || workspace.name} className="mt-2 block w-full rounded-[10px] border border-[var(--line)] bg-white px-3 py-2.5 text-sm outline-none" />
            </label>
            <label>
              <span>{copy.businessId} <em>{copy.optional}</em></span>
              <input name="businessId" maxLength={64} defaultValue={organization?.business_id || ""} className="mt-2 block w-full rounded-[10px] border border-[var(--line)] bg-white px-3 py-2.5 text-sm outline-none" />
            </label>
            <label>
              <span>{copy.email}</span>
              <input name="email" type="email" maxLength={320} defaultValue={organization?.email || ""} className="mt-2 block w-full rounded-[10px] border border-[var(--line)] bg-white px-3 py-2.5 text-sm outline-none" />
            </label>
            <label>
              <span>{copy.phone}</span>
              <input name="phone" maxLength={80} defaultValue={organization?.phone || ""} className="mt-2 block w-full rounded-[10px] border border-[var(--line)] bg-white px-3 py-2.5 text-sm outline-none" />
            </label>
            <label className="sm:col-span-2">
              <span>{copy.address}</span>
              <input name="addressLine1" maxLength={200} defaultValue={organization?.address_line1 || ""} placeholder={copy.street} className="mt-2 block w-full rounded-[10px] border border-[var(--line)] bg-white px-3 py-2.5 text-sm outline-none" />
              <input name="addressLine2" maxLength={200} defaultValue={organization?.address_line2 || ""} placeholder={copy.address2} className="mt-2 block w-full rounded-[10px] border border-[var(--line)] bg-white px-3 py-2.5 text-sm outline-none" />
            </label>
            <label>
              <span>{copy.postal}</span>
              <input name="postalCode" maxLength={32} defaultValue={organization?.postal_code || ""} className="mt-2 block w-full rounded-[10px] border border-[var(--line)] bg-white px-3 py-2.5 text-sm outline-none" />
            </label>
            <label>
              <span>{copy.city}</span>
              <input name="city" maxLength={120} defaultValue={organization?.city || ""} className="mt-2 block w-full rounded-[10px] border border-[var(--line)] bg-white px-3 py-2.5 text-sm outline-none" />
            </label>
            <label>
              <span>{copy.country}</span>
              <input name="country" maxLength={120} defaultValue={organization?.country || "Finland"} className="mt-2 block w-full rounded-[10px] border border-[var(--line)] bg-white px-3 py-2.5 text-sm outline-none" />
            </label>
          </div>
        </section>

        <section id="quote-settings" className="settings-core-section scroll-mt-5">
          <div className="mb-5">
            <div>
              <div className="upload-v2-section-label">{fi ? "Tarjousasetukset" : "Quote settings"}</div>
              <h2 className="mt-1 text-xl font-bold tracking-[-.02em]">{fi ? "Uusien tarjousten oletukset" : "Defaults for new quotes"}</h2>
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <label>
              <span>{copy.vat}</span>
              <input name="defaultTaxRate" type="number" min="0" max="100" step="0.01" required defaultValue={Number(organization?.default_tax_rate ?? 25.5)} className="mt-2 block w-full rounded-[10px] border border-[var(--line)] bg-white px-3 py-2.5 text-sm outline-none" />
            </label>
            <label>
              <span>{copy.validity}</span>
              <input name="defaultQuoteValidityDays" type="number" min="1" max="365" step="1" required defaultValue={Number(organization?.default_quote_validity_days ?? 14)} className="mt-2 block w-full rounded-[10px] border border-[var(--line)] bg-white px-3 py-2.5 text-sm outline-none" />
            </label>
          </div>
        </section>

        <section id="brand" className="settings-core-section scroll-mt-5">
          <div className="mb-5">
            <div>
              <div className="upload-v2-section-label">{fi ? "Brändi / PDF" : "Brand / PDF"}</div>
              <h2 className="mt-1 text-xl font-bold tracking-[-.02em]">{fi ? "Tarjouksen visuaalinen identiteetti" : "Quote identity"}</h2>
            </div>
          </div>

          <div className="grid gap-5 lg:grid-cols-[1fr_280px]">
            <label>
              <span className="settings-field-label">{copy.logo}</span>
              <input name="logo" type="file" accept="image/png,image/jpeg" className="mt-2 block w-full rounded-[10px] border border-[var(--line)] bg-white px-3 py-2.5 text-sm" />
              <small className="mt-2 block text-xs text-[var(--muted)]">PNG / JPEG · max 2 MB</small>
            </label>
            <div className="flex min-h-32 flex-col justify-center gap-3 rounded-2xl border border-[var(--line)] bg-[var(--app-paper)] p-5">
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

        <div className="settings-core-save">
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

      <section id="erp" className="surface mt-5 scroll-mt-5 p-6">
        <div className="mb-5">
          <div className="upload-v2-section-label">{fi ? "ERP-järjestelmä" : "ERP system"}</div>
          <h2 className="mt-1 text-xl font-bold tracking-[-.02em]">
            {fi ? "ERP-yhteys" : "ERP connection"}
          </h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--muted)]">
            {fi
              ? "Valitse työtilan ERP. Valinta ei estä RFQ-, tarjous-, PO- tai Sales Order Draft -työskentelyä."
              : "Choose the workspace ERP. This choice does not block RFQ, quote, PO or Sales Order Draft work."}
          </p>
        </div>

        <form action={updateWorkspaceErpProvider} className="grid gap-3 border-y border-[var(--line)] py-5 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
          <label>
            <span className="settings-field-label">{fi ? "Käytössä oleva ERP" : "ERP in use"}</span>
            <select
              name="erpProvider"
              defaultValue={erpProvider}
              disabled={!canManage}
              className="mt-2 block w-full rounded-[10px] border border-[var(--line)] bg-white px-3 py-2.5 text-sm"
            >
              <option value="business_central">
                {fi ? "Microsoft Business Central — natiivi integraatio" : "Microsoft Business Central — native integration"}
              </option>
              <option value="custom">
                {fi ? "Muu ERP — ei natiivia integraatiota" : "Other ERP — no native integration"}
              </option>
              <option value="none">{fi ? "Ei ERP-integraatiota" : "No ERP integration"}</option>
            </select>
          </label>
          {canManage ? (
            <button className="btn-secondary">{fi ? "Tallenna ERP-valinta" : "Save ERP choice"}</button>
          ) : null}
        </form>

        {erpProvider === "business_central" ? (
          <div className="mt-5">
            <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="upload-v2-section-label">Microsoft Business Central</div>
                <h3 className="mt-1 text-lg font-bold tracking-[-.02em]">
                  {fi ? "Asiakaskohtainen ERP-yhteys" : "Workspace ERP connection"}
                </h3>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--muted)]">
                  {config.source === "legacy_env"
                    ? fi
                      ? "Nykyinen production-yhteys käyttää vielä palvelimen legacy-määritystä. Sen voi siirtää turvallisesti tämän työtilan omaksi yhteydeksi tallentamalla alla olevan lomakkeen."
                      : "The current production connection still uses the legacy server configuration. Save the form below to migrate it securely to this workspace."
                    : config.configured
                      ? fi
                        ? "Business Central -tunnukset on tallennettu tälle työtilalle ja yhteys on tarkistettu."
                        : "Business Central credentials are stored for this workspace and the connection is verified."
                      : fi
                        ? "Tallenna tämän asiakkaan Microsoft-tunnukset ja tarkista yhteys ennen ERP-vientiä."
                        : "Save this customer's Microsoft credentials and verify the connection before ERP export."}
                </p>
              </div>
              <span className={config.configured ? "settings-status is-ready" : "settings-status is-warning"}>
                {config.configured
                  ? config.source === "legacy_env"
                    ? (fi ? "Yhdistetty · legacy" : "Connected · legacy")
                    : (fi ? "Yhdistetty" : "Connected")
                  : config.connectionStatus === "error"
                    ? (fi ? "Tarkistus epäonnistui" : "Verification failed")
                    : config.connectionStatus === "disconnected"
                      ? (fi ? "Katkaistu" : "Disconnected")
                      : (fi ? "Vaatii tarkistuksen" : "Needs verification")}
              </span>
            </div>

            <div className="settings-p1-connection-strip">
              <div className="p-4">
                <span className="block text-[9px] font-bold uppercase tracking-wider text-[var(--muted)]">{fi ? "Ympäristö" : "Environment"}</span>
                <strong className="mt-2 block text-sm">{config.environment || "—"}</strong>
              </div>
              <div className="border-t border-[var(--line)] p-4 sm:border-l sm:border-t-0">
                <span className="block text-[9px] font-bold uppercase tracking-wider text-[var(--muted)]">Company ID</span>
                <strong className="mt-2 block break-all text-sm">{config.companyId || "—"}</strong>
              </div>
              <div className="border-t border-[var(--line)] p-4 sm:border-l sm:border-t-0">
                <span className="block text-[9px] font-bold uppercase tracking-wider text-[var(--muted)]">{fi ? "Yritys" : "Company"}</span>
                <strong className="mt-2 block text-sm">{config.verifiedCompanyName || "—"}</strong>
              </div>
              <div className="border-t border-[var(--line)] p-4 sm:border-l sm:border-t-0">
                <span className="block text-[9px] font-bold uppercase tracking-wider text-[var(--muted)]">{fi ? "Viimeksi tarkistettu" : "Last verified"}</span>
                <strong className="mt-2 block text-sm">
                  {config.verifiedAt ? new Date(config.verifiedAt).toLocaleString(fi ? "fi-FI" : "en-US") : "—"}
                </strong>
              </div>
            </div>

            {config.lastError ? (
              <div className="mt-4 rounded-xl border border-[#ead7d5] bg-[#fff8f7] p-4 text-sm text-[#8c3f38]">
                {config.lastError}
              </div>
            ) : null}

            {canManage ? (
              <form action={saveBusinessCentralConnectionAction} className="mt-5 grid gap-4 rounded-xl border border-[var(--line)] bg-[var(--app-paper)] p-5 sm:grid-cols-2">
                <label className="sm:col-span-2">
                  <span className="settings-field-label">Microsoft tenant ID</span>
                  <input
                    name="tenantId"
                    required
                    maxLength={240}
                    defaultValue={config.tenantId || ""}
                    className="mt-2 block w-full rounded-[10px] border border-[var(--line)] bg-white px-3 py-2.5 text-sm"
                    autoComplete="off"
                  />
                </label>
                <label>
                  <span className="settings-field-label">Application (client) ID</span>
                  <input
                    name="clientId"
                    required
                    maxLength={240}
                    defaultValue={config.clientId || ""}
                    className="mt-2 block w-full rounded-[10px] border border-[var(--line)] bg-white px-3 py-2.5 text-sm"
                    autoComplete="off"
                  />
                </label>
                <label>
                  <span className="settings-field-label">Client secret</span>
                  <input
                    name="clientSecret"
                    type="password"
                    maxLength={4000}
                    placeholder={config.source === "workspace" && config.connectionStatus !== "disconnected" ? "••••••••" : fi ? "Syötä client secret" : "Enter client secret"}
                    className="mt-2 block w-full rounded-[10px] border border-[var(--line)] bg-white px-3 py-2.5 text-sm"
                    autoComplete="new-password"
                  />
                  <small className="mt-1.5 block text-xs leading-5 text-[var(--muted)]">
                    {fi
                      ? "Salaisuutta ei koskaan näytetä takaisin. Jätä tyhjäksi, jos haluat säilyttää jo tallennetun salaisuuden."
                      : "The secret is never shown again. Leave blank to keep an already stored secret."}
                  </small>
                </label>
                <label>
                  <span className="settings-field-label">Environment</span>
                  <input
                    name="environment"
                    required
                    maxLength={120}
                    defaultValue={config.environment || "Production"}
                    className="mt-2 block w-full rounded-[10px] border border-[var(--line)] bg-white px-3 py-2.5 text-sm"
                    autoComplete="off"
                  />
                </label>
                <label>
                  <span className="settings-field-label">Company ID</span>
                  <input
                    name="companyId"
                    required
                    maxLength={120}
                    defaultValue={config.companyId || ""}
                    className="mt-2 block w-full rounded-[10px] border border-[var(--line)] bg-white px-3 py-2.5 text-sm"
                    autoComplete="off"
                  />
                </label>
                <div className="sm:col-span-2 flex flex-wrap gap-2">
                  <button className="btn-primary">
                    {config.source === "legacy_env"
                      ? fi ? "Siirrä työtilakohtaiseksi ja tarkista" : "Migrate to workspace and verify"
                      : fi ? "Tallenna ja tarkista yhteys" : "Save and verify connection"}
                  </button>
                </div>
              </form>
            ) : null}

            <div className="mt-4 flex flex-wrap gap-2">
              {canManage && config.source === "workspace" && config.connectionStatus !== "disconnected" ? (
                <form action={verifyBusinessCentralConnectionAction}>
                  <button className="btn-secondary">{fi ? "Tarkista uudelleen" : "Verify again"}</button>
                </form>
              ) : null}
              {canManage && (config.source || config.connectionStatus === "disconnected") ? (
                <form action={disconnectBusinessCentralConnectionAction}>
                  <button className="btn-secondary">{fi ? "Katkaise yhteys" : "Disconnect"}</button>
                </form>
              ) : null}
              <Link href="/app/settings/business-central" className="btn-secondary">
                {fi ? "Hallitse BC-vastineita" : "Manage BC mappings"} →
              </Link>
            </div>
          </div>
        ) : erpCapability.availability === "unsupported" ? (
          <div className="mt-5 rounded-xl border border-[var(--line)] bg-[var(--app-paper)] p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <strong className="block">
                  {requestedErpName
                    ? requestedErpName
                    : fi ? "Muu ERP" : "Other ERP"}
                </strong>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--muted)]">
                  {fi
                    ? "Tälle ERP:lle ei ole tässä versiossa natiivia adapteria. Averomira ei pyydä ERP-tunnuksia eikä yritä automaattista vientiä. RFQ-, tarjous-, PO- ja Sales Order Draft -työnkulku toimii silti normaalisti."
                    : "There is no native adapter for this ERP in this version. Averomira does not request ERP credentials or attempt automatic export. RFQ, quote, PO and Sales Order Draft workflows remain available."}
                </p>
              </div>
              <span className="settings-status is-warning">
                {fi ? "Ei natiivia integraatiota" : "No native integration"}
              </span>
            </div>
            {canManage ? (
              <form action={updateWorkspaceRequestedErp} className="mt-5 grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
                <label>
                  <span className="settings-field-label">
                    {fi ? "Käytössä olevan ERP:n nimi" : "ERP system name"}
                  </span>
                  <input
                    name="erpRequestedName"
                    required
                    maxLength={120}
                    defaultValue={requestedErpName}
                    placeholder={fi ? "Esim. SAP S/4HANA, NetSuite tai Visma" : "e.g. SAP S/4HANA, NetSuite or Visma"}
                    className="mt-2 block w-full rounded-[10px] border border-[var(--line)] bg-white px-3 py-2.5 text-sm"
                  />
                </label>
                <button className="btn-secondary">
                  {fi ? "Tallenna ERP-nimi" : "Save ERP name"}
                </button>
              </form>
            ) : null}
          </div>
        ) : erpCapability.availability === "unavailable" ? (
          <div className="mt-5 rounded-xl border border-[#ead7d5] bg-[#fff8f7] p-5">
            <strong className="block">
              {fi ? "ERP-adapteri ei ole saatavilla" : "ERP adapter unavailable"}
            </strong>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--muted)]">
              {fi
                ? `Työtilalle on tallennettu ERP-provider “${erpCapability.key}”, mutta tässä Averomira-versiossa sille ei ole natiivia adapteria. Automaattista vientiä ei yritetä.`
                : `The workspace has ERP provider “${erpCapability.key}”, but this Averomira version has no native adapter for it. Automatic export is not attempted.`}
            </p>
          </div>
        ) : (
          <div className="mt-5 rounded-xl border border-[var(--line)] bg-[var(--app-paper)] p-5">
            <strong className="block">{fi ? "ERP-vienti ei ole käytössä" : "ERP export is disabled"}</strong>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--muted)]">
              {fi
                ? "ERP-yhteyttä ei vaadita Averomiran muuhun työnkulkuun. Sales Order Draft voidaan silti muodostaa hyväksytystä PO:sta. Averomira ei yritä ERP-vientiä tässä tilassa."
                : "An ERP connection is not required for the rest of Averomira. A Sales Order Draft can still be created from an approved PO. Averomira does not attempt ERP export in this state."}
            </p>
          </div>
        )}
      </section>

      <section id="users" className="surface mt-5 scroll-mt-5 p-6">
        <div className="mb-5">
          <div>
            <div className="upload-v2-section-label">{fi ? "Käyttäjät" : "Users"}</div>
            <h2 className="mt-1 text-xl font-bold tracking-[-.02em]">{fi ? "Työtilan käyttäjät ja roolit" : "Workspace users and roles"}</h2>
            <p className="mt-2 text-sm text-[var(--muted)]">{fi ? "Adminit voivat kutsua käyttäjiä ja hallita käyttöoikeuksia." : "Admins can invite users and manage access."}</p>
          </div>
        </div>

        {canManage ? (
          <form action={inviteWorkspaceMember} className="my-4 grid gap-2 md:grid-cols-[minmax(0,1fr)_150px_auto]">
            <input name="email" type="email" required placeholder={fi ? "käyttäjä@yritys.fi" : "user@company.com"} className="block w-full rounded-[10px] border border-[var(--line)] bg-white px-3 py-2.5 text-sm" />
            <select name="role" defaultValue="member" className="block w-full rounded-[10px] border border-[var(--line)] bg-white px-3 py-2.5 text-sm">
              <option value="member">{fi ? "Jäsen" : "Member"}</option>
              <option value="reviewer">{fi ? "Tarkistaja" : "Reviewer"}</option>
              <option value="admin">Admin</option>
            </select>
            <button className="btn-primary">{fi ? "Kutsu käyttäjä" : "Invite user"}</button>
          </form>
        ) : null}

        <div className="divide-y divide-[var(--line)] border-t border-[var(--line)]">
          {memberRows.map((member: any) => (
            <div key={member.user_id} className="grid min-h-16 gap-3 py-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
              <div>
                <strong>{member.isCurrent ? (fi ? "Sinä" : "You") : member.email || String(member.user_id).slice(0, 8)}</strong>
                <span>{member.email || (fi ? "Käyttäjä" : "User")}</span>
              </div>
              {canManage && !member.isCurrent ? (
                <form action={updateWorkspaceMemberRole}>
                  <input type="hidden" name="userId" value={member.user_id} />
                  <select name="role" defaultValue={member.role} className="rounded-[10px] border border-[var(--line)] bg-white px-3 py-2 text-sm">
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
