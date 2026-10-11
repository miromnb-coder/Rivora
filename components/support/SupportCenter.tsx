"use client";

import type { FormEvent } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import type { Locale } from "@/lib/locale";
import { supportContextForPath } from "@/lib/rivora/support-context";
import { SUPPORT_OPEN_EVENT } from "@/components/support/ContextHelpTrigger";
import { SupportTicketTracker } from "@/components/support/SupportTicketTracker";
import { helpArticles, type HelpArticle } from "@/lib/rivora/support-knowledge";
import { SupportQuickPrompts } from "./SupportQuickPrompts";
import { supportEscalationDraft } from "@/lib/rivora/support-escalation";


type PanelView =
  | { kind: "home" }
  | { kind: "help" }
  | { kind: "article"; articleId: string }
  | { kind: "contact" }
  | { kind: "tickets" }
  | { kind: "ticket"; ticketId: string }
  | {
      kind: "success";
      ticketId: string;
      ticketNumber: number;
      attachmentUploaded: boolean;
    };

type SupportAiMessage = {
  id: string;
  role: "user" | "assistant";
  text: string;
  path?: string;
  requestId?: string;
  recordVerified?: boolean;
  supported?: boolean;
  articleIds?: string[];
};


function HelpIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M9.9 9.2a2.4 2.4 0 0 1 4.5 1.2c0 1.7-1.6 2.1-2.4 3.2" />
      <path d="M12 17h.01" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <path d="m6 6 12 12M18 6 6 18" />
    </svg>
  );
}

function ArrowIcon({ left = false }: { left?: boolean }) {
  return <span aria-hidden="true">{left ? "←" : "→"}</span>;
}

function BookIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H11v16H6.5A2.5 2.5 0 0 0 4 21.5z" />
      <path d="M20 5.5A2.5 2.5 0 0 0 17.5 3H13v16h4.5a2.5 2.5 0 0 1 2.5 2.5z" />
    </svg>
  );
}

function TicketIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M6 4h12a2 2 0 0 1 2 2v3a3 3 0 0 0 0 6v3a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-3a3 3 0 0 0 0-6V6a2 2 0 0 1 2-2Z" />
      <path d="M12 7v10" strokeDasharray="2 2" />
    </svg>
  );
}

function HeadsetIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 13v-1a8 8 0 0 1 16 0v1" />
      <path d="M4 13h3v6H6a2 2 0 0 1-2-2zM20 13h-3v6h1a2 2 0 0 0 2-2z" />
      <path d="M17 19c-.7 1.3-2.4 2-5 2" />
    </svg>
  );
}

