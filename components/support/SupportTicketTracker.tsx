"use client";

import type { FormEvent } from "react";
import { useEffect, useState } from "react";
import type { Locale } from "@/lib/locale";

type TicketListItem = {
  id: string;
  ticketNumber: number;
  subject: string;
  category: string;
  status: string;
  priority: string;
  createdAt: string;
  updatedAt: string;
  lastMessageAt: string;
  unread: boolean;
};

type TicketMessage = {
  id: string;
  authorType: string;
  body: string;
  createdAt: string;
};

type TicketAttachment = {
  id: string;
  messageId: string | null;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: string;
  url: string | null;
};

type TicketDetail = {
  id: string;
  ticketNumber: number;
  subject: string;
  category: string;
  status: string;
  priority: string;
  contextPath: string | null;
  createdAt: string;
  updatedAt: string;
  resolvedAt: string | null;
  lastMessageAt: string;
};

function statusLabel(status: string, locale: Locale) {
  const fi = locale === "fi";
  const labels: Record<string, string> = fi
    ? {
        new: "Uusi",
        in_progress: "Käsittelyssä",
        waiting_customer: "Odottaa vastaustasi",
        resolved: "Ratkaistu",
      }
    : {
        new: "New",
        in_progress: "In progress",
        waiting_customer: "Waiting for you",
        resolved: "Resolved",
      };
  return labels[status] || status;
}

function formatDate(value: string, locale: Locale) {
  try {
    return new Intl.DateTimeFormat(locale === "fi" ? "fi-FI" : "en-US", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(value));
  } catch {
    return value;
  }
}

