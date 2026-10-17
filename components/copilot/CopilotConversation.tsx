"use client";

import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { usePathname } from "next/navigation";
import type { CopilotMessage, CopilotFindingsEvent } from "@/lib/rivora/copilot-protocol";
import type { ContextSource } from "@/lib/rivora/copilot-context/types";
import { verifiedFindingLink } from "@/lib/rivora/copilot-finding-navigation";
import { parseActiveRecordPath } from "@/lib/rivora/copilot-context/active-record";
import { buildCopilotHistory, CopilotStreamParser } from "@/lib/rivora/copilot-stream";
import { formatCopilotAnswer } from "@/lib/rivora/copilot-answer-format";

type DisplayMessage = CopilotMessage & {
  id: number;
  stage?: "retrieving" | "verifying" | "connecting" | "responding" | "done" | "stopped" | "error";
  sources?: ContextSource[];
  findings?: CopilotFindingsEvent;
  truncated?: boolean;
  intent?: "steps" | "options" | "general";
};

const prompts = {
  fi: [
    "Miten käsittelen uuden tarjouspyynnön?",
    "Mitä kannattaa tarkistaa ennen tarjousta?",
    "Miten suunnittelen seuraavat työvaiheet?",
  ],
  en: [
    "How should I handle a new RFQ?",
    "What should I check before a quote?",
    "Help me plan the next steps.",
  ],
};

function CopilotGlyph({ completed = false }: { completed?: boolean }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" width="22" height="22"
      fill="none" stroke="currentColor" strokeWidth="1.65"
      strokeLinecap="round" strokeLinejoin="round" focusable="false">
      {completed ? <path d="m5 12 4 4L19 6" /> : (
        <>
          <path d="m11.5 3 1.95 6.05L19.5 11l-6.05 1.95L11.5 19l-1.95-6.05L3.5 11l6.05-1.95L11.5 3Z" />
          <path d="m19 17 .65 1.35L21 19l-1.35.65L19 21l-.65-1.35L17 19l1.35-.65L19 17Z" />
        </>
      )}
    </svg>
  );
}

function intentFor(text: string): "steps" | "options" | "general" {
  if (/(vaihe|seuraav|aloit|step|next|plan)/i.test(text)) return "steps";
  if (/(vertaa|vertail|vaihtoeh|compar|option)/i.test(text)) return "options";
  return "general";
}

function statusText(locale: "fi" | "en", stage: DisplayMessage["stage"], intent: DisplayMessage["intent"]) {
  const fi = locale === "fi";
  if (stage === "retrieving") return fi ? "Haen työtilan tietoja" : "Retrieving workspace data";
  if (stage === "verifying") return fi ? "Tarkistan lähdetiedot" : "Verifying retrieved records";
  if (stage === "connecting") return fi ? "Yhdistän keskusteluun…" : "Connecting to the model…";
  if (stage === "responding") {
    if (intent === "steps") return fi ? "Jäsennän seuraavia vaiheita" : "Outlining next steps";
    if (intent === "options") return fi ? "Jäsennän vaihtoehtoja" : "Organizing the options";
    return fi ? "Muodostan vastausta" : "Writing a response";
  }
  if (stage === "done") return fi ? "Vastaus valmis" : "Response complete";
  if (stage === "stopped") return fi ? "Vastaus pysäytetty" : "Response stopped";
  return fi ? "Vastauksen muodostaminen epäonnistui" : "The response failed";
}

/** Safe, deliberately limited presentational markup. Never render model HTML or URLs. */
function CopilotAnswerText({ text }: { text: string }) {
  const blocks = formatCopilotAnswer(text);
  return (
    <div className="ml-copilot-answer">
      {blocks.map((block, index) => {
        const key = index + ":" + block.kind;
        if (block.kind === "heading")
          return <h3 className="ml-copilot-answer-heading" key={key}>{block.text}</h3>;
        if (block.kind === "list")
          return <ul className="ml-copilot-answer-list" key={key}>
            {block.items.map((item, i) => <li key={i}>{item}</li>)}
          </ul>;
        return <p className="ml-copilot-answer-paragraph" key={key}>{block.text}</p>;
      })}
    </div>
  );
}