export function SupportCenter({ locale, recordContextAvailable }: { locale: Locale; recordContextAvailable: boolean }) {
  const fi = locale === "fi";
  const pathname = usePathname();
  const articles = helpArticles[locale];
  const routeContext = supportContextForPath(pathname, locale);
  const contextArticles = routeContext
    ? routeContext.articleIds
        .map((articleId) => articles.find((article) => article.id === articleId))
        .filter((article): article is HelpArticle => Boolean(article))
    : [];
  const [open, setOpen] = useState(false);
  const [closing, setClosing] = useState(false);
  const [view, setView] = useState<PanelView>({ kind: "home" });
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("product");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [screenshot, setScreenshot] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");
  const [aiQuestion, setAiQuestion] = useState("");
  const [useCurrentRecord, setUseCurrentRecord] = useState(false);
  const [escalationReview, setEscalationReview] = useState(false);
  const [aiMessages, setAiMessages] = useState<SupportAiMessage[]>([]);
  const [aiAsking, setAiAsking] = useState(false);
  const [aiSent, setAiSent] = useState(false);
  const [aiError, setAiError] = useState("");
  const [supportUnreadCount, setSupportUnreadCount] = useState(0);
  const [contextChanged, setContextChanged] = useState(false);
  const [articleReturnView, setArticleReturnView] = useState<"home" | "help">("home");
  const searchRef = useRef<HTMLInputElement>(null);
  const aiInputRef = useRef<HTMLTextAreaElement>(null);
  const aiThreadRef = useRef<HTMLDivElement>(null);
  const aiSuccessTimerRef = useRef<number | null>(null);
  const closeTimerRef = useRef<number | null>(null);
  const previousPathRef = useRef(pathname);

  const filteredArticles = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase(locale === "fi" ? "fi-FI" : "en-US");
    if (!needle) return articles;

    return articles.filter((article) =>
      [article.title, article.summary, ...article.body]
        .join(" ")
        .toLocaleLowerCase(locale === "fi" ? "fi-FI" : "en-US")
        .includes(needle),
    );
  }, [articles, locale, query]);

  const selectedArticle =
    view.kind === "article"
      ? articles.find((article) => article.id === view.articleId) ?? null
      : null;

  useEffect(() => {
    let cancelled = false;

    async function refreshUnread() {
      try {
        const response = await fetch("/api/support/tickets", {
          cache: "no-store",
        });
        if (!response.ok) return;
        const data = (await response.json()) as { unreadCount?: number };
        if (!cancelled) setSupportUnreadCount(Number(data.unreadCount || 0));
      } catch {
        // Support notification polling must never disrupt the application shell.
      }
    }

    refreshUnread();

    const interval = window.setInterval(() => {
      if (!document.hidden) refreshUnread();
    }, 60_000);

    const onVisible = () => {
      if (!document.hidden) refreshUnread();
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  useEffect(() => {
    if (previousPathRef.current === pathname) return;
    previousPathRef.current = pathname;
    // Keep the thread visible across navigation; previous records are never
    // reused as AI history for the current record.
    setAiQuestion("");
    setUseCurrentRecord(false);
    setAiSent(false);
    setAiError("");
    setContextChanged(aiMessages.length > 0);
  }, [pathname]);

  useEffect(() => {
    return () => {
      if (aiSuccessTimerRef.current) {
        window.clearTimeout(aiSuccessTimerRef.current);
      }
      if (closeTimerRef.current) {
        window.clearTimeout(closeTimerRef.current);
      }
    };
  }, []);

  function openSupport() {
    if (closeTimerRef.current) {
      window.clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
    setClosing(false);
    setOpen(true);
  }

  function closeSupport() {
    if (!open || closing) return;

    const reducedMotion =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    setClosing(true);
    closeTimerRef.current = window.setTimeout(
      () => {
        setOpen(false);
        setClosing(false);
        closeTimerRef.current = null;
      },
      reducedMotion ? 0 : 180,
    );
  }

  useEffect(() => {
    const handleContextHelp = (event: Event) => {
      const detail = (event as CustomEvent<{ articleId?: string }>).detail;
      const articleId = detail?.articleId;
      if (!articleId || !articles.some((article) => article.id === articleId)) return;

      setQuery("");
      setView({ kind: "article", articleId });
      openSupport();
    };

    window.addEventListener(SUPPORT_OPEN_EVENT, handleContextHelp);
    return () => window.removeEventListener(SUPPORT_OPEN_EVENT, handleContextHelp);
  }, [articles]);

  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeSupport();
    };

    document.addEventListener("keydown", onKeyDown);
    document.body.classList.add("support-center-open");

    const timer = window.setTimeout(() => {
      if (view.kind === "home") aiInputRef.current?.focus();
    }, 80);

    return () => {
      window.clearTimeout(timer);
      document.removeEventListener("keydown", onKeyDown);
      document.body.classList.remove("support-center-open");
    };
  }, [open, view.kind]);

  useEffect(() => {
    if (aiThreadRef.current) {
      aiThreadRef.current.scrollTop = aiThreadRef.current.scrollHeight;
    }
  }, [aiMessages, aiAsking]);

  function openContact() {
    setView({ kind: "contact" });
    setFormError("");
  }

  function openContactFromAi() {
    const draft = supportEscalationDraft(aiMessages, pathname, locale);
    if (pathname.includes("business-central")) setCategory("integration");
    else setCategory("product");
    setSubject(draft.subject);
    setMessage(draft.body);
    setEscalationReview(true);
    setScreenshot(null);
    setFormError("");
    setView({ kind: "contact" });
  }

  async function askSupportAi(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const question = aiQuestion.trim();
    if (question.length < 3 || aiAsking) return;

    const userMessage: SupportAiMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      text: question,
      path: pathname,
    };

    const previousMessages = aiMessages;
    setAiMessages([...previousMessages, userMessage]);
    setAiQuestion("");
    setAiError("");
    setContextChanged(false);
    if (aiSuccessTimerRef.current) {
      window.clearTimeout(aiSuccessTimerRef.current);
      aiSuccessTimerRef.current = null;
    }
    setAiSent(false);
    setAiAsking(true);

    try {
      const currentPath =
        typeof window === "undefined"
          ? pathname
          : `${window.location.pathname}${window.location.search}`;

      const response = await fetch("/api/support/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          locale,
          question,
          contextPath: currentPath,
          useCurrentRecord,
          history: previousMessages.filter((item) => item.path === pathname).slice(-6).map((item) => ({
            role: item.role,
            text: item.text,
          })),
        }),
      });

      const data = (await response.json()) as {
        supported?: boolean;
        answer?: string;
        articleIds?: string[];
        sensitiveInputBlocked?: boolean;
        recordVerified?: boolean;
        requestId?: string;
        error?: string;
      };

      if (!response.ok || !data.answer) {
        throw new Error(
          data.error ||
            (fi
              ? "Support AI ei pystynyt vastaamaan juuri nyt."
              : "Support AI could not answer right now."),
        );
      }

      setAiMessages((current) => [
        ...current.map((item) =>
          data.sensitiveInputBlocked && item.id === userMessage.id
            ? {
                ...item,
                text: fi
                  ? "[Mahdollinen salaisuus poistettu keskustelusta]"
                  : "[Potential secret removed from conversation]",
              }
            : item,
        ),
        {
          id: `assistant-${Date.now()}`,
          role: "assistant",
          path: pathname,
          requestId: data.requestId,
          recordVerified: data.recordVerified === true,
          text: data.answer || "",
          supported: data.supported === true,
          articleIds: Array.isArray(data.articleIds) ? data.articleIds : [],
        },
      ]);
      setAiSent(true);
      aiSuccessTimerRef.current = window.setTimeout(() => {
        setAiSent(false);
        aiSuccessTimerRef.current = null;
      }, 900);
    } catch (error) {
      setAiError(
        error instanceof Error
          ? error.message
          : fi
            ? "Support AI ei pystynyt vastaamaan juuri nyt."
            : "Support AI could not answer right now.",
      );
    } finally {
      setAiAsking(false);
    }
  }

  function resetContact() {
    setCategory("product");
    setSubject("");
    setMessage("");
    setScreenshot(null);
    setFormError("");
    setEscalationReview(false);
  }

  async function submitSupport(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;

    if (subject.trim().length < 3 || message.trim().length < 10) {
      setFormError(
        fi
          ? "Kirjoita lyhyt aihe ja vähintään 10 merkin kuvaus."
          : "Add a short subject and a description of at least 10 characters.",
      );
      return;
    }

    setSubmitting(true);
    setFormError("");

    try {
      const data = new FormData();
      data.set("category", category);
      data.set("subject", subject.trim());
      data.set("message", message.trim());

      const currentPath =
        typeof window === "undefined"
          ? pathname
          : `${window.location.pathname}${window.location.search}`;
      data.set("contextPath", currentPath);

      if (screenshot) data.set("screenshot", screenshot);

      const response = await fetch("/api/support/tickets", {
        method: "POST",
        body: data,
      });

      const result = (await response.json()) as {
        ticketId?: string;
        ticketNumber?: number;
        attachmentUploaded?: boolean;
        error?: string;
      };

      if (!response.ok || !result.ticketId || !result.ticketNumber) {
        throw new Error(
          result.error ||
            (fi
              ? "Tukipyyntöä ei voitu lähettää."
              : "The support request could not be sent."),
        );
      }

      const ticketId = result.ticketId;
      const ticketNumber = result.ticketNumber;
      const attachmentUploaded = result.attachmentUploaded !== false;
      resetContact();
      setView({ kind: "success", ticketId, ticketNumber, attachmentUploaded });
    } catch (error) {
      setFormError(
        error instanceof Error
          ? error.message
          : fi
            ? "Tukipyyntöä ei voitu lähettää."
            : "The support request could not be sent.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <button
        type="button"
        className={"support-launcher" + (open && !closing ? " is-open" : "")}
        aria-label={fi ? "Avaa Averomira Help Center" : "Open Averomira Help Center"}
        aria-expanded={open}
        onClick={() => {
          openSupport();
          if (view.kind === "success") setView({ kind: "home" });
        }}
      >
        <HelpIcon />
        <span>{fi ? "Apua?" : "Help"}</span>
        {supportUnreadCount > 0 ? (
          <i className="support-launcher-badge" aria-label={fi ? `${supportUnreadCount} uutta tukivastausta` : `${supportUnreadCount} new support replies`}>
            {supportUnreadCount > 9 ? "9+" : supportUnreadCount}
          </i>
        ) : null}
      </button>

      {open ? (
        <div className={"support-center-layer" + (closing ? " is-closing" : "")}>
          <button
            type="button"
            className="support-center-backdrop"
            aria-label={fi ? "Sulje Help Center" : "Close Help Center"}
            onClick={closeSupport}
          />

          <section
            className="support-center-panel"
            role="dialog"
            aria-modal="true"
            aria-labelledby="support-center-title"
          >
            <header className={"support-center-header" + (view.kind === "home" ? " is-ai-home" : "")}>
              <div>
                <span>{view.kind === "home" ? "AVEROMIRA" : "AVEROMIRA SUPPORT"}</span>
                <h2 id="support-center-title">
                  {view.kind === "home"
                    ? fi
                      ? "Averomira AI"
                      : "Averomira AI"
                    : view.kind === "help"
                      ? fi ? "Ohjeet" : "Help articles"
                    : view.kind === "contact"
                      ? fi
                        ? "Ota yhteyttä tukeen"
                        : "Contact support"
                      : view.kind === "tickets"
                        ? fi
                          ? "Omat tukipyynnöt"
                          : "My support requests"
                        : view.kind === "ticket"
                          ? fi
                            ? "Tukipyyntö"
                            : "Support request"
                          : view.kind === "success"
                            ? fi
                              ? "Pyyntö vastaanotettu"
                              : "Request received"
                            : selectedArticle?.title || (fi ? "Ohje" : "Help")}
                </h2>
                {view.kind === "home" ? (
                  <p className="support-center-header-subtitle">
                    {fi
                      ? "Älykäs avustajasi Averomirassa"
                      : "Your intelligent Averomira assistant."}
                  </p>
                ) : null}
              </div>
              {view.kind === "home" && aiMessages.length ? (
                <button type="button" className="support-ai-new-chat"
                  onClick={() => {
                    setAiMessages([]); setAiQuestion(""); setAiError(""); setContextChanged(false);
                    window.setTimeout(() => aiInputRef.current?.focus(), 0);
                  }}
                  aria-label={fi ? "Uusi keskustelu" : "New conversation"}
                  title={fi ? "Uusi keskustelu" : "New conversation"}
                >+</button>
              ) : null}
              <button
                type="button"
                className="support-center-close"
                onClick={closeSupport}
                aria-label={fi ? "Sulje" : "Close"}
              >
                <CloseIcon />
              </button>
            </header>

            <div className={"support-center-body" + (view.kind === "home" ? " is-ai-home" : "")}>

              {view.kind === "home" ? (
                <div className="support-ai-shell">
                  <div className="support-ai-scroll" aria-label={fi ? "AI-keskustelu" : "AI conversation"}>
                    {aiMessages.length === 0 ? (
                      <SupportQuickPrompts
                        locale={locale}
                        contextTitle={routeContext?.title}
                        articles={(contextArticles.length ? contextArticles : ["po-exceptions", "new-rfq", "business-central"]
                          .map((id) => articles.find((article) => article.id === id))
                          .filter((article): article is HelpArticle => Boolean(article))).slice(0, 3)}
                        onPick={(question) => {
                          setAiQuestion(question);
                          window.setTimeout(() => aiInputRef.current?.focus(), 0);
                        }}
                      />
                    ) : null}
                    {contextChanged ? (
                      <p className="support-ai-context-changed" role="status">
                        {fi ? "Näkymä vaihtui. Seuraava kysymys käyttää tämän sivun kontekstia."
                            : "The page changed. Your next question uses this page's context."}
                      </p>
                    ) : null}
                    {aiMessages.length ? (
                      <div ref={aiThreadRef} className="support-ai-thread" aria-live="polite">
                        {aiMessages.map((item) => (
                          <div
                            key={item.id}
                            className={`support-ai-message ${item.role === "user" ? "is-user" : "is-assistant"}`}
                          >
                            <span>
                              {item.role === "user"
                                ? fi
                                  ? "Sinä"
                                  : "You"
                                : "Averomira AI"}
                            </span>
                            <p>{item.text}</p>
                            {item.role === "assistant" && item.recordVerified ? (
                              <small className="support-ai-evidence-label">
                                {fi ? "Perustuu tarkistettuun näkymän tilaan" : "Based on verified page state"}
                              </small>
                            ) : null}

                            {item.role === "assistant" && item.articleIds?.length ? (
                              <div className="support-ai-related">
                                {item.articleIds
                                  .map((articleId) =>
                                    articles.find((article) => article.id === articleId),
                                  )
                                  .filter((article): article is HelpArticle => Boolean(article))
                                  .map((article) => (
                                    <button
                                      key={article.id}
                                      type="button"
                                      onClick={() => { setArticleReturnView("home"); setView({ kind: "article", articleId: article.id }); }}
                                    >
                                      {article.title} <ArrowIcon />
                                    </button>
                                  ))}
                              </div>
                            ) : null}
                          </div>
                        ))}

                        {aiAsking ? (
                          <div className="support-ai-thinking">
                            <span aria-hidden="true" />
                            {fi ? "Averomira AI hakee vastausta…" : "Averomira AI is checking…"}
                          </div>
                        ) : null}
                      </div>
                    ) : null}


                    {aiError ? <p className="support-ai-error" role="alert">{aiError}</p> : null}
                    {aiMessages.some((item) => item.role === "assistant") || aiError ? (
                      <button
                        type="button"
                        className="support-ai-escalate"
                        onClick={openContactFromAi}
                      >
                        {fi ? "Luo tukipyyntö tästä keskustelusta" : "Create a support request from this conversation"}
                        <ArrowIcon />
                      </button>
                    ) : null}
                  </div>

                  <div className="support-ai-bottom">
                    {recordContextAvailable ? (
                      <label className="support-ai-record-toggle">
                        <input
                          type="checkbox"
                          checked={useCurrentRecord}
                          onChange={(event) => setUseCurrentRecord(event.target.checked)}
                        />
                        <span>{fi
                          ? "Hyödynnä tämän näkymän tietoja (vain luku)"
                          : "Use current page data (read-only)"}</span>
                      </label>
                    ) : null}
                    <form className="support-ai-form" onSubmit={askSupportAi}>
                      <label className="sr-only" htmlFor="support-ai-question">
                        {fi ? "Kysy Averomira AI:lta" : "Ask Averomira AI"}
                      </label>
                      <textarea
                        ref={aiInputRef}
                        id="support-ai-question"
                        value={aiQuestion}
                        onChange={(event) => setAiQuestion(event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
                            event.preventDefault();
                            event.currentTarget.form?.requestSubmit();
                          }
                        }}
                        maxLength={700}
                        rows={2}
                        autoComplete="off"
                        placeholder={fi ? "Kysy Averomira AI:lta…" : "Ask Averomira AI…"}
                      />
                      <div className="support-ai-compose-bottom">
                        <span>{fi ? "AI-avustaja · vain ohjeistus" : "AI assistant · guidance only"}</span>
                        <button
                          type="submit"
                          className={"support-ai-submit-motion" + (aiAsking ? " is-working" : aiSent ? " is-success" : "")}
                          disabled={aiAsking || aiQuestion.trim().length < 3}
                          aria-label={aiAsking
                            ? (fi ? "Averomira AI hakee vastausta" : "Averomira AI is checking")
                            : (fi ? "Lähetä kysymys" : "Send question")}
                        >
                          {aiAsking ? (
                            <span className="motion-dots" aria-hidden="true"><i /><i /><i /></span>
                          ) : aiSent ? (
                            <span aria-hidden="true">✓</span>
                          ) : (
                            <span aria-hidden="true">↑</span>
                          )}
                        </button>
                      </div>
                    </form>
                    <nav className="support-home-actions" aria-label={fi ? "Tukikeskuksen navigaatio" : "Support navigation"}>
                      <button type="button" className="support-home-action"
                        onClick={() => { setView({ kind: "help" }); setQuery(""); window.setTimeout(() => searchRef.current?.focus(), 0); }}>
                        <BookIcon /><span>{fi ? "Ohjeet" : "Help"}</span>
                      </button>
                      <button type="button" className="support-home-action" onClick={() => setView({ kind: "tickets" })}>
                        <TicketIcon /><span>{fi ? "Tukipyynnöt" : "Tickets"}</span>
                        {supportUnreadCount > 0 ? <i className="support-nav-count">{supportUnreadCount > 9 ? "9+" : supportUnreadCount}</i> : null}
                      </button>
                      <button type="button" className="support-home-action" onClick={openContact}>
                        <HeadsetIcon /><span>{fi ? "Ota yhteyttä" : "Contact"}</span>
                      </button>
                    </nav>
                    <p className="support-ai-privacy">
                      {fi ? "Älä jaa salasanoja tai API-avaimia." : "Never share passwords or API keys."}
                    </p>
                  </div>
                </div>
              ) : null}

              {view.kind === "help" ? (
                <section className="support-help-library support-help-library-page">
                  <button type="button" className="support-back" onClick={() => { setView({ kind: "home" }); setQuery(""); }}>
                    <ArrowIcon left /> {fi ? "Takaisin AI-avustajaan" : "Back to AI assistant"}
                  </button>
                  <div className="support-help-library-head">
                    <div>
                      <span>{fi ? "OHJEKESKUS" : "HELP CENTER"}</span>
                      <strong>{fi ? "Etsi ohjeita" : "Find help articles"}</strong>
                    </div>
                  </div>
                  {routeContext && contextArticles.length ? (
                    <div className="support-context-section support-context-section-v2">
                      <div className="support-context-section-head">
                        <div>
                          <span>{fi ? "SUOSITELTU TÄSSÄ NÄKYMÄSSÄ" : "RECOMMENDED IN THIS VIEW"}</span>
                          <strong>{routeContext.title}</strong>
                          <p>{routeContext.description}</p>
                        </div>
                      </div>
                      <div className="support-context-links">
                        {contextArticles.slice(0, 3).map((article) => (
                          <button key={article.id} type="button"
                            onClick={() => { setArticleReturnView("help"); setView({ kind: "article", articleId: article.id }); }}>
                            <span>{article.title}</span><ArrowIcon />
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : null}
                  <label className="support-search">
                    <span className="sr-only">{fi ? "Hae ohjeista" : "Search help"}</span>
                    <svg width="17" height="17" viewBox="0 0 24 24" fill="none"
                      stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
                      <circle cx="11" cy="11" r="6.5" /><path d="m16 16 4 4" />
                    </svg>
                    <input ref={searchRef} value={query} onChange={(event) => setQuery(event.target.value)}
                      placeholder={fi ? "Hae ohjeista…" : "Search help…"} />
                  </label>
                  <div className="support-help-section">
                    <div className="support-help-section-head">
                      <span>{query.trim() ? (fi ? "Hakutulokset" : "Search results") : (fi ? "Kaikki ohjeet" : "All help articles")}</span>
                      <small>{filteredArticles.length}</small>
                    </div>
                    <div className="support-help-list">
                      {filteredArticles.map((article) => (
                        <button key={article.id} type="button" onClick={() => { setArticleReturnView("help"); setView({ kind: "article", articleId: article.id }); }}>
                          <span><strong>{article.title}</strong><small>{article.summary}</small></span>
                          <ArrowIcon />
                        </button>
                      ))}
                      {filteredArticles.length === 0 ? (
                        <div className="support-empty">
                          {fi ? "Tällä haulla ei löytynyt ohjetta." : "No help article matched this search."}
                        </div>
                      ) : null}
                    </div>
                  </div>
                </section>
              ) : null}

              {view.kind === "tickets" || view.kind === "ticket" ? (
                <SupportTicketTracker
                  locale={locale}
                  ticketId={view.kind === "ticket" ? view.ticketId : null}
                  onBack={() =>
                    setView(view.kind === "ticket" ? { kind: "tickets" } : { kind: "home" })
                  }
                  onOpenTicket={(ticketId) => setView({ kind: "ticket", ticketId })}
                  onUnreadChange={setSupportUnreadCount}
                />
              ) : null}

              {view.kind === "article" && selectedArticle ? (
                <article className="support-article">
                  <button
                    type="button"
                    className="support-back"
                    onClick={() => setView({ kind: articleReturnView })}
                  >
                    <ArrowIcon left /> {fi ? "Takaisin" : "Back"}
                  </button>
                  <div className="support-article-copy">
                    {selectedArticle.body.map((paragraph) => (
                      <p key={paragraph}>{paragraph}</p>
                    ))}
                  </div>
                  <div className="support-article-contact">
                    <span>{fi ? "Tarvitsetko vielä apua?" : "Still need help?"}</span>
                    <button type="button" onClick={openContact}>
                      {fi ? "Ota yhteyttä tukeen" : "Contact support"} <ArrowIcon />
                    </button>
                  </div>
                </article>
              ) : null}

              {view.kind === "contact" ? (
                <form className="support-contact-form" onSubmit={submitSupport}>
                  <button
                    type="button"
                    className="support-back"
                    onClick={() => setView({ kind: "home" })}
                  >
                    <ArrowIcon left /> {fi ? "Takaisin Help Centeriin" : "Back to Help Center"}
                  </button>

                  {escalationReview ? (
                    <p className="support-ai-escalation-review" role="status">
                      {fi
                        ? "Keskustelun turvallinen yhteenveto on lisätty luonnokseen. Tarkista ja muokkaa viesti ennen lähettämistä. Mitään ei ole vielä lähetetty."
                        : "A filtered conversation summary was added to this draft. Review or edit it before sending. Nothing has been sent."}
                    </p>
                  ) : null}

                  <p className="support-contact-note">
                    {fi
                      ? "Kerro mitä olit tekemässä ja mitä tapahtui. Älä lisää salasanoja, API-avaimia tai muita salaisuuksia."
                      : "Tell us what you were doing and what happened. Do not include passwords, API keys or other secrets."}
                  </p>

                  <label>
                    <span>{fi ? "Aihealue" : "Category"}</span>
                    <select value={category} onChange={(event) => setCategory(event.target.value)}>
                      <option value="product">{fi ? "Tuote ja käyttö" : "Product and usage"}</option>
                      <option value="integration">{fi ? "Integraatio" : "Integration"}</option>
                      <option value="billing">{fi ? "Laskutus" : "Billing"}</option>
                      <option value="account">{fi ? "Tili ja käyttäjät" : "Account and users"}</option>
                      <option value="other">{fi ? "Muu" : "Other"}</option>
                    </select>
                  </label>

                  <label>
                    <span>{fi ? "Aihe" : "Subject"}</span>
                    <input
                      value={subject}
                      onChange={(event) => setSubject(event.target.value)}
                      maxLength={160}
                      placeholder={
                        fi
                          ? "Esim. Business Central -vastine ei tallennu"
                          : "E.g. Business Central mapping does not save"
                      }
                    />
                  </label>

                  <label>
                    <span>{fi ? "Kuvaus" : "Description"}</span>
                    <textarea
                      value={message}
                      onChange={(event) => setMessage(event.target.value)}
                      maxLength={5000}
                      rows={6}
                      placeholder={
                        fi
                          ? "Mitä olit tekemässä, mitä odotit tapahtuvan ja mitä tapahtui?"
                          : "What were you doing, what did you expect and what happened?"
                      }
                    />
                    <small>{message.length}/5000</small>
                  </label>

                  <label className="support-file-field">
                    <span>{fi ? "Kuvakaappaus (valinnainen)" : "Screenshot (optional)"}</span>
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      onChange={(event) => setScreenshot(event.target.files?.[0] ?? null)}
                    />
                    <small>
                      {screenshot
                        ? screenshot.name
                        : fi
                          ? "PNG, JPG tai WebP · enintään 5 Mt"
                          : "PNG, JPG or WebP · max 5 MB"}
                    </small>
                  </label>

                  <div className="support-context-note">
                    <span>{fi ? "Tekninen konteksti" : "Technical context"}</span>
                    <code>{pathname}</code>
                    <p>
                      {fi
                        ? "Averomira liittää pyynnön yhteyteen nykyisen näkymän ja palvelinpyynnön tunnisteen. Dokumenttien sisältöä tai salaisuuksia ei lisätä automaattisesti."
                        : "Averomira attaches the current view and request identifier. Document contents or secrets are not attached automatically."}
                    </p>
                  </div>

                  {formError ? (
                    <p className="support-form-error" role="alert">
                      {formError}
                    </p>
                  ) : null}

                  <button
                    type="submit"
                    className="support-submit"
                    disabled={submitting}
                  >
                    {submitting
                      ? fi
                        ? "Lähetetään…"
                        : "Sending…"
                      : fi
                        ? "Lähetä tukipyyntö"
                        : "Send support request"}
                    {!submitting ? <ArrowIcon /> : null}
                  </button>
                </form>
              ) : null}

              {view.kind === "success" ? (
                <div className="support-success">
                  <div className="support-success-icon" aria-hidden="true">✓</div>
                  <strong>
                    {fi
                      ? `Tukipyyntö #${view.ticketNumber} on luotu.`
                      : `Support request #${view.ticketNumber} has been created.`}
                  </strong>
                  <p>
                    {fi
                      ? "Pyyntö on tallennettu Averomiraan. Voit seurata sen tilaa ja tuen vastauksia suoraan Help Centerissä."
                      : "The request is stored in Averomira. You can track its status and support replies directly in the Help Center."}
                  </p>
                  {!view.attachmentUploaded ? (
                    <p className="support-attachment-warning">
                      {fi
                        ? "Tukipyyntö tallentui, mutta kuvakaappausta ei saatu liitettyä."
                        : "The request was saved, but the screenshot could not be attached."}
                    </p>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => setView({ kind: "ticket", ticketId: view.ticketId })}
                  >
                    {fi ? "Avaa tukipyyntö" : "Open support request"} <ArrowIcon />
                  </button>
                  <button
                    type="button"
                    className="support-success-secondary"
                    onClick={() => setView({ kind: "home" })}
                  >
                    {fi ? "Takaisin Help Centeriin" : "Back to Help Center"}
                  </button>
                </div>
              ) : null}
            </div>
          </section>
        </div>
      ) : null}
    </>
  );
}
