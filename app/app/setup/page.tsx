import Link from "next/link";
import { requireWorkspace } from "@/lib/rivora/workspace";

export default async function SetupPage() {
  const { supabase, workspace } = await requireWorkspace();

  const [
    { data: organization },
    { count: productCount },
    { count: rfqCount },
    { count: quoteCount },
    { count: customerCount },
  ] = await Promise.all([
    supabase
      .from("organizations")
      .select("name,email,address_line1,city,logo_path,onboarding_completed_at")
      .eq("id", workspace.id)
      .maybeSingle(),
    supabase.from("products").select("id", { count: "exact", head: true }).eq("organization_id", workspace.id).eq("active", true),
    supabase.from("rfqs").select("id", { count: "exact", head: true }).eq("organization_id", workspace.id),
    supabase.from("quotes").select("id", { count: "exact", head: true }).eq("organization_id", workspace.id),
    supabase.from("customers").select("id", { count: "exact", head: true }).eq("organization_id", workspace.id),
  ]);

  const companyReady = Boolean(
    organization?.name &&
    organization?.email &&
    organization?.address_line1 &&
    organization?.city
  );
  const catalogueReady = (productCount ?? 0) > 0;
  const firstRfqReady = (rfqCount ?? 0) > 0;
  const quoteReady = (quoteCount ?? 0) > 0;
  const completeCount = [companyReady, catalogueReady, firstRfqReady, quoteReady].filter(Boolean).length;

  const steps = [
    {
      number: "01",
      title: "Company settings",
      done: companyReady,
      copy: "Add the seller details, logo, default VAT and quote validity used on every new quote.",
      href: "/app/settings",
      cta: companyReady ? "Review settings" : "Complete company settings",
    },
    {
      number: "02",
      title: "Product catalogue",
      done: catalogueReady,
      copy: "Start with your own CSV/XLSX or download Nodra’s sample/template files.",
      href: "/app/upload",
      cta: catalogueReady ? "View catalogue tools" : "Import first catalogue",
    },
    {
      number: "03",
      title: "First RFQ",
      done: firstRfqReady,
      copy: "Process a PDF, CSV or XLSX and review uncertain product matches before quoting.",
      href: "/app/upload#first-rfq",
      cta: firstRfqReady ? "Process another RFQ" : "Process first RFQ",
    },
    {
      number: "04",
      title: "First quote",
      done: quoteReady,
      copy: "Resolve the RFQ, create the quote, approve it and select a customer contact for sending.",
      href: firstRfqReady ? "/app/inbox" : "/app/upload",
      cta: quoteReady ? "Open quotes" : "Continue workflow",
    },
  ];

  return (
    <div className="app-page-v2">
      <header className="mb-8 max-w-4xl">
        <div className="app-kicker-v2">Pilot setup</div>
        <h1 className="mt-2 text-4xl font-extrabold tracking-[-.04em]">
          Get a new workspace from empty to first sent quote.
        </h1>
        <p className="mt-3 text-sm leading-6 text-[var(--muted)]">
          Nodra keeps the pilot path explicit: company identity → catalogue → RFQ → reviewed quote.
        </p>
      </header>

      <section className="surface mb-6 p-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="upload-v2-section-label">Pilot readiness</div>
            <strong className="mt-2 block text-3xl">{completeCount}/4 core steps complete</strong>
            <p className="mt-2 text-sm text-[var(--muted)]">
              {customerCount ?? 0} customers · {productCount ?? 0} products · {rfqCount ?? 0} RFQs · {quoteCount ?? 0} quotes
            </p>
          </div>
          {completeCount === 4 ? (
            <span className="rounded-full bg-[var(--green-soft)] px-4 py-2 text-sm font-bold text-[var(--green)]">
              Pilot workflow ready
            </span>
          ) : (
            <span className="rounded-full bg-black/[.05] px-4 py-2 text-sm font-bold">
              Setup in progress
            </span>
          )}
        </div>
      </section>

      <section className="grid gap-4">
        {steps.map((step) => (
          <article key={step.number} className="surface grid gap-4 p-6 md:grid-cols-[70px_1fr_auto] md:items-center">
            <div className="text-sm font-bold text-[var(--muted)]">{step.number}</div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-xl font-bold">{step.title}</h2>
                <span className={step.done ? "rounded-full bg-[var(--green-soft)] px-2 py-1 text-xs font-bold text-[var(--green)]" : "rounded-full bg-black/[.05] px-2 py-1 text-xs font-bold"}>
                  {step.done ? "Done" : "Next"}
                </span>
              </div>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--muted)]">{step.copy}</p>
            </div>
            <Link href={step.href} className={step.done ? "btn-secondary" : "btn-primary"}>
              {step.cta} →
            </Link>
          </article>
        ))}
      </section>

      <section className="surface mt-6 p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="upload-v2-section-label">Production monitoring</div>
            <h3 className="mt-2 text-xl font-bold">Application error monitoring is active.</h3>
            <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
              Unexpected app errors are recorded for the workspace and also written to production runtime logs for investigation.
            </p>
          </div>
          <span className="rounded-full bg-[var(--green-soft)] px-4 py-2 text-sm font-bold text-[var(--green)]">
            Active
          </span>
        </div>
      </section>

      <section className="mt-6 grid gap-4 md:grid-cols-2">
        <a href="/app/templates/catalogue" className="surface p-6">
          <div className="upload-v2-section-label">CSV template</div>
          <h3 className="mt-2 text-xl font-bold">Blank catalogue template ↓</h3>
          <p className="mt-2 text-sm text-[var(--muted)]">Correct headers, ready for your own products.</p>
        </a>
        <a href="/app/templates/sample-catalogue" className="surface p-6">
          <div className="upload-v2-section-label">Sample data</div>
          <h3 className="mt-2 text-xl font-bold">Sample catalogue ↓</h3>
          <p className="mt-2 text-sm text-[var(--muted)]">A small safe dataset for testing the first RFQ flow.</p>
        </a>
      </section>
    </div>
  );
}
