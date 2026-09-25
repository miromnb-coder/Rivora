import Link from "next/link";
import { requireWorkspace } from "@/lib/rivora/workspace";
import { getLocale } from "@/lib/locale";
import { getSetupCopy } from "@/lib/i18n/extra";

export default async function SetupPage() {
  const [{ supabase, workspace }, locale] = await Promise.all([requireWorkspace(), getLocale()]);
  const copy = getSetupCopy(locale);

  const [
    { data: organization },
    { count: productCount },
    { count: rfqCount },
    { count: quoteCount },
    { count: customerCount },
  ] = await Promise.all([
    supabase.from("organizations").select("name,email,address_line1,city,logo_path,onboarding_completed_at").eq("id", workspace.id).maybeSingle(),
    supabase.from("products").select("id", { count: "exact", head: true }).eq("organization_id", workspace.id).eq("active", true),
    supabase.from("rfqs").select("id", { count: "exact", head: true }).eq("organization_id", workspace.id),
    supabase.from("quotes").select("id", { count: "exact", head: true }).eq("organization_id", workspace.id),
    supabase.from("customers").select("id", { count: "exact", head: true }).eq("organization_id", workspace.id),
  ]);

  const companyReady = Boolean(organization?.name && organization?.email && organization?.address_line1 && organization?.city);
  const catalogueReady = (productCount ?? 0) > 0;
  const firstRfqReady = (rfqCount ?? 0) > 0;
  const quoteReady = (quoteCount ?? 0) > 0;
  const completeCount = [companyReady, catalogueReady, firstRfqReady, quoteReady].filter(Boolean).length;
  const readiness = [companyReady, catalogueReady, firstRfqReady, quoteReady];
  const hrefs = ["/app/settings", "/app/upload", "/app/upload#first-rfq", firstRfqReady ? "/app/inbox" : "/app/upload"];

  return (
    <div className="app-page-v2">
      <header className="nodra-page-head">
        <div>
          <div className="app-kicker-v2">{copy.kicker}</div>
          <h1>{copy.title}</h1>
          <p>{copy.description}</p>
        </div>
      </header>

      <section className="surface nodra-section">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="upload-v2-section-label">{copy.readiness}</div>
            <strong className="mt-2 block text-3xl">{completeCount}/4 {copy.coreSteps}</strong>
            <p className="mt-2 text-sm text-[var(--muted)]">
              {customerCount ?? 0} {copy.customers} · {productCount ?? 0} {copy.products} · {rfqCount ?? 0} {copy.rfqs} · {quoteCount ?? 0} {copy.quotes}
            </p>
          </div>
          <span className="nodra-pill">{completeCount === 4 ? copy.ready : copy.progress}</span>
        </div>
      </section>

      <section className="mt-4 grid gap-4">
        {copy.steps.map((step, index) => {
          const done = readiness[index];
          return (
            <article key={index} className="surface grid gap-4 p-6 md:grid-cols-[70px_1fr_auto] md:items-center">
              <div className="text-sm font-bold text-[var(--muted)]">{String(index + 1).padStart(2, "0")}</div>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-xl font-bold">{step[0]}</h2>
                  <span className="nodra-pill">{done ? copy.done : copy.next}</span>
                </div>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--muted)]">{step[1]}</p>
              </div>
              <Link href={hrefs[index]} className={done ? "btn-secondary" : "btn-primary"}>
                {done ? step[2] : step[3]} →
              </Link>
            </article>
          );
        })}
      </section>

      <section className="surface mt-6 p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="upload-v2-section-label">{copy.monitoring}</div>
            <h3 className="mt-2 text-xl font-bold">{copy.monitoringTitle}</h3>
            <p className="mt-2 text-sm leading-6 text-[var(--muted)]">{copy.monitoringBody}</p>
          </div>
          <span className="nodra-pill">{copy.active}</span>
        </div>
      </section>

      <section className="mt-6 grid gap-4 md:grid-cols-2">
        <a href="/app/templates/catalogue" className="surface p-6 transition hover:bg-black/[.015]">
          <div className="upload-v2-section-label">{copy.csv}</div>
          <h3 className="mt-2 text-xl font-bold">{copy.blank}</h3>
          <p className="mt-2 text-sm text-[var(--muted)]">{copy.blankBody}</p>
        </a>
        <a href="/app/templates/sample-catalogue" className="surface p-6 transition hover:bg-black/[.015]">
          <div className="upload-v2-section-label">{copy.sample}</div>
          <h3 className="mt-2 text-xl font-bold">{copy.sampleTitle}</h3>
          <p className="mt-2 text-sm text-[var(--muted)]">{copy.sampleBody}</p>
        </a>
      </section>
    </div>
  );
}