/** Findings are deterministic server evidence, never generated links or actions. */
function CopilotFindings({
  value, sources, locale,
}: {
  value: CopilotFindingsEvent; sources: ContextSource[]; locale: "fi" | "en";
}) {
  const fi = locale === "fi";
  const sourceById = new Map(sources.map(source => [source.sourceId, source]));
  // No source link = no finding. Never use model-provided URLs or actions.
  const verified = value.findings.filter(item => sourceById.has(item.sourceId));
  if (!verified.length) return null;
  return (
    <section className="ml-copilot-findings" aria-label={fi ? "Havainnot ja seuraavat tehtävät" : "Findings and next steps"}>
      <h3 className="ml-copilot-findings-heading">{fi ? "Havainnot" : "Findings"}</h3>
      <ul className="ml-copilot-findings-list">
        {verified.map(item => (
          <li key={item.id} className="ml-copilot-finding">
            <span className={"ml-copilot-finding-mark is-" + item.severity} aria-hidden="true" />
            <div className="ml-copilot-finding-content">
              <strong>{item.title}</strong>
              <p>{item.explanation}</p>
            </div>
          </li>
        ))}
      </ul>
      <h3 className="ml-copilot-findings-heading">{fi ? "Seuraavaksi" : "Next steps"}</h3>
      <ol className="ml-copilot-next-list">
        {verified.map(item => {
          const source = sourceById.get(item.sourceId);
          if (!source) return null;
          const target=verifiedFindingLink(source,item.id);
          if (!target.href) return null;
          return <li key={item.id}>
            <p>{item.suggestedAction}</p>
            <a href={target.href} aria-label={(fi ? "Avaa: " : "Open: ") + source.label +
              (target.lineNumber !== null ? " · "+(fi ? "rivi " : "line ")+target.lineNumber : "")}>
              {target.lineNumber !== null
                ? (fi ? "Avaa rivi "+target.lineNumber : "Open line "+target.lineNumber)
                : (fi ? "Avaa tietue" : "Open record")}
              <span aria-hidden="true">↗</span>
            </a>
          </li>;
        })}
      </ol>
      {typeof value.inspectedCount === "number" ? (
        <p className="ml-copilot-findings-coverage">
          {value.kind === "rfq_review"
            ? (fi ? "Tarkasteltuja rivejä: " : "Lines inspected: ") +
              value.inspectedCount + (value.totalCount === null || value.totalCount === undefined
                ? "" : "/" + value.totalCount)
            : (fi ? "Tarkasteltuja tapauksia: " : "Cases inspected: ") + value.inspectedCount}
          {" · " + (fi ? "Nostettuja havaintoja: " : "Findings shown: ") + verified.length}
        </p>
      ) : null}
      {value.partial ? (
        <p className="ml-copilot-findings-partial">
          {fi
            ? "Havainnot perustuvat rajattuun aineistoon. Muitakin tarkistettavia asioita voi olla."
            : "Findings use a limited set of records. Other issues may still need review."}
        </p>
      ) : null}
    </section>
  );
}

