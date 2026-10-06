import Link from "next/link";
import { redirect } from "next/navigation";
import { getLocale } from "@/lib/locale";
import { requireWorkspace } from "@/lib/rivora/workspace";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  getErpAdapter,
  getErpProviderCapability,
} from "@/lib/rivora/erp";

function statusClass(ok: boolean) {
  return ok ? "settings-status is-ready" : "settings-status is-warning";
}

export default async function OperationsSettingsPage() {
  const [context, locale] = await Promise.all([
    requireWorkspace(),
    getLocale(),
  ]);
  const { workspace } = context;
  const fi = locale === "fi";

  if (!["owner", "admin"].includes(workspace.role)) {
    redirect("/app/settings");
  }

  const admin = createAdminClient();
  const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const staleCutoff = new Date(Date.now() - 10 * 60 * 1000).toISOString();

  const [
    staleErpResult,
    erpAttentionResult,
    appErrorsResult,
    emailFailuresResult,
  ] = await Promise.all([
    admin
      .from("erp_delivery_attempts")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", workspace.id)
      .eq("status", "pending")
      .lt("created_at", staleCutoff),
    admin
      .from("erp_delivery_attempts")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", workspace.id)
      .in("status", ["failed", "partial", "existing"])
      .gte("created_at", since24h),
    admin
      .from("app_error_events")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", workspace.id)
      .gte("created_at", since24h),
    admin
      .from("quote_email_attempts")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", workspace.id)
      .in("status", ["failed", "bounced", "complained"])
      .gte("created_at", since24h),
  ]);

  const queryError =
    staleErpResult.error ||
    erpAttentionResult.error ||
    appErrorsResult.error ||
    emailFailuresResult.error;

  if (queryError) {
    throw new Error(`Operational readiness query failed: ${queryError.message}`);
  }

  const capability = getErpProviderCapability(workspace.erpProvider);
  const adapter = getErpAdapter(workspace.erpProvider);
  const erpConfig = adapter
    ? await adapter.getConfigurationStatus(workspace.id)
    : null;

  const emailConfigured = Boolean(process.env.RESEND_API_KEY?.trim());
  const extractionConfigured = Boolean(process.env.OPENAI_API_KEY?.trim());
  const erpReady =
    capability.availability === "disabled" ||
    capability.availability === "unsupported" ||
    Boolean(erpConfig?.configured);

  const staleErp = staleErpResult.count ?? 0;
  const erpAttention = erpAttentionResult.count ?? 0;
  const appErrors = appErrorsResult.count ?? 0;
  const emailFailures = emailFailuresResult.count ?? 0;

  const runtimeReady =
    emailConfigured &&
    extractionConfigured &&
    erpReady &&
    staleErp === 0;

  const checks = [
    {
      label: fi ? "Tietokanta" : "Database",
      ok: true,
      detail: fi
        ? "Supabase-yhteys ja workspace-rajattu operatiivinen kysely toimivat."
        : "Supabase connection and workspace-scoped operational queries are working.",
    },
    {
      label: fi ? "RFQ/PDF-poiminta" : "RFQ/PDF extraction",
      ok: extractionConfigured,
      detail: extractionConfigured
        ? (fi ? "OpenAI-palvelinavain on konfiguroitu." : "OpenAI server key is configured.")
        : (fi ? "OPENAI_API_KEY puuttuu." : "OPENAI_API_KEY is missing."),
    },
    {
      label: fi ? "Sähköpostin lähetys" : "Email delivery",
      ok: emailConfigured,
      detail: emailConfigured
        ? (fi ? "Resend-palvelinavain on konfiguroitu; lähettäjällä on Averomiran turvallinen oletus." : "Resend server key is configured; the sender has Averomira's safe default.")
        : (fi ? "RESEND_API_KEY puuttuu." : "RESEND_API_KEY is missing."),
    },
    {
      label: fi ? "ERP-valmius" : "ERP readiness",
      ok: erpReady,
      detail:
        capability.availability === "native"
          ? erpConfig?.configured
            ? (fi
                ? `${capability.label} on tarkistettu tälle työtilalle.`
                : `${capability.label} is verified for this workspace.`)
            : (fi
                ? `${capability.label} vaatii tarkistetun workspace-yhteyden.`
                : `${capability.label} requires a verified workspace connection.`)
          : capability.availability === "unsupported"
            ? (fi
                ? "Muu ERP on tarkoituksella ilman automaattista vientiä."
                : "Other ERP intentionally has no automatic export.")
            : (fi
                ? "ERP-vienti ei ole käytössä tässä työtilassa."
                : "ERP export is disabled for this workspace."),
    },
    {
      label: fi ? "Jumiutuneet ERP-viennit" : "Stale ERP exports",
      ok: staleErp === 0,
      detail: staleErp === 0
        ? (fi ? "Ei yli 10 minuuttia pending-tilassa olevia vientiyrityksiä." : "No ERP attempts have been pending for more than 10 minutes.")
        : (fi ? `${staleErp} vientiyritystä vaatii välittömän tarkistuksen.` : `${staleErp} ERP attempt(s) require immediate review.`),
    },
  ];

  return (
    <div className="app-page-v2">
      <div className="mb-5">
        <Link href="/app/settings" className="text-sm font-semibold">
          ← {fi ? "Asetukset" : "Settings"}
        </Link>
      </div>

      <header className="mb-7">
        <div className="app-kicker-v2">
          {fi ? "Production readiness" : "Production readiness"}
        </div>
        <h1 className="mt-2 max-w-4xl text-4xl font-bold tracking-tight">
          {fi ? "Operatiivinen tila" : "Operational status"}
        </h1>
        <p className="mt-3 max-w-3xl text-[var(--muted)]">
          {fi
            ? "Turvalliset tuotantotarkistukset ilman salaisuuksien näyttämistä. Tämä sivu ei tee ERP-write-operaatioita."
            : "Safe production checks without exposing secrets. This page never performs ERP write operations."}
        </p>
      </header>

      <section className="surface p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="upload-v2-section-label">
              {fi ? "Nykyinen tila" : "Current state"}
            </div>
            <h2 className="mt-2 text-2xl font-bold">
              {runtimeReady
                ? (fi ? "Perusvalmius kunnossa" : "Core readiness healthy")
                : (fi ? "Vaatii toimenpiteitä" : "Action required")}
            </h2>
          </div>
          <span className={statusClass(runtimeReady)}>
            {runtimeReady ? "READY" : "CHECK"}
          </span>
        </div>

        <div className="mt-6 divide-y divide-[var(--line)] border-y border-[var(--line)]">
          {checks.map((check) => (
            <div
              key={check.label}
              className="grid gap-2 py-4 sm:grid-cols-[220px_120px_1fr] sm:items-center"
            >
              <strong>{check.label}</strong>
              <span className={statusClass(check.ok)}>
                {check.ok ? "OK" : (fi ? "Tarkista" : "Check")}
              </span>
              <span className="text-sm text-[var(--muted)]">
                {check.detail}
              </span>
            </div>
          ))}
        </div>
      </section>

      <section className="surface mt-6 p-6">
        <div className="upload-v2-section-label">
          {fi ? "Viimeiset 24 tuntia" : "Last 24 hours"}
        </div>
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          <div className="rounded-xl border border-[var(--line)] p-4">
            <span className="text-xs text-[var(--muted)]">
              {fi ? "ERP huomiot" : "ERP attention"}
            </span>
            <strong className="mt-2 block text-2xl">{erpAttention}</strong>
          </div>
          <div className="rounded-xl border border-[var(--line)] p-4">
            <span className="text-xs text-[var(--muted)]">
              {fi ? "Sovellusvirheet" : "App errors"}
            </span>
            <strong className="mt-2 block text-2xl">{appErrors}</strong>
          </div>
          <div className="rounded-xl border border-[var(--line)] p-4">
            <span className="text-xs text-[var(--muted)]">
              {fi ? "Sähköpostivirheet" : "Email failures"}
            </span>
            <strong className="mt-2 block text-2xl">{emailFailures}</strong>
          </div>
        </div>
        <p className="mt-4 text-xs leading-5 text-[var(--muted)]">
          {fi
            ? "ERP-huomiot sisältävät failed-, partial- ja existing-tilat. Existing ei tarkoita datan menetystä: se tarkoittaa, että duplikaatin esto löysi ERP:stä jo olemassa olevan tilauksen."
            : "ERP attention includes failed, partial and existing results. Existing does not mean data loss; it means duplicate prevention found an order already present in the ERP."}
        </p>
      </section>
    </div>
  );
}
