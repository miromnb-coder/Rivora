"use client";

import type { FormEvent } from "react";
import { useEffect, useMemo, useState } from "react";
import type { Locale } from "@/lib/locale";

type InboxTicket = {
  id: string;
  ticketNumber: number;
  organizationId: string;
  workspaceName: string;
  requesterEmail: string | null;
  subject: string;
  category: string;
  status: string;
  priority: string;
  createdAt: string;
  updatedAt: string;
  lastMessageAt: string;
  waitingOnSupport: boolean;
};

type DetailTicket = {
  id: string;
  ticketNumber: number;
  organizationId: string;
  workspaceName: string;
  requesterEmail: string | null;
  subject: string;
  category: string;
  status: string;
  priority: string;
  contextPath: string | null;
  requestId: string | null;
  createdAt: string;
  updatedAt: string;
  resolvedAt: string | null;
};

type Message = {
  id: string;
  authorUserId: string | null;
  authorType: string;
  body: string;
  createdAt: string;
};

type Attachment = {
  id: string;
  messageId: string | null;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: string;
  url: string | null;
};

function statusLabel(status: string, fi: boolean) {
  const labels: Record<string, string> = fi
    ? {
        new: "Uusi",
        in_progress: "Käsittelyssä",
        waiting_customer: "Odottaa asiakkaalta",
        resolved: "Ratkaistu",
      }
    : {
        new: "New",
        in_progress: "In progress",
        waiting_customer: "Waiting for customer",
        resolved: "Resolved",
      };
  return labels[status] || status;
}