export function CopilotConversation({
  locale, paused = false, workspaceId,
}: { locale: "fi" | "en"; paused?: boolean; workspaceId?: string }) {
  const [messages, setMessages] = useState<DisplayMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [isAtBottom, setIsAtBottom] = useState(true);
  const [pilotAvailable, setPilotAvailable] = useState(false);
  const [contextAvailable, setContextAvailable] = useState(false);
  const [activeRecordAvailable, setActiveRecordAvailable] = useState(false);
  const [rfqIntelligenceAvailable, setRfqIntelligenceAvailable] = useState(false);
  const [shareWorkspaceData, setShareWorkspaceData] = useState(false);
  const controller = useRef<AbortController | null>(null);
  const requestNumber = useRef(0);
  const nextId = useRef(0);
  const scrollHost = useRef<HTMLDivElement>(null);
  const followTail = useRef(true);
  const textarea = useRef<HTMLTextAreaElement>(null);
  const pathname = usePathname();
  const fi = locale === "fi";
  const area = pathname?.split("/")[2] || "overview";

  useEffect(() => {
    return () => { controller.current?.abort(); requestNumber.current += 1; };
  }, []);

  useEffect(() => {
    if (paused) controller.current?.abort();
  }, [paused]);

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/copilot/status", {
      cache: "no-store", credentials: "same-origin",
    }).then(response => response.ok ? response.json() : null)
      .then(status => {
        if (!cancelled && status?.available === true && status?.pilot === true)
          setPilotAvailable(true);
        if (!cancelled && status?.available === true && status?.contextAvailable === true) {
          setContextAvailable(true);
          setActiveRecordAvailable(status?.activeRecordAvailable === true);
          setRfqIntelligenceAvailable(status?.rfqIntelligenceAvailable === true);
        }
      }).catch(() => { /* Status unavailable: leave the pilot label hidden. */ });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    const node = textarea.current;
    if (!node) return;
    node.style.height = "auto";
    node.style.height = Math.min(node.scrollHeight, 152) + "px";
  }, [draft]);

  useEffect(() => {
    const host = scrollHost.current;
    if (host && followTail.current) host.scrollTop = host.scrollHeight;
  }, [messages]);

  function scrollChanged() {
    const host = scrollHost.current;
    if (host) {
      followTail.current = host.scrollHeight - host.scrollTop - host.clientHeight < 90;
      setIsAtBottom(followTail.current);
    }
  }

  function resetConversation() {
    requestNumber.current += 1;
    controller.current?.abort();
    controller.current = null;
    setMessages([]);
    setDraft("");
    setError("");
    setBusy(false);
    setShareWorkspaceData(false);
    followTail.current = true;
    setIsAtBottom(true);
    textarea.current?.focus();
  }

  function stop() {
    controller.current?.abort();
  }

  async function send(raw: string, retryLast = false) {
    const question = raw.trim();
    if (paused || busy || controller.current || question.length < 2 || question.length > 1200) return;
    const tail = messages.slice(-2);
    const canRetry = retryLast && tail.length === 2 &&
      tail[0].role === "user" && tail[0].text === question &&
      tail[1].role === "assistant" && (tail[1].stage === "error" || tail[1].stage === "stopped");
    if (retryLast && !canRetry) return;
    const baseMessages = canRetry ? messages.slice(0, -2) : messages;
    const current = ++requestNumber.current;
    const userId = ++nextId.current;
    const replyId = ++nextId.current;
    const previous = buildCopilotHistory(baseMessages);
    const pending: DisplayMessage = {
      id: replyId, role: "assistant", text: "", stage: "connecting", intent: intentFor(question),
    };
    setMessages([...baseMessages, { id: userId, role: "user", text: question }, pending]);
    setDraft("");
    setError("");
    setBusy(true);
    followTail.current = true;
    setIsAtBottom(true);
    const abort = new AbortController();
    controller.current = abort;
    let completed = false;
    let answer = "";
    let paintFrame: number | null = null;
    const update = (patch: Partial<DisplayMessage>) => {
      if (current !== requestNumber.current) return;
      setMessages(prev => prev.map(message =>
        message.id === replyId ? { ...message, ...patch } : message));
    };
    const paint = () => {
      paintFrame = null;
      if (answer) update({ text: answer, stage: "responding" });
    };
    const flushPaint = () => {
      if (paintFrame !== null) {
        cancelAnimationFrame(paintFrame);
        paintFrame = null;
      }
      if (answer) update({ text: answer });
    };

    try {
      const response = await fetch("/api/copilot/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        credentials: "same-origin",
        signal: abort.signal,
        body: JSON.stringify({ question, history: previous, locale, area,
          useWorkspaceData: contextAvailable && shareWorkspaceData,
          workspaceId: workspaceId ?? null,
          activeRecord: contextAvailable && shareWorkspaceData && activeRecordAvailable
            ? parseActiveRecordPath(pathname) : null }),
      });
      if (!response.ok) {
        if (response.status === 503) {
          const details: unknown = await response.json().catch(() => null);
          const disabled = details && typeof details === "object" && "error" in details &&
            details.error === "Copilot is not yet enabled in this environment.";
          throw new Error(disabled ?
            (fi ? "Copilotin keskustelumalli ei ole vielä käytössä tässä ympäristössä." :
              "The Copilot model is not enabled in this environment.") :
            (fi ? "Copilot ei ole juuri nyt käytettävissä." :
              "Copilot is temporarily unavailable."));
        }
        if (response.status === 429) throw new Error(fi ?
          "Kysymysraja tuli vastaan. Kokeile myöhemmin uudelleen." :
          "Request limit reached. Please try again later.");
        const details: unknown = await response.json().catch(() => null);
        const message = details && typeof details === "object" && "error" in details &&
          typeof details.error === "string" ? details.error : "";
        throw new Error(message || (fi ? "Kysymyksen lähetys epäonnistui." : "Could not send the question."));
      }
      if (!response.body) throw new Error(fi ? "Suoratoisto ei ole käytettävissä." : "Streaming is unavailable.");
      const reader = response.body.getReader();
      const parser = new CopilotStreamParser();
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) { parser.finish(); break; }
          for (const event of parser.push(value)) {
            if (completed)
              throw new Error("Unexpected data after response completion.");
            if (event.type === "stage") update({ stage: event.stage });
            if (event.type === "delta") {
              answer += event.text;
              if (paintFrame === null)
                paintFrame = requestAnimationFrame(paint);
            }
            if (event.type === "sources") {
              update({ sources:event.sources, truncated:event.truncated });
            }
            if (event.type === "findings") {
              update({ findings:event });
            }
            if (event.type === "done") {
              flushPaint();
              completed = true;
              update({ stage: "done" });
            }
            if (event.type === "error") throw new Error(event.message);
          }
        }
      } finally {
        reader.releaseLock();
      }
      if (!completed) throw new Error(fi ? "Vastaus katkesi kesken." : "The response was interrupted.");

    } catch (cause) {
      if (current !== requestNumber.current) return;
      flushPaint();
      if (abort.signal.aborted) {
        update({ stage: "stopped" });
      } else {
        const message = cause instanceof Error ? cause.message :
          fi ? "Copilot ei pystynyt vastaamaan." : "Copilot could not respond.";
        update({ stage: "error" });
        setError(message);
        setDraft(existing => existing || question);
      }
    } finally {
      if (paintFrame !== null) cancelAnimationFrame(paintFrame);
      if (current === requestNumber.current) {
        setBusy(false);
        controller.current = null;
      }
    }
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void send(draft);
  }

  function onComposerKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      void send(draft);
    }
  }

  return (
    <>
      <div className="ml-copilot-conversation-toolbar">
        <div className="ml-copilot-toolbar-title">
          <span>{fi ? "Keskustelu" : "Conversation"}</span>
          {pilotAvailable ? <span className="ml-copilot-pilot-label">
            {fi ? "AI-koekäyttö" : "AI pilot"}
          </span> : null}
        </div>
        <button type="button" onClick={resetConversation} className="ml-copilot-new"
          aria-label={fi ? "Aloita uusi keskustelu" : "Start a new conversation"}>
          <span aria-hidden="true">＋</span>{fi ? "Uusi" : "New"}
        </button>
      </div>
      <div ref={scrollHost} className="ml-copilot-body ml-copilot-transcript"
        role="log" aria-label={fi ? "Copilot-keskustelu" : "Copilot conversation"}
        aria-live="off" aria-busy={busy} onScroll={scrollChanged}>
        {messages.length === 0 ? (
          <section className="ml-copilot-welcome">
            <h2>{fi ? "Mitä haluaisit selvittää?" : "What can I help you think through?"}</h2>
            <p>{fi ?
              "Jäsennä työvaiheita, pohdi vaihtoehtoja ja suunnittele seuraavat askeleet." :
              "Work through steps, compare options and plan what comes next."}</p>
            <div className="ml-copilot-prompt-list">
              {prompts[locale].map(prompt => (
                <button type="button" key={prompt} onClick={() => void send(prompt)}>{prompt}
                  <span aria-hidden="true">↗</span>
                </button>
              ))}
            </div>
          </section>
        ) : (
          <div className="ml-copilot-messages">
            {messages.map(message => (
              <article key={message.id} className={"ml-copilot-message ml-copilot-message-" + message.role}>
                {message.role === "assistant" ? (
                  <div className="ml-copilot-process">
                    <span className={"ml-copilot-process-mark" +
                      (message.stage === "connecting" || message.stage === "responding" ? " is-active" : "")}
                      aria-hidden="true"><CopilotGlyph completed={message.stage === "done"} /></span>
                    <span>{statusText(locale, message.stage, message.intent)}</span>
                  </div>
                ) : null}
                {message.text ? (message.role === "assistant"
                  ? <CopilotAnswerText text={message.text} />
                  : <p className="ml-copilot-message-text">{message.text}</p>) : null}
                {message.role === "assistant" && message.stage === "done" &&
                  message.findings && message.sources ? (
                  <CopilotFindings value={message.findings} sources={message.sources} locale={locale} />
                ) : null}
                {message.role === "assistant" && message.stage === "done" &&
                  message.sources && message.sources.length>0 ? (
                  <div className="ml-copilot-context-sources">
                    <span>{fi ? "Haetut lähteet" : "Retrieved records"}
                      {message.truncated ? (fi ? " · Rajattu tulos" : " · Partial results") : ""}
                    </span>
                    {message.truncated ? (
                      <p className="ml-copilot-context-limited">
                        {fi ? "Näytetyt rivit tai tuote-ehdokkaat ovat rajattu otos."
                          : "The displayed lines or product candidates are a limited sample."}
                      </p>
                    ) : null}
                    {message.sources.map(source=>(
                      <a key={source.sourceId} href={source.href}>
                        {source.label || source.kind} <span aria-hidden="true">↗</span>
                      </a>
                    ))}
                  </div>
                ) : null}
                {message.role === "assistant" && (message.stage === "error" || message.stage === "stopped") &&
                  messages[messages.length - 1]?.id === message.id ? (
                  <button type="button" className="ml-copilot-retry"
                    onClick={() => void send(messages[messages.length - 2].text, true)}>
                    {fi ? "Yritä uudelleen" : "Retry response"} <span aria-hidden="true">↗</span>
                  </button>
                ) : null}
              </article>
            ))}
          </div>
        )}
      </div>
      <footer className="ml-copilot-composer-wrap">
        {!isAtBottom && messages.length > 0 ? (
          <button type="button" className="ml-copilot-scroll-latest" onClick={() => {
            followTail.current = true;
            setIsAtBottom(true);
            scrollHost.current?.scrollTo({ top: scrollHost.current.scrollHeight, behavior: "auto" });
          }}>{fi ? "↓ Uusimmat viestit" : "↓ Latest messages"}</button>
        ) : null}
        {error ? <p className="ml-copilot-error" role="alert">{error}</p> : null}
        <form onSubmit={submit} className="ml-copilot-composer">
          <label className="ml-copilot-sr-only" htmlFor="ml-copilot-input">
            {fi ? "Kysy Copilotilta" : "Ask Copilot"}
          </label>
          <textarea id="ml-copilot-input" ref={textarea} rows={1} value={draft}
            onChange={event => setDraft(event.target.value)}
            onKeyDown={onComposerKeyDown}
            maxLength={1200}
            placeholder={fi ? "Kirjoita viesti…" : "Write a message…"} />
          <div className="ml-copilot-composer-actions">
            {busy ? (
              <button type="button" onClick={stop} className="ml-copilot-send ml-copilot-stop"
                aria-label={fi ? "Pysäytä vastaus" : "Stop response"}>
                <svg aria-hidden="true" width="19" height="19" viewBox="0 0 24 24" fill="currentColor">
                  <rect x="7" y="7" width="10" height="10" rx="2" />
                </svg>
              </button>
            ) : (
              <button type="submit" className="ml-copilot-send"
                disabled={draft.trim().length < 2}
                aria-label={fi ? "Lähetä viesti" : "Send message"}>
                <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24"
                  fill="none" stroke="currentColor" strokeWidth="1.8"
                  strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 19V5m-6 6 6-6 6 6" />
                </svg>
              </button>
            )}
          </div>
        </form>
        {contextAvailable ? (
          <label className="ml-copilot-context-opt">
            <input type="checkbox" checked={shareWorkspaceData}
              onChange={event=>{
                if (!event.target.checked) resetConversation();
                setShareWorkspaceData(event.target.checked);
              }}/>
            <span>{fi ? "Salli työtilan tietojen käyttö tässä keskustelussa (tietoja lähetetään AI-mallille)" :
              "Allow workspace data to be sent to the AI model in this conversation"}</span>
          </label>
        ) : null}
        <p className="ml-copilot-disclaimer">{fi ?
          (contextAvailable && shareWorkspaceData ? (rfqIntelligenceAvailable && parseActiveRecordPath(pathname)?.kind === "rfq"
            ? "Copilot voi lukea tämän tarjouspyynnön rajattuja tietoja, mutta ei tee muutoksia."
            : "Copilot voi hakea rajattuja tilausasioita, mutta ei tee muutoksia.") :
          "Copilot ei vielä näe yrityksesi tietoja eikä tee muutoksia.") :
          (contextAvailable && shareWorkspaceData ? (rfqIntelligenceAvailable && parseActiveRecordPath(pathname)?.kind === "rfq"
            ? "Copilot can read limited data from this RFQ, but cannot change it."
            : "Copilot may retrieve limited order data but never changes it.") :
          "Copilot cannot yet access or change your company data.")}</p>
        <span className="ml-copilot-sr-only" role="status" aria-live="polite">
          {busy ? (fi ? "Copilot muodostaa vastausta" : "Copilot is responding")
            : messages[messages.length - 1]?.stage === "done" ?
              (fi ? "Vastaus on valmis" : "Response complete") : ""}
        </span>
      </footer>
    </>
  );
}
