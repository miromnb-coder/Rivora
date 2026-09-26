import Link from "next/link";
import { notFound } from "next/navigation";
import { requireSalesAdmin } from "@/lib/rivora/sales";
import { formatLocale, getLocale } from "@/lib/locale";
import {
  approvePilotAccess, completeLeadFollowUp, markLeadRead, updateLeadFollowUp, updateLeadNote, updateLeadStatus,
} from "../actions";

function statusClass(status: string) {
  if (status === "qualified") return "green";
  if (status === "contacted") return "amber";
  if (status === "closed") return "red";
  return "";
}

export default async function LeadDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const [{ id }, { supabase }, locale] = await Promise.all([params, requireSalesAdmin(), getLocale()]);
  const fi = locale === "fi";
  const displayLocale = formatLocale(locale);
  const t = {
    back: fi ? "Liidit" : "Lead inbox", lead: fi ? "liidi" : "lead", unread: fi ? "Lukematta" : "Unread",
    newNotice: fi ? "Uusi liidi" : "New lead notification",
    newNoticeBody: fi ? "Tämä pyyntö lasketaan vielä lukemattomiin liidihälytyksiin." : "This request is still counted in your unread lead alerts.",
    markRead: fi ? "Merkitse luetuksi" : "Mark as read", context: fi ? "Liidin tiedot" : "Lead context",
    company: fi ? "Yritys" : "Company", role: fi ? "Rooli" : "Role", notProvided: fi ? "Ei annettu" : "Not provided",
    workEmail: fi ? "Työsähköposti" : "Work email", rfqsMonth: fi ? "Tarjouspyyntöjä / kk" : "RFQs / month",
    intent: fi ? "Tavoite" : "Intent", source: fi ? "Lähde" : "Source",
    improve: fi ? "Mitä he haluavat parantaa" : "What they want to improve", noMessage: fi ? "Ei viestiä." : "No message provided.",
    internal: fi ? "Sisäinen muistiinpano" : "Internal note", notePlaceholder: fi ? "Lisää konteksti, vastaväitteet, kvalifiointihuomiot tai tapaamismuistiinpanot…" : "Add context, objections, qualification notes, or meeting notes…",
    saveNote: fi ? "Tallenna muistiinpano" : "Save note", nextAction: fi ? "Seuraava toimenpide" : "Next action",
    nextBody: fi ? "Aikatauluta yksi konkreettinen seuranta, jotta se pysyy näkyvissä liidinäkymässä." : "Schedule one concrete follow-up so it stays visible in the inbox.",
    due: fi ? "Erääntynyt" : "Due", scheduled: fi ? "Aikataulutettu" : "Scheduled",
    followUpLead: fi ? "Ota yhteyttä liidiin" : "Follow up with lead", actionPlaceholder: fi ? "Lähetä pilotin sisältö, soita ostajalle, jaa hinnoittelu…" : "Send pilot scope, call buyer, share pricing…",
    followDate: fi ? "Seurantapäivä" : "Follow-up date", saveAction: fi ? "Tallenna seuraava toimenpide" : "Save next action",
    complete: fi ? "Merkitse seuranta valmiiksi" : "Complete follow-up", stage: fi ? "Myyntivaihe" : "Pipeline stage",
    stageBody: fi ? "Siirrä liidiä eteenpäin keskustelun edetessä." : "Move the lead as the conversation progresses.",
    updateStage: fi ? "Päivitä vaihe" : "Update stage", created: fi ? "Luotu" : "Created",
    lastUpdate: fi ? "Viimeisin CRM-päivitys" : "Last CRM update", lastFollowUp: fi ? "Viimeisin seuranta valmis" : "Last follow-up completed",
    emailLead: fi ? "Lähetä sähköpostia" : "Email lead",
    statuses: { new: fi ? "Uusi" : "New", contacted: fi ? "Kontaktoitu" : "Contacted", qualified: fi ? "Kvalifioitu" : "Qualified", closed: fi ? "Suljettu" : "Closed" } as Record<string,string>,
  };

  const { data: lead } = await supabase.from("marketing_leads").select("*").eq("id", id).maybeSingle();
  if (!lead) notFound();

  const { data: pilotInvite } = await supabase
    .from("pilot_access_invites")
    .select("id, approved_at, invite_sent_at, invite_error, accepted_at")
    .eq("email", String(lead.work_email).trim().toLowerCase())
    .is("revoked_at", null)
    .maybeSingle();

  const today = new Date().toISOString().slice(0, 10);
  const followUpDue = lead.status !== "closed" && typeof lead.follow_up_on === "string" && lead.follow_up_on <= today;
  const formatDate = (date: string | null) => date ? new Date(`${date}T12:00:00Z`).toLocaleDateString(displayLocale) : null;

  return (
    <div className="app-page-v2">
      <Link href="/app/leads" className="rfq-review-v2-back">← {t.back}</Link>

      <header className="nodra-page-head mt-6">
        <div>
          <div className="app-kicker-v2">{String(lead.intent).toUpperCase()} {t.lead}</div>
          <h1>{lead.name}</h1><p>{lead.company} · {lead.work_email}</p>
        </div>
        <span className={`status ${statusClass(lead.status)}`}>{t.statuses[lead.status] ?? lead.status}</span>
      </header>

      {!lead.notification_read_at ? (
        <form action={markLeadRead} className="nodra-alert mt-6 flex flex-wrap items-center justify-between gap-4">
          <input type="hidden" name="id" value={lead.id} />
          <div><strong>{t.newNotice}</strong><p className="mt-1">{t.newNoticeBody}</p></div>
          <button className="btn-secondary">{t.markRead}</button>
        </form>
      ) : null}

      <div className="mt-8 grid gap-5 lg:grid-cols-[1fr_340px]">
        <div className="space-y-5">
          <section className="surface overflow-hidden">
            <div className="nodra-section-head"><h2>{t.context}</h2></div>
            <dl className="grid sm:grid-cols-2">
              {[
                [t.company, lead.company], [t.role, lead.role || t.notProvided], [t.workEmail, lead.work_email],
                [t.rfqsMonth, lead.rfq_volume || t.notProvided], [t.intent, lead.intent], [t.source, lead.source],
              ].map(([label, value]) => (
                <div key={label} className="border-b border-[var(--line)] px-5 py-4 sm:odd:border-r">
                  <dt className="nodra-field-label">{label}</dt><dd className="mt-1.5 text-sm font-semibold">{value}</dd>
                </div>
              ))}
            </dl>
          </section>

          <section className="surface p-5"><div className="font-bold">{t.improve}</div><p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-[var(--muted)]">{lead.message || t.noMessage}</p></section>

          <section className="surface p-5">
            <div className="font-bold">{t.internal}</div>
            <form action={updateLeadNote} className="mt-4">
              <input type="hidden" name="id" value={lead.id} />
              <textarea name="internal_note" defaultValue={lead.internal_note || ""} maxLength={5000} rows={7} className="nodra-input min-h-40 py-3" placeholder={t.notePlaceholder} />
              <button className="btn-primary mt-3">{t.saveNote}</button>
            </form>
          </section>
        </div>

        <aside className="space-y-5">
          <section className="surface p-5">
            <div className="upload-v2-section-label">{fi ? "Pilotin pääsy" : "Pilot access"}</div>
            <h2 className="mt-2 text-lg font-bold">
              {pilotInvite?.accepted_at
                ? (fi ? "Kutsu hyväksytty" : "Invitation accepted")
                : pilotInvite?.invite_sent_at
                  ? (fi ? "Kutsu lähetetty" : "Invitation sent")
                  : pilotInvite
                    ? (fi ? "Hyväksytty, lähetys vaatii huomiota" : "Approved, delivery needs attention")
                    : (fi ? "Ei vielä hyväksytty" : "Not approved yet")}
            </h2>

            {pilotInvite?.invite_sent_at ? (
              <p className="mt-2 text-xs leading-5 text-[var(--muted)]">
                {fi ? "Lähetetty" : "Sent"} {new Date(pilotInvite.invite_sent_at).toLocaleString(displayLocale)}
              </p>
            ) : null}

            {pilotInvite?.accepted_at ? (
              <p className="mt-2 text-xs leading-5 text-[var(--muted)]">
                {fi ? "Asiakas on vahvistanut kutsun ja saanut oikeuden luoda työtilan." : "The customer has confirmed the invitation and can create the workspace."}
              </p>
            ) : null}

            {pilotInvite?.invite_error ? (
              <div className="nodra-alert nodra-alert-error mt-3">
                {pilotInvite.invite_error}
              </div>
            ) : null}

            {!pilotInvite?.accepted_at ? (
              <form action={approvePilotAccess} className="mt-4">
                <input type="hidden" name="id" value={lead.id} />
                <button className="btn-primary w-full">
                  {pilotInvite
                    ? (fi ? "Lähetä kutsu uudelleen" : "Resend invitation")
                    : (fi ? "Hyväksy pilottiin ja lähetä kutsu" : "Approve pilot and send invitation")}
                </button>
              </form>
            ) : null}
          </section>
          <section className="surface p-5">
            <div className="flex items-start justify-between gap-3">
              <div><div className="font-bold">{t.nextAction}</div><p className="mt-1 text-xs leading-5 text-[var(--muted)]">{t.nextBody}</p></div>
              {followUpDue ? <span className="nodra-pill">{t.due}</span> : null}
            </div>

            {lead.follow_up_on ? <div className="mt-4 rounded-xl bg-[#f7f7f5] p-3"><div className="nodra-field-label">{t.scheduled} {formatDate(lead.follow_up_on)}</div><div className="mt-1 text-sm font-semibold">{lead.next_action || t.followUpLead}</div></div> : null}

            <form action={updateLeadFollowUp} className="mt-4 space-y-3">
              <input type="hidden" name="id" value={lead.id} />
              <label className="block"><span className="nodra-field-label">{t.nextAction}</span><input name="next_action" defaultValue={lead.next_action || ""} maxLength={500} placeholder={t.actionPlaceholder} className="nodra-input mt-2" /></label>
              <label className="block"><span className="nodra-field-label">{t.followDate}</span><input name="follow_up_on" type="date" defaultValue={lead.follow_up_on || ""} className="nodra-input mt-2" /></label>
              <button className="btn-primary w-full">{t.saveAction}</button>
            </form>
            {lead.follow_up_on ? <form action={completeLeadFollowUp} className="mt-2"><input type="hidden" name="id" value={lead.id} /><button className="btn-secondary w-full">{t.complete}</button></form> : null}
          </section>

          <section className="surface p-5">
            <div className="font-bold">{t.stage}</div><p className="mt-1 text-xs leading-5 text-[var(--muted)]">{t.stageBody}</p>
            <form action={updateLeadStatus} className="mt-4 space-y-3">
              <input type="hidden" name="id" value={lead.id} />
              <select name="status" defaultValue={lead.status} className="nodra-input">
                {Object.entries(t.statuses).map(([value,label]) => <option key={value} value={value}>{label}</option>)}
              </select>
              <button className="btn-primary w-full">{t.updateStage}</button>
            </form>
          </section>

          <section className="surface p-5">
            <div className="nodra-field-label">{t.created}</div><div className="mt-1 text-sm font-semibold">{new Date(lead.created_at).toLocaleString(displayLocale)}</div>
            <div className="nodra-field-label mt-4">{t.lastUpdate}</div><div className="mt-1 text-sm font-semibold">{new Date(lead.updated_at || lead.created_at).toLocaleString(displayLocale)}</div>
            {lead.follow_up_completed_at ? <><div className="nodra-field-label mt-4">{t.lastFollowUp}</div><div className="mt-1 text-sm font-semibold">{new Date(lead.follow_up_completed_at).toLocaleString(displayLocale)}</div></> : null}
          </section>

          <a href={`mailto:${lead.work_email}`} className="btn-secondary block text-center">{t.emailLead}</a>
        </aside>
      </div>
    </div>
  );
}
