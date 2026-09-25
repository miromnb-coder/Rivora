import Link from "next/link";
import { requireSalesAdmin } from "@/lib/rivora/sales";

const statuses = ["all", "new", "contacted", "qualified", "closed"] as const;

function statusClass(status: string) {
  if (status === "qualified") return "green";
  if (status === "contacted") return "amber";
  if (status === "closed") return "red";
  return "";
}

export default async function LeadsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { supabase } = await requireSalesAdmin();
  const params = await searchParams;
  const selected = statuses.includes(params.status as (typeof statuses)[number])
    ? (params.status as (typeof statuses)[number])
    : "all";

  let query = supabase
    .from("marketing_leads")
    .select("id, created_at, updated_at, name, work_email, company, role, intent, rfq_volume, status")
    .order("created_at", { ascending: false })
    .limit(100);

  if (selected !== "all") query = query.eq("status", selected);

  const { data: leads } = await query;

  const { data: allLeads } = await supabase
    .from("marketing_leads")
    .select("id, status");

  const counts = {
    all: allLeads?.length ?? 0,
    new: allLeads?.filter((lead) => lead.status === "new").length ?? 0,
    contacted: allLeads?.filter((lead) => lead.status === "contacted").length ?? 0,
    qualified: allLeads?.filter((lead) => lead.status === "qualified").length ?? 0,
    closed: allLeads?.filter((lead) => lead.status === "closed").length ?? 0,
  };

  return (
    <div className="mx-auto max-w-6xl px-5 py-8 sm:px-8 lg:px-10 lg:py-10">
      <div>
        <div className="kicker">Lead inbox</div>
        <h1 className="mt-2 text-3xl font-extrabold tracking-[-.035em]">
          Pricing, pilot and demo requests.
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--muted)]">
          Lightweight CRM for marketing leads. Lead access is restricted to workspace owners and admins.
        </p>
      </div>

      <div className="mt-8 grid gap-3 sm:grid-cols-4">
        <div className="surface p-5">
          <div className="text-xs font-bold uppercase tracking-wider text-[var(--muted)]">New</div>
          <div className="mt-2 text-3xl font-extrabold">{counts.new}</div>
        </div>
        <div className="surface p-5">
          <div className="text-xs font-bold uppercase tracking-wider text-[var(--muted)]">Contacted</div>
          <div className="mt-2 text-3xl font-extrabold">{counts.contacted}</div>
        </div>
        <div className="surface p-5">
          <div className="text-xs font-bold uppercase tracking-wider text-[var(--muted)]">Qualified</div>
          <div className="mt-2 text-3xl font-extrabold">{counts.qualified}</div>
        </div>
        <div className="surface p-5">
          <div className="text-xs font-bold uppercase tracking-wider text-[var(--muted)]">Closed</div>
          <div className="mt-2 text-3xl font-extrabold">{counts.closed}</div>
        </div>
      </div>

      <div className="mt-6 flex flex-wrap gap-2">
        {statuses.map((status) => (
          <Link
            key={status}
            href={status === "all" ? "/app/leads" : `/app/leads?status=${status}`}
            className={`rounded-full border px-3 py-2 text-xs font-bold transition ${
              selected === status
                ? "border-[#10251b] bg-[#10251b] text-white"
                : "border-[var(--line)] bg-white text-[var(--muted)] hover:text-[var(--ink)]"
            }`}
          >
            {status === "all" ? "All" : status[0].toUpperCase() + status.slice(1)}
            <span className="ml-1.5 opacity-60">{counts[status]}</span>
          </Link>
        ))}
      </div>

      <div className="surface mt-4 overflow-hidden">
        <div className="border-b border-[var(--line)] px-5 py-4">
          <div className="font-bold">Lead pipeline</div>
          <div className="mt-1 text-xs text-[var(--muted)]">
            Newest first · up to 100 leads
          </div>
        </div>

        {leads?.length ? (
          <div className="divide-y divide-[var(--line)]">
            {leads.map((lead) => (
              <Link
                href={`/app/leads/${lead.id}`}
                key={lead.id}
                className="grid gap-3 px-5 py-4 transition hover:bg-[#fafbfa] md:grid-cols-[1.4fr_1.3fr_.7fr_.7fr_.55fr] md:items-center"
              >
                <div>
                  <div className="text-sm font-bold">{lead.name}</div>
                  <div className="mt-1 text-xs text-[var(--muted)]">{lead.work_email}</div>
                </div>
                <div>
                  <div className="text-sm font-semibold">{lead.company}</div>
                  <div className="mt-1 text-xs text-[var(--muted)]">
                    {lead.role || "Role not provided"}
                  </div>
                </div>
                <div>
                  <div className="text-xs font-bold uppercase tracking-wider text-[var(--muted)]">Intent</div>
                  <div className="mt-1 text-sm font-bold capitalize">{lead.intent}</div>
                </div>
                <div>
                  <div className="text-xs font-bold uppercase tracking-wider text-[var(--muted)]">RFQs / mo</div>
                  <div className="mt-1 text-sm font-bold">{lead.rfq_volume || "—"}</div>
                </div>
                <div className="flex items-center justify-between gap-3 md:justify-end">
                  <span className={`status w-fit ${statusClass(lead.status)}`}>{lead.status}</span>
                  <span className="text-sm font-bold text-[var(--green)]">Open →</span>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="px-5 py-12 text-center text-sm text-[var(--muted)]">
            No leads in this stage yet.
          </div>
        )}
      </div>
    </div>
  );
}