function date(value: string, locale: Locale) {
  return new Intl.DateTimeFormat(locale === "fi" ? "fi-FI" : "en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export function SupportInbox({ locale }: { locale: Locale }) {
  const fi = locale === "fi";
  const [tickets, setTickets] = useState<InboxTicket[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [ticket, setTicket] = useState<DetailTicket | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [filter, setFilter] = useState<"open" | "all" | "resolved">("open");
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState("");
  const [reply, setReply] = useState("");
  const [replyStatus, setReplyStatus] = useState("waiting_customer");
  const [sending, setSending] = useState(false);
  const [saving, setSaving] = useState(false);

  const visibleTickets = useMemo(() => {
    if (filter === "all") return tickets;
    if (filter === "resolved") {
      return tickets.filter((item) => item.status === "resolved");
    }
    return tickets.filter((item) => item.status !== "resolved");
  }, [filter, tickets]);

  async function loadTickets() {
    const response = await fetch("/api/support/operator/tickets", {
      cache: "no-store",
    });
    const data = (await response.json()) as {
      tickets?: InboxTicket[];
      error?: string;
    };
    if (!response.ok) throw new Error(data.error || "Support inbox failed.");
    const next = Array.isArray(data.tickets) ? data.tickets : [];
    setTickets(next);

    if (!selectedId && next.length) {
      const first =
        next.find((item) => item.waitingOnSupport && item.status !== "resolved") ||
        next.find((item) => item.status !== "resolved") ||
        next[0];
      setSelectedId(first.id);
    }
  }

  async function loadDetail(id: string) {
    setDetailLoading(true);
    try {
      const response = await fetch(
        `/api/support/operator/tickets/${encodeURIComponent(id)}`,
        { cache: "no-store" },
      );
      const data = (await response.json()) as {
        ticket?: DetailTicket;
        messages?: Message[];
        attachments?: Attachment[];
        error?: string;
      };
      if (!response.ok || !data.ticket) {
        throw new Error(data.error || "Support ticket failed.");
      }

      setTicket(data.ticket);
      setMessages(Array.isArray(data.messages) ? data.messages : []);
      setAttachments(Array.isArray(data.attachments) ? data.attachments : []);
      setReplyStatus(
        data.ticket.status === "resolved" ? "resolved" : "waiting_customer",
      );
    } finally {
      setDetailLoading(false);
    }
  }

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");

    (async () => {
      try {
        await loadTickets();
      } catch (loadError) {
        if (!cancelled) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Support inbox failed.",
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!selectedId) {
      setTicket(null);
      setMessages([]);
      setAttachments([]);
      return;
    }

    setError("");
    loadDetail(selectedId).catch((loadError) => {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Support ticket failed.",
      );
    });
  }, [selectedId]);

  async function submitReply(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedId || sending || reply.trim().length < 1) return;

    setSending(true);
    setError("");
    try {
      const response = await fetch(
        `/api/support/operator/tickets/${encodeURIComponent(selectedId)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: reply.trim(),
            status: replyStatus,
          }),
        },
      );
      const data = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(data.error || "Reply failed.");

      setReply("");
      await Promise.all([loadDetail(selectedId), loadTickets()]);
    } catch (replyError) {
      setError(
        replyError instanceof Error ? replyError.message : "Reply failed.",
      );
    } finally {
      setSending(false);
    }
  }

  async function saveState() {
    if (!selectedId || !ticket || saving) return;
    setSaving(true);
    setError("");

    try {
      const response = await fetch(
        `/api/support/operator/tickets/${encodeURIComponent(selectedId)}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            status: ticket.status,
            priority: ticket.priority,
          }),
        },
      );
      const data = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(data.error || "Update failed.");
      await Promise.all([loadDetail(selectedId), loadTickets()]);
    } catch (saveError) {
      setError(
        saveError instanceof Error ? saveError.message : "Update failed.",
      );
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="support-ops-loading">
        {fi ? "Ladataan tukijonoa…" : "Loading support inbox…"}
      </div>
    );
  }

  return (
    <div className="support-ops">
      <div className="support-ops-toolbar">
        <div className="support-ops-filters">
          {(["open", "all", "resolved"] as const).map((value) => (
            <button
              key={value}
              type="button"
              className={filter === value ? "is-active" : ""}
              onClick={() => setFilter(value)}
            >
              {value === "open"
                ? fi
                  ? "Avoimet"
                  : "Open"
                : value === "resolved"
                  ? fi
                    ? "Ratkaistut"
                    : "Resolved"
                  : fi
                    ? "Kaikki"
                    : "All"}
            </button>
          ))}
        </div>
        <span>
          {tickets.filter((item) => item.waitingOnSupport && item.status !== "resolved").length}{" "}
          {fi ? "odottaa tukea" : "waiting on support"}
        </span>
      </div>

      {error ? (
        <p className="support-form-error" role="alert">
          {error}
        </p>
      ) : null}

      <div className="support-ops-grid">
        <aside className="support-ops-list">
          {visibleTickets.map((item) => (
            <button
              key={item.id}
              type="button"
              className={
                (selectedId === item.id ? "is-selected " : "") +
                (item.waitingOnSupport ? "is-waiting" : "")
              }
              onClick={() => setSelectedId(item.id)}
            >
              <div>
                <span>#{item.ticketNumber} · {item.workspaceName}</span>
                <strong>{item.subject}</strong>
                <small>{date(item.lastMessageAt, locale)}</small>
              </div>
              <div>
                {item.waitingOnSupport ? <i>{fi ? "Uusi" : "New"}</i> : null}
                <span className={`support-ticket-status is-${item.status}`}>
                  {statusLabel(item.status, fi)}
                </span>
              </div>
            </button>
          ))}
          {!visibleTickets.length ? (
            <div className="support-ops-empty">
              {fi ? "Ei tukipyyntöjä tässä näkymässä." : "No tickets in this view."}
            </div>
          ) : null}
        </aside>

        <section className="support-ops-detail">
          {detailLoading ? (
            <div className="support-ops-loading">
              {fi ? "Ladataan keskustelua…" : "Loading conversation…"}
            </div>
          ) : ticket ? (
            <>
              <header className="support-ops-detail-head">
                <div>
                  <span>#{ticket.ticketNumber} · {ticket.workspaceName}</span>
                  <h2>{ticket.subject}</h2>
                  <p>
                    {ticket.requesterEmail || "—"} · {ticket.category}
                    {ticket.contextPath ? ` · ${ticket.contextPath}` : ""}
                  </p>
                </div>
                <div className="support-ops-state">
                  <label>
                    <span>{fi ? "Tila" : "Status"}</span>
                    <select
                      value={ticket.status}
                      onChange={(event) =>
                        setTicket({ ...ticket, status: event.target.value })
                      }
                    >
                      <option value="new">{statusLabel("new", fi)}</option>
                      <option value="in_progress">{statusLabel("in_progress", fi)}</option>
                      <option value="waiting_customer">{statusLabel("waiting_customer", fi)}</option>
                      <option value="resolved">{statusLabel("resolved", fi)}</option>
                    </select>
                  </label>
                  <label>
                    <span>{fi ? "Prioriteetti" : "Priority"}</span>
                    <select
                      value={ticket.priority}
                      onChange={(event) =>
                        setTicket({ ...ticket, priority: event.target.value })
                      }
                    >
                      <option value="low">{fi ? "Matala" : "Low"}</option>
                      <option value="normal">{fi ? "Normaali" : "Normal"}</option>
                      <option value="high">{fi ? "Korkea" : "High"}</option>
                    </select>
                  </label>
                  <button type="button" onClick={saveState} disabled={saving}>
                    {saving ? (fi ? "Tallennetaan…" : "Saving…") : fi ? "Tallenna" : "Save"}
                  </button>
                </div>
              </header>

              <div className="support-ops-thread">
                {messages.map((message) => {
                  const messageFiles = attachments.filter(
                    (attachment) => attachment.messageId === message.id,
                  );
                  return (
                    <div
                      key={message.id}
                      className={`support-ops-message is-${message.authorType}`}
                    >
                      <div>
                        <strong>
                          {message.authorType === "support"
                            ? "Averomira Support"
                            : message.authorType === "system"
                              ? "System"
                              : ticket.requesterEmail || (fi ? "Asiakas" : "Customer")}
                        </strong>
                        <time>{date(message.createdAt, locale)}</time>
                      </div>
                      <p>{message.body}</p>
                      {messageFiles.length ? (
                        <div className="support-ops-files">
                          {messageFiles.map((attachment) =>
                            attachment.url ? (
                              <a
                                key={attachment.id}
                                href={attachment.url}
                                target="_blank"
                                rel="noreferrer"
                              >
                                {attachment.fileName}
                              </a>
                            ) : null,
                          )}
                        </div>
                      ) : null}
                    </div>
                  );
                })}

                {attachments.filter((item) => !item.messageId).length ? (
                  <div className="support-ops-loose-files">
                    <strong>{fi ? "Liitteet" : "Attachments"}</strong>
                    {attachments
                      .filter((item) => !item.messageId)
                      .map((attachment) =>
                        attachment.url ? (
                          <a
                            key={attachment.id}
                            href={attachment.url}
                            target="_blank"
                            rel="noreferrer"
                          >
                            {attachment.fileName}
                          </a>
                        ) : null,
                      )}
                  </div>
                ) : null}
              </div>

              <form className="support-ops-reply" onSubmit={submitReply}>
                <textarea
                  value={reply}
                  onChange={(event) => setReply(event.target.value)}
                  maxLength={5000}
                  rows={5}
                  placeholder={
                    fi
                      ? "Kirjoita asiakkaalle vastaus…"
                      : "Write a reply to the customer…"
                  }
                />
                <div>
                  <label>
                    <span>{fi ? "Vastauksen jälkeen" : "After reply"}</span>
                    <select
                      value={replyStatus}
                      onChange={(event) => setReplyStatus(event.target.value)}
                    >
                      <option value="waiting_customer">
                        {statusLabel("waiting_customer", fi)}
                      </option>
                      <option value="in_progress">
                        {statusLabel("in_progress", fi)}
                      </option>
                      <option value="resolved">
                        {statusLabel("resolved", fi)}
                      </option>
                    </select>
                  </label>
                  <button
                    type="submit"
                    disabled={sending || reply.trim().length < 1}
                  >
                    {sending
                      ? fi
                        ? "Lähetetään…"
                        : "Sending…"
                      : fi
                        ? "Lähetä vastaus"
                        : "Send reply"}
                  </button>
                </div>
              </form>
            </>
          ) : (
            <div className="support-ops-empty">
              {fi ? "Valitse tukipyyntö." : "Select a support request."}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
