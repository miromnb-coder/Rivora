import Link from "next/link";
import { requireSalesAdmin } from "@/lib/rivora/sales";
import { formatLocale, getLocale } from "@/lib/locale";

const statuses = ["all", "new", "contacted", "qualified", "closed"] as const;
const views = ["all", "unread", "due", "upcoming"] as const;

function statusClass(status: string) {
  if (status === "qualified") return "green";
  if (status === "contacted") return "amber";
  if (status === "closed") return "red";
  return "";
}

export default async function LeadsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; view?: string }>;
}) {
  const [{ supabase }, params, locale] = await Promise.all([
    requireSalesAdmin(),
    searchParams,
    getLocale(),
  ]);
  const fi = locale === "fi";
  const displayLocale = formatLocale(locale);
  const t = {
    kicker: fi ? "Liidit" : "Lead inbox",
    title: fi ? "Liidit, jotka vaativat huomiota – ilman uutta taulukkoa." : "Leads that need attention, not another spreadsheet.",
    body: fi ? "Uudet pyynnöt pysyvät lukemattomina tarkistukseen asti. Aikatauluta seuraava toimenpide ja pidä myöhässä olevat seurannat näkyvissä." : "New requests stay unread until reviewed. Schedule the next action and keep overdue follow-ups visible.",
    unread: fi ? "Lukematta" : "Unread", due: fi ? "Erääntyneet seurannat" : "Due follow-ups",
    upcoming: fi ? "Tulossa" : "Upcoming", qualified: fi ? "Kvalifioidut" : "Qualified",
    allActivity: fi ? "Kaikki tapahtumat" : "All activity", allStages: fi ? "Kaikki vaiheet" : "All stages",
    pipeline: fi ? "Liidiputki" : "Lead pipeline",
    pipelineBody: fi ? "Uusimmat ensin · lukematon tila ja seurannat pysyvät näkyvissä" : "Newest first · unread and follow-up state stay visible",
    roleMissing: fi ? "Roolia ei annettu" : "Role not provided", intent: fi ? "Tavoite" : "Intent",
    followUpDue: fi ? "Seuranta erääntynyt" : "Follow-up due", nextFollowUp: fi ? "Seuraava seuranta" : "Next follow-up",
    notScheduled: fi ? "Ei aikataulutettu" : "Not scheduled", open: fi ? "Avaa" : "Open",
    noMatches: fi ? "Tähän näkymään ei löydy liidejä." : "No leads match this view.",
    views: {
      all: fi ? "Kaikki" : "All",
      unread: fi ? "Lukematta" : "Unread",
      due: fi ? "Erääntyneet" : "Due",
      upcoming: fi ? "Tulossa" : "Upcoming",
    } as Record<string,string>,
    statuses: {
      all: fi ? "Kaikki" : "All",
      new: fi ? "Uusi" : "New",
      contacted: fi ? "Kontaktoitu" : "Contacted",
      qualified: fi ? "Kvalifioitu" : "Qualified",
      closed: fi ? "Suljettu" : "Closed",
    } as Record<string,string>,
  };

  const selectedStatus = statuses.includes(params.status as (typeof statuses)[number])
    ? (params.status as (typeof statuses)[number]) : "all";
  const selectedView = views.includes(params.view as (typeof views)[number])
    ? (params.view as (typeof views)[number]) : "all";
  const today = new Date().toISOString().slice(0, 10);

  let query = supabase
    .from("marketing_leads")
    .select("id, created_at, updated_at, name, work_email, company, role, intent, rfq_volume, status, notification_read_at, next_action, follow_up_on")
    .order("created_at", { ascending: false })
    .limit(100);

  if (selectedStatus !== "all") query = query.eq("status", selectedStatus);
  if (selectedView === "unread") query = query.is("notification_read_at", null);
  if (selectedView === "due") query = query.not("follow_up_on", "is", null).lte("follow_up_on", today).neq("status", "closed");
  if (selectedView === "upcoming") query = query.gt("follow_up_on", today).neq("status", "closed");

  const [{ data: leads }, { data: allLeads }] = await Promise.all([
    query,
    supabase.from("marketing_leads").select("id, status, notification_read_at, follow_up_on"),
  ]);

  const counts = {
    all: allLeads?.length ?? 0,
    new: allLeads?.filter((lead) => lead.status === "new").length ?? 0,
    contacted: allLeads?.filter((lead) => lead.status === "contacted").length ?? 0,
    qualified: allLeads?.filter((lead) => lead.status === "qualified").length ?? 0,
    closed: allLeads?.filter((lead) => lead.status === "closed").length ?? 0,
    unread: allLeads?.filter((lead) => !lead.notification_read_at).length ?? 0,
    due: allLeads?.filter((lead) => lead.status !== "closed" && typeof lead.follow_up_on === "string" && lead.follow_up_on <= today).length ?? 0,
    upcoming: allLeads?.filter((lead) => lead.status !== "closed" && typeof lead.follow_up_on === "string" && lead.follow_up_on > today).length ?? 0,
  };

  const formatFollowUp = (date: string | null) =>
    date ? new Date(`${date}T12:00:00Z`).toLocaleDateString(displayLocale) : t.notScheduled;

  return (
    <div className="app-page-v2">
      <header className="nodra-page-head">
        <div><div className="app-kicker-v2">{t.kicker}</div><h1>{t.title}</h1><p>{t.body}</p></div>
      </header>

      <section className="quotes-v1-summary mt-12">
        <Link href="/app/leads?view=unread"><span>{t.unread}</span><strong>{counts.unread}</strong></Link>
        <Link href="/app/leads?view=due"><span>{t.due}</span><strong>{counts.due}</strong></Link>
        <Link href="/app/leads?view=upcoming"><span>{t.upcoming}</span><strong>{counts.upcoming}</strong></Link>
        <Link href="/app/leads?status=qualified"><span>{t.qualified}</span><strong>{counts.qualified}</strong></Link>
      </section>

      <div className="mt-8 flex flex-wrap gap-2">
        {views.map((view) => (
          <Link key={view} href={view === "all" ? "/app/leads" : `/app/leads?view=${view}`}
            className={`nodra-filter-pill ${selectedView === view && selectedStatus === "all" ? "is-active" : ""}`}>
            {view === "all" ? t.allActivity : t.views[view]}{view !== "all" ? <span>{counts[view]}</span> : null}
          </Link>
        ))}
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {statuses.map((status) => (
          <Link key={status} href={status === "all" ? "/app/leads" : `/app/leads?status=${status}`}
            className={`nodra-filter-pill ${selectedStatus === status && selectedView === "all" ? "is-active" : ""}`}>
            {status === "all" ? t.allStages : t.statuses[status]} <span>{counts[status]}</span>
          </Link>
        ))}
      </div>

      <section className="surface nodra-data-surface">
        <div className="nodra-section-head">
          <div><div className="upload-v2-section-label">{t.pipeline}</div><h2>{t.pipelineBody}</h2></div>
        </div>
        {leads?.length ? (
          <div className="nodra-list">
            {leads.map((lead) => {
              const due = lead.status !== "closed" && typeof lead.follow_up_on === "string" && lead.follow_up_on <= today;
              return (
                <Link href={`/app/leads/${lead.id}`} key={lead.id} className="nodra-list-row nodra-lead-row">
                  <div><h3>{lead.name}</h3><p>{lead.work_email}</p></div>
                  <div><strong>{lead.company}</strong><p>{lead.role || t.roleMissing}</p></div>
                  <div><span>{t.intent}</span><strong>{lead.intent}</strong></div>
                  <div><span>{due ? t.followUpDue : t.nextFollowUp}</span><strong>{formatFollowUp(lead.follow_up_on)}</strong>{lead.next_action ? <p>{lead.next_action}</p> : null}</div>
                  <div className={`status ${statusClass(lead.status)}`}>{t.statuses[lead.status] ?? lead.status}</div>
                  <span>{t.open} →</span>
                </Link>
              );
            })}
          </div>
        ) : <div className="nodra-empty"><p>{t.noMatches}</p></div>}
      </section>
    </div>
  );
}