function fileSize(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function SupportTicketTracker({
  locale,
  ticketId,
  onBack,
  onOpenTicket,
  onUnreadChange,
}: {
  locale: Locale;
  ticketId: string | null;
  onBack: () => void;
  onOpenTicket: (ticketId: string) => void;
  onUnreadChange: (count: number) => void;
}) {
  const fi = locale === "fi";
  const [tickets, setTickets] = useState<TicketListItem[]>([]);
  const [ticket, setTicket] = useState<TicketDetail | null>(null);
  const [messages, setMessages] = useState<TicketMessage[]>([]);
  const [attachments, setAttachments] = useState<TicketAttachment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reply, setReply] = useState("");
  const [replyScreenshot, setReplyScreenshot] = useState<File | null>(null);
  const [replying, setReplying] = useState(false);

  async function loadList() {
    const response = await fetch("/api/support/tickets", {
      cache: "no-store",
    });
    const data = (await response.json()) as {
      tickets?: TicketListItem[];
      unreadCount?: number;
      error?: string;
    };

    if (!response.ok) {
      throw new Error(
        data.error ||
          (fi
            ? "Tukipyyntöjä ei voitu ladata."
            : "Support requests could not be loaded."),
      );
    }

    const nextTickets = Array.isArray(data.tickets) ? data.tickets : [];
    setTickets(nextTickets);
    onUnreadChange(Number(data.unreadCount || 0));
  }

  async function loadDetail(id: string) {
    const response = await fetch(`/api/support/tickets/${encodeURIComponent(id)}`, {
      cache: "no-store",
    });
    const data = (await response.json()) as {
      ticket?: TicketDetail;
      messages?: TicketMessage[];
      attachments?: TicketAttachment[];
      error?: string;
    };

    if (!response.ok || !data.ticket) {
      throw new Error(
        data.error ||
          (fi
            ? "Tukipyyntöä ei voitu ladata."
            : "Support request could not be loaded."),
      );
    }

    setTicket(data.ticket);
    setMessages(Array.isArray(data.messages) ? data.messages : []);
    setAttachments(Array.isArray(data.attachments) ? data.attachments : []);
    await loadList();
  }

  useEffect(() => {
    let cancelled = false;

    setLoading(true);
    setError("");

    (async () => {
      try {
        if (ticketId) await loadDetail(ticketId);
        else await loadList();
      } catch (loadError) {
        if (!cancelled) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : fi
                ? "Tukitietoja ei voitu ladata."
                : "Support data could not be loaded.",
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [ticketId]);

  async function submitReply(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!ticketId || replying || reply.trim().length < 1) return;

    setReplying(true);
    setError("");

    try {
      const data = new FormData();
      data.set("message", reply.trim());
      if (replyScreenshot) data.set("screenshot", replyScreenshot);

      const response = await fetch(
        `/api/support/tickets/${encodeURIComponent(ticketId)}`,
        {
          method: "POST",
          body: data,
        },
      );

      const result = (await response.json()) as {
        error?: string;
      };

      if (!response.ok) {
        throw new Error(
          result.error ||
            (fi
              ? "Vastausta ei voitu lähettää."
              : "The reply could not be sent."),
        );
      }

      setReply("");
      setReplyScreenshot(null);
      await loadDetail(ticketId);
    } catch (replyError) {
      setError(
        replyError instanceof Error
          ? replyError.message
          : fi
            ? "Vastausta ei voitu lähettää."
            : "The reply could not be sent.",
      );
    } finally {
      setReplying(false);
    }
  }

  if (loading) {
    return (
      <div className="support-ticket-loading" aria-live="polite">
        <span aria-hidden="true" />
        {fi ? "Ladataan tukipyyntöjä…" : "Loading support requests…"}
      </div>
    );
  }

  if (ticketId && ticket) {
    const looseAttachments = attachments.filter((item) => !item.messageId);

    return (
      <div className="support-ticket-detail">
        <button type="button" className="support-back" onClick={onBack}>
          <span aria-hidden="true">←</span>{" "}
          {fi ? "Omat tukipyynnöt" : "My support requests"}
        </button>

        <div className="support-ticket-detail-head">
          <div>
            <span>#{ticket.ticketNumber}</span>
            <strong>{ticket.subject}</strong>
          </div>
          <span className={`support-ticket-status is-${ticket.status}`}>
            {statusLabel(ticket.status, locale)}
          </span>
        </div>

        <div className="support-ticket-meta">
          <span>{formatDate(ticket.createdAt, locale)}</span>
          <span>{ticket.category}</span>
          <span>{fi ? "Prioriteetti" : "Priority"}: {ticket.priority}</span>
        </div>

        {looseAttachments.length ? (
          <div className="support-ticket-attachments">
            {looseAttachments.map((attachment) => (
              attachment.url ? (
                <a
                  key={attachment.id}
                  href={attachment.url}
                  target="_blank"
                  rel="noreferrer"
                >
                  <span>{attachment.fileName}</span>
                  <small>{fileSize(attachment.sizeBytes)}</small>
                </a>
              ) : null
            ))}
          </div>
        ) : null}

        <div className="support-ticket-thread">
          {messages.map((item) => {
            const messageAttachments = attachments.filter(
              (attachment) => attachment.messageId === item.id,
            );
            const support = item.authorType === "support";

            return (
              <div
                key={item.id}
                className={`support-ticket-message ${support ? "is-support" : "is-customer"}`}
              >
                <div className="support-ticket-message-head">
                  <span>
                    {support
                      ? "Averomira Support"
                      : fi
                        ? "Sinä"
                        : "You"}
                  </span>
                  <time>{formatDate(item.createdAt, locale)}</time>
                </div>
                <p>{item.body}</p>

                {messageAttachments.length ? (
                  <div className="support-ticket-message-files">
                    {messageAttachments.map((attachment) =>
                      attachment.url ? (
                        <a
                          key={attachment.id}
                          href={attachment.url}
                          target="_blank"
                          rel="noreferrer"
                        >
                          {attachment.fileName} · {fileSize(attachment.sizeBytes)}
                        </a>
                      ) : null,
                    )}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>

        <form className="support-ticket-reply" onSubmit={submitReply}>
          <label>
            <span>{fi ? "Vastaa tukeen" : "Reply to support"}</span>
            <textarea
              value={reply}
              onChange={(event) => setReply(event.target.value)}
              maxLength={5000}
              rows={4}
              placeholder={
                fi
                  ? "Kirjoita lisätiedot tai vastauksesi tähän…"
                  : "Add details or your reply here…"
              }
            />
          </label>
          <div className="support-ticket-reply-tools">
            <label>
              <span>{fi ? "Lisää kuvakaappaus" : "Add screenshot"}</span>
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={(event) =>
                  setReplyScreenshot(event.target.files?.[0] ?? null)
                }
              />
            </label>
            <button
              type="submit"
              disabled={replying || reply.trim().length < 1}
            >
              {replying
                ? fi
                  ? "Lähetetään…"
                  : "Sending…"
                : fi
                  ? "Lähetä vastaus"
                  : "Send reply"}
              {!replying ? <span aria-hidden="true">→</span> : null}
            </button>
          </div>
          {replyScreenshot ? (
            <small>{replyScreenshot.name}</small>
          ) : null}
        </form>

        {error ? (
          <p className="support-form-error" role="alert">
            {error}
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <div className="support-ticket-list-view">
      <button type="button" className="support-back" onClick={onBack}>
        <span aria-hidden="true">←</span>{" "}
        {fi ? "Takaisin Help Centeriin" : "Back to Help Center"}
      </button>

      <div className="support-ticket-list-intro">
        <p>
          {fi
            ? "Näet tukipyyntöjesi tilan ja Averomira-tuen vastaukset täällä."
            : "Track the status of your support requests and replies from Averomira Support here."}
        </p>
      </div>

      {error ? (
        <p className="support-form-error" role="alert">
          {error}
        </p>
      ) : null}

      {tickets.length ? (
        <div className="support-ticket-list">
          {tickets.map((item) => (
            <button
              key={item.id}
              type="button"
              className={item.unread ? "is-unread" : ""}
              onClick={() => onOpenTicket(item.id)}
            >
              <div className="support-ticket-list-main">
                <span>
                  #{item.ticketNumber}
                  {item.unread ? (
                    <i aria-label={fi ? "Uusi vastaus" : "New reply"} />
                  ) : null}
                </span>
                <strong>{item.subject}</strong>
                <small>{formatDate(item.lastMessageAt, locale)}</small>
              </div>
              <div className="support-ticket-list-side">
                <span className={`support-ticket-status is-${item.status}`}>
                  {statusLabel(item.status, locale)}
                </span>
                <span aria-hidden="true">→</span>
              </div>
            </button>
          ))}
        </div>
      ) : (
        <div className="support-ticket-empty">
          <strong>{fi ? "Ei tukipyyntöjä vielä" : "No support requests yet"}</strong>
          <p>
            {fi
              ? "Kun lähetät tukipyynnön Help Centeristä, se näkyy tässä."
              : "When you send a support request from the Help Center, it will appear here."}
          </p>
        </div>
      )}
    </div>
  );
}
