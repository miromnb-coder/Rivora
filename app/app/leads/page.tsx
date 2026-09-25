import Link from "next/link";
import { requireSalesAdmin } from "@/lib/rivora/sales";

const statuses = ["all", "new", "contacted", "qualified", "closed"] as const;
const views = ["all", "unread", "due", "upcoming"] as const;

function statusClass(status: string) {
  if (status === "qualified") return "green";
  if (status === "contacted") return "amber";
  if (status === "closed") return "red";
  return "";
}

function formatFollowUp(date: string | null) {
  if (!date) return "Not scheduled";
  return new Date(`${date}T12:00:00Z`).toLocaleDateString("fi-FI");
}

export default async function LeadsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; view?: string }>;
}) {
  const { supabase } = await requireSalesAdmin();
  const params = await searchParams;
  const selectedStatus = statuses.includes(params.status as (typeof statuses)[number])
    ? (params.status as (typeof statuses)[number])
    : "all";
  const selectedView = views.includes(params.view as (typeof views)[number])
    ? (params.view as (typeof views)[number])
    : "all";
  const today = new Date().toISOString().slice(0, 10);

  let query = supabase
    .from("marketing_leads")
    .select("id, created_at, updated_at, name, work_email, company, role, intent, rfq_volume, status, notification_read_at, next_action, follow_up_on")
    .order("created_at", { ascending: false })
    .limit(100);

  if (selectedStatus !== "all") query = query.eq("status", selectedStatus);
  if (selectedView === "unread") query = query.is("notification_read_at", null);
  if (selectedView === "due") {
    query = query.not("follow_up_on", "is", null).lte("follow_up_on", today).neq("status", "closed");
  }
  if (selectedView === "upcoming") {
    query = query.gt("follow_up_on", today).neq("status", "closed");
  }

  const { data: leads } = await query;

  const { data: allLeads } = await supabase
    .from("marketing_leads")
    .select("id, status, notification_read_at, follow_up_on");

  const counts = {
    all: allLeads?.length ?? 0,
    new: allLeads?.filter((lead) => lead.status === "new").length ?? 0,
    contacted: allLeads?.filter((lead) => lead.status === "contacted").length ?? 0,
    qualified: allLeads?.filter((lead) => lead.status === "qualified").length ?? 0,
    closed: allLeads?.filter((lead) => lead.status === "closed").length ?? 0,
    unread: allLeads?.filter((lead) => !lead.notification_read_at).length ?? 0,
    due:
      allLeads?.filter(
        (lead) =>
          lead.status !== "closed" &&
          typeof lead.follow_up_on === "string" &&
          lead.follow_up_on <= today
      ).length ?? 0,
    upcoming:
      allLeads?.filter(
        (lead) =>
          lead.status !== "closed" &&
          typeof lead.follow_up_on === "string" &&
          lead.follow_up_on > today
      ).length ?? 0,
  };

  return (
    <div className="mx-auto max-w-6xl px-5 py-8 sm:px-8 lg:px-10 lg:py-10">
      <div>
        <div className="kicker">Lead inbox</div>
        <h1 className="mt-2 text-3xl font-extrabold tracking-[-.035em]">
          Leads that need attention, not another spreadsheet.
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--muted)]">
          New requests stay unread until reviewed. Schedule the next action and keep overdue follow-ups visible.
        </p>
      </div>

      <div className="mt-8 grid gap-3 sm:grid-cols-4">
        <Link href="/app/leads?view=unread" className="surface p-5 transition hover:bg-[#fafbfa]">
          <div className="text-xs font-bold uppercase tracking-wider text-[var(--muted)]">Unread</div>
          <div className="mt-2 text-3xl font-extrabold">{counts.unread}</div>
        </Link>
        <Link href="/app/leads?view=due" className="surface p-5 transition hover:bg-[#fafbfa]">
          <div className="text-xs font-bold uppercase tracking-wider text-[var(--muted)]">Due follow-ups</div>
          <div className="mt-2 text-3xl font-extrabold">{counts.due}</div>
        </Link>
        <Link href="/app/leads?view=upcoming" className="surface p-5 transition hover:bg-[#fafbfa]">
          <div className="text-xs font-bold uppercase tracking-wider text-[var(--muted)]">Upcoming</div>
          <div className="mt-2 text-3xl font-extrabold">{counts.upcoming}</div>
        </Link>
        <Link href="/app/leads?status=qualified" className="surface p-5 transition hover:bg-[#fafbfa]">
          <div className="text-xs font-bold uppercase tracking-wider text-[var(--muted)]">Qualified</div>
          <div className="mt-2 text-3xl font-extrabold">{counts.qualified}</div>
        </Link>
      </div>

      <div className="mt-6 flex flex-wrap gap-2">
        {views.map((view) => (
          <Link
            key={view}
            href={view === "all" ? "/app/leads" : `/app/leads?view=${view}`}
            className={`rounded-full border px-3 py-2 text-xs font-bold transition ${
              selectedView === view && selectedStatus === "all"
                ? "border-[#10251b] bg-[#10251b] text-white"
                : "border-[var(--line)] bg-white text-[var(--muted)] hover:text-[var(--ink)]"
            }`}
          >
            {view === "all" ? "All activity" : view[0].toUpperCase() + view.slice(1)}
            {view !== "all" ? <span className="ml-1.5 opacity-60">{counts[view]}</span> : null}
          </Link>
        ))}
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {statuses.map((status) => (
          <Link
            key={status}
            href={status === "all" ? "/app/leads" : `/app/leads?status=${status}`}
            className={`rounded-full border px-3 py-2 text-xs font-bold transition ${
              selectedStatus === status && selectedView === "all"
                ? "border-[#10251b] bg-[#10251b] text-white"
                : "border-[var(--line)] bg-white text-[var(--muted)] hover:text-[var(--ink)]"
            }`}
          >
            {status === "all" ? "All stages" : status[0].toUpperCase() + status.slice(1)}
            <span className="ml-1.5 opacity-60">{counts[status]}</span>
          </Link>
        ))}
      </div>

      <div className="surface mt-4 overflow-hidden">
        <div className="border-b border-[var(--line)] px-5 py-4">
          <div className="font-bold">Lead pipeline</div>
          <div className="mt-1 text-xs text-[var(--muted)]">
            Newest first · unread and follow-up state stay visible
          </div>
        </div>

        {leads?.length ? (
          <div className="divide-y divide-[var(--line)]">
            {leads.map((lead) => {
              const due =
                lead.status !== "closed" &&
                typeof lead.follow_up_on === "string" &&
                lead.follow_up_on <= today;

              return (
                <Link
                  href={`/app/leads/${lead.id}`}
                  key={lead.id}
                  className="grid gap-3 px-5 py-4 transition hover:bg-[#fafbfa] md:grid-cols-[1.15fr_1.15fr_.55fr_1.1fr_.55fr] md:items-center"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      {!lead.notification_read_at ? (
                        <span className="h-2 w-2 rounded-full bg-[#d49b53]" aria-label="Unread lead" />
                      ) : null}
                      <div className="text-sm font-bold">{lead.name}</div>
                    </div>
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
                    <div className="text-xs font-bold uppercase tracking-wider text-[var(--muted)]">
                      {due ? "Follow-up due" : "Next follow-up"}
                    </div>
                    <div className={`mt-1 text-sm font-bold ${due ? "text-[#8a5b27]" : ""}`}>
                      {formatFollowUp(lead.follow_up_on)}
                    </div>
                    {lead.next_action ? (
                      <div className="mt-1 truncate text-xs text-[var(--muted)]">{lead.next_action}</div>
                    ) : null}
                  </div>

                  <div className="flex items-center justify-between gap-3 md:justify-end">
                    <span className={`status w-fit ${statusClass(lead.status)}`}>{lead.status}</span>
                    <span className="text-sm font-bold text-[var(--green)]">Open →</span>
                  </div>
                </Link>
              );
            })}
          </div>
        ) : (
          <div className="px-5 py-12 text-center text-sm text-[var(--muted)]">
            No leads match this view.
          </div>
        )}
      </div>
    </div>
  );
}
