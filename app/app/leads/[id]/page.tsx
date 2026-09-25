import Link from "next/link";
import { notFound } from "next/navigation";
import { requireSalesAdmin } from "@/lib/rivora/sales";
import {
  completeLeadFollowUp,
  markLeadRead,
  updateLeadFollowUp,
  updateLeadNote,
  updateLeadStatus,
} from "../actions";

function statusClass(status: string) {
  if (status === "qualified") return "green";
  if (status === "contacted") return "amber";
  if (status === "closed") return "red";
  return "";
}

function formatDate(date: string | null) {
  if (!date) return null;
  return new Date(`${date}T12:00:00Z`).toLocaleDateString("fi-FI");
}

export default async function LeadDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { supabase } = await requireSalesAdmin();

  const { data: lead } = await supabase
    .from("marketing_leads")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (!lead) notFound();

  const today = new Date().toISOString().slice(0, 10);
  const followUpDue =
    lead.status !== "closed" &&
    typeof lead.follow_up_on === "string" &&
    lead.follow_up_on <= today;

  return (
    <div className="mx-auto max-w-5xl px-5 py-8 sm:px-8 lg:px-10 lg:py-10">
      <Link href="/app/leads" className="text-sm font-bold text-[var(--green)]">
        ← Lead inbox
      </Link>

      <div className="mt-6 flex flex-col justify-between gap-5 sm:flex-row sm:items-start">
        <div>
          <div className="flex items-center gap-2">
            <div className="kicker">{String(lead.intent).toUpperCase()} lead</div>
            {!lead.notification_read_at ? (
              <span className="rounded-full bg-[#f4e8d7] px-2 py-1 text-[10px] font-black uppercase tracking-wider text-[#7a5428]">
                Unread
              </span>
            ) : null}
          </div>
          <h1 className="mt-2 text-3xl font-extrabold tracking-[-.035em]">{lead.name}</h1>
          <p className="mt-2 text-sm text-[var(--muted)]">
            {lead.company} · {lead.work_email}
          </p>
        </div>
        <span className={`status w-fit ${statusClass(lead.status)}`}>{lead.status}</span>
      </div>

      {!lead.notification_read_at ? (
        <form action={markLeadRead} className="mt-5 rounded-xl border border-[#ead7bd] bg-[#fbf5ec] p-4 sm:flex sm:items-center sm:justify-between sm:gap-4">
          <input type="hidden" name="id" value={lead.id} />
          <div>
            <div className="text-sm font-bold text-[#68451f]">New lead notification</div>
            <div className="mt-1 text-xs leading-5 text-[#896944]">
              This request is still counted in your unread lead alerts.
            </div>
          </div>
          <button className="mt-3 rounded-lg bg-[#5f4528] px-3 py-2 text-xs font-bold text-white sm:mt-0">
            Mark as read
          </button>
        </form>
      ) : null}

      <div className="mt-8 grid gap-5 lg:grid-cols-[1fr_340px]">
        <div className="space-y-5">
          <section className="surface overflow-hidden">
            <div className="border-b border-[var(--line)] px-5 py-4 font-bold">Lead context</div>
            <dl className="grid gap-0 sm:grid-cols-2">
              {[
                ["Company", lead.company],
                ["Role", lead.role || "Not provided"],
                ["Work email", lead.work_email],
                ["RFQs / month", lead.rfq_volume || "Not provided"],
                ["Intent", lead.intent],
                ["Source", lead.source],
              ].map(([label, value]) => (
                <div key={label} className="border-b border-[var(--line)] px-5 py-4 sm:odd:border-r">
                  <dt className="text-xs font-bold uppercase tracking-wider text-[var(--muted)]">{label}</dt>
                  <dd className="mt-1.5 text-sm font-semibold">{value}</dd>
                </div>
              ))}
            </dl>
          </section>

          <section className="surface p-5">
            <div className="font-bold">What they want to improve</div>
            <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-[var(--muted)]">
              {lead.message || "No message provided."}
            </p>
          </section>

          <section className="surface p-5">
            <div className="font-bold">Internal note</div>
            <form action={updateLeadNote} className="mt-4">
              <input type="hidden" name="id" value={lead.id} />
              <textarea
                name="internal_note"
                defaultValue={lead.internal_note || ""}
                maxLength={5000}
                rows={7}
                className="w-full rounded-xl border border-[var(--line)] bg-white px-3 py-3 text-sm leading-6 outline-none focus:border-[var(--green)]"
                placeholder="Add context, objections, qualification notes, or meeting notes…"
              />
              <button className="btn-primary mt-3">Save note</button>
            </form>
          </section>
        </div>

        <aside className="space-y-5">
          <section className={`surface p-5 ${followUpDue ? "border-[#dfbd8f]" : ""}`}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="font-bold">Next action</div>
                <p className="mt-1 text-xs leading-5 text-[var(--muted)]">
                  Schedule one concrete follow-up so it stays visible in the inbox.
                </p>
              </div>
              {followUpDue ? (
                <span className="rounded-full bg-[#f4e8d7] px-2 py-1 text-[9px] font-black uppercase tracking-wider text-[#7a5428]">
                  Due
                </span>
              ) : null}
            </div>

            {lead.follow_up_on ? (
              <div className="mt-4 rounded-xl bg-[#f7f8f6] p-3">
                <div className="text-xs font-bold uppercase tracking-wider text-[var(--muted)]">
                  Scheduled {formatDate(lead.follow_up_on)}
                </div>
                <div className="mt-1 text-sm font-semibold">
                  {lead.next_action || "Follow up with lead"}
                </div>
              </div>
            ) : null}

            <form action={updateLeadFollowUp} className="mt-4 space-y-3">
              <input type="hidden" name="id" value={lead.id} />
              <label className="block">
                <span className="text-xs font-bold uppercase tracking-wider text-[var(--muted)]">Next action</span>
                <input
                  name="next_action"
                  defaultValue={lead.next_action || ""}
                  maxLength={500}
                  placeholder="Send pilot scope, call buyer, share pricing…"
                  className="mt-2 w-full rounded-xl border border-[var(--line)] bg-white px-3 py-3 text-sm outline-none focus:border-[var(--green)]"
                />
              </label>
              <label className="block">
                <span className="text-xs font-bold uppercase tracking-wider text-[var(--muted)]">Follow-up date</span>
                <input
                  name="follow_up_on"
                  type="date"
                  defaultValue={lead.follow_up_on || ""}
                  className="mt-2 w-full rounded-xl border border-[var(--line)] bg-white px-3 py-3 text-sm outline-none focus:border-[var(--green)]"
                />
              </label>
              <button className="btn-primary w-full">Save next action</button>
            </form>

            {lead.follow_up_on ? (
              <form action={completeLeadFollowUp} className="mt-2">
                <input type="hidden" name="id" value={lead.id} />
                <button className="btn-secondary w-full">Complete follow-up</button>
              </form>
            ) : null}
          </section>

          <section className="surface p-5">
            <div className="font-bold">Pipeline stage</div>
            <p className="mt-1 text-xs leading-5 text-[var(--muted)]">
              Move the lead as the conversation progresses.
            </p>
            <form action={updateLeadStatus} className="mt-4 space-y-3">
              <input type="hidden" name="id" value={lead.id} />
              <select
                name="status"
                defaultValue={lead.status}
                className="w-full rounded-xl border border-[var(--line)] bg-white px-3 py-3 text-sm font-semibold outline-none focus:border-[var(--green)]"
              >
                <option value="new">New</option>
                <option value="contacted">Contacted</option>
                <option value="qualified">Qualified</option>
                <option value="closed">Closed</option>
              </select>
              <button className="btn-primary w-full">Update stage</button>
            </form>
          </section>

          <section className="surface p-5">
            <div className="text-xs font-bold uppercase tracking-wider text-[var(--muted)]">Created</div>
            <div className="mt-1 text-sm font-semibold">
              {new Date(lead.created_at).toLocaleString("fi-FI")}
            </div>
            <div className="mt-4 text-xs font-bold uppercase tracking-wider text-[var(--muted)]">Last CRM update</div>
            <div className="mt-1 text-sm font-semibold">
              {new Date(lead.updated_at || lead.created_at).toLocaleString("fi-FI")}
            </div>
            {lead.follow_up_completed_at ? (
              <>
                <div className="mt-4 text-xs font-bold uppercase tracking-wider text-[var(--muted)]">
                  Last follow-up completed
                </div>
                <div className="mt-1 text-sm font-semibold">
                  {new Date(lead.follow_up_completed_at).toLocaleString("fi-FI")}
                </div>
              </>
            ) : null}
          </section>

          <a href={`mailto:${lead.work_email}`} className="btn-secondary block text-center">
            Email lead
          </a>
        </aside>
      </div>
    </div>
  );
}
