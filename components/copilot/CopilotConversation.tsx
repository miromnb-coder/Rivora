"use client";

import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { usePathname } from "next/navigation";
import { decodeCopilotEvent, type CopilotMessage } from "@/lib/rivora/copilot-protocol";

type DisplayMessage = CopilotMessage & {
  id: number;
  stage?: "connecting" | "responding" | "done" | "stopped" | "error";
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

function intentFor(text: string): "steps" | "options" | "general" {
  if (/\b(vaihe|seuraav|aloit|step|next|plan)/i.test(text)) return "steps";
  if (/\b(vertaa|vertail|vaihtoeh|compar|option)/i.test(text)) return "options";
  return "general";
}

function statusText(locale: "fi" | "en", stage: DisplayMessage["stage"], intent: DisplayMessage["intent"]) {
  const fi = locale === "fi";
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

export function CopilotConversation({ locale }: { locale: "fi" | "en" }) {
  const [messages, setMessages] = useState<DisplayMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
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
    const host = scrollHost.current;
    if (host && followTail.current) host.scrollTop = host.scrollHeight;
  }, [messages]);

  function scrollChanged() {
    const host = scrollHost.current;
    if (host) followTail.current = host.scrollHeight - host.scrollTop - host.clientHeight < 90;
  }

  function resetConversation() {
    requestNumber.current += 1;
    controller.current?.abort();
    controller.current = null;
    setMessages([]);
    setDraft("");
    setError("");
    setBusy(false);
    followTail.current = true;
    textarea.current?.focus();
  }

  function stop() {
    controller.current?.abort();
  }

  async function send(raw: string) {
    const question = raw.trim();
    if (busy || question.length < 2 || question.length > 1200) return;
    const current = ++requestNumber.current;
    const userId = ++nextId.current;
    const replyId = ++nextId.current;
    const previous = messages.filter(message => message.text.trim()).slice(-8)
      .map(message => ({ role: message.role, text: message.text.slice(0, 1600) }));
    const pending: DisplayMessage = {
      id: replyId, role: "assistant", text: "", stage: "connecting", intent: intentFor(question),
    };
    setMessages(prev => [...prev, { id: userId, role: "user", text: question }, pending]);
    setDraft("");
    setError("");
    setBusy(true);
    followTail.current = true;
    const abort = new AbortController();
    controller.current = abort;
    let completed = false;

    const update = (patch: Partial<DisplayMessage>) => {
      if (current !== requestNumber.current) return;
      setMessages(prev => prev.map(message =>
        message.id === replyId ? { ...message, ...patch } : message));
    };

    try {
      const response = await fetch("/api/copilot/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        credentials: "same-origin",
        signal: abort.signal,
        body: JSON.stringify({ question, history: previous, locale, area }),
      });
      if (!response.ok) {
        if (response.status === 503) throw new Error(fi ?
          "Copilotin keskustelumalli ei ole vielä käytössä tässä ympäristössä." :
          "The Copilot model is not enabled in this environment.");
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
      const decoder = new TextDecoder();
      let buffer = "";
      let answer = "";
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true }).replace(/\r\n/g, "\n");
          let boundary = buffer.indexOf("\n\n");
          while (boundary >= 0) {
            const frame = buffer.slice(0, boundary);
            buffer = buffer.slice(boundary + 2);
            const event = decodeCopilotEvent(frame);
            if (event?.type === "stage") update({ stage: event.stage });
            if (event?.type === "delta") {
              answer += event.text;
              update({ text: answer, stage: "responding" });
            }
            if (event?.type === "done") { completed = true; update({ stage: "done" }); }
            if (event?.type === "error") throw new Error(event.message);
            boundary = buffer.indexOf("\n\n");
          }
        }
      } finally {
        reader.releaseLock();
      }
      if (!completed) throw new Error(fi ? "Vastaus katkesi kesken." : "The response was interrupted.");
    } catch (cause) {
      if (current !== requestNumber.current) return;
      if (abort.signal.aborted) {
        update({ stage: "stopped" });
      } else {
        const message = cause instanceof Error ? cause.message :
          fi ? "Copilot ei pystynyt vastaamaan." : "Copilot could not respond.";
        update({ stage: "error" });
        setError(message);
        setDraft(question);
      }
    } finally {
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
        <span>{fi ? "Keskustelu" : "Conversation"}</span>
        <button type="button" onClick={resetConversation} className="ml-copilot-new"
          aria-label={fi ? "Aloita uusi keskustelu" : "Start a new conversation"}>
          <span aria-hidden="true">＋</span>{fi ? "Uusi" : "New"}
        </button>
      </div>
      <div ref={scrollHost} className="ml-copilot-body ml-copilot-transcript"
        role="log" aria-label={fi ? "Copilot-keskustelu" : "Copilot conversation"}
        aria-live="off" onScroll={scrollChanged}>
        {messages.length === 0 ? (
          <section className="ml-copilot-welcome">
            <span className="ml-copilot-welcome-mark" aria-hidden="true">✳</span>
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
                      aria-hidden="true">{message.stage === "done" ? "✓" : "✳"}</span>
                    <span>{statusText(locale, message.stage, message.intent)}</span>
                  </div>
                ) : null}
                {message.text ? <p className="ml-copilot-message-text">{message.text}</p> : null}
              </article>
            ))}
          </div>
        )}
      </div>
      <footer className="ml-copilot-composer-wrap">
        {error ? <p className="ml-copilot-error" role="alert">{error}</p> : null}
        <form onSubmit={submit} className="ml-copilot-composer">
          <label className="ml-copilot-sr-only" htmlFor="ml-copilot-input">
            {fi ? "Kysy Copilotilta" : "Ask Copilot"}
          </label>
          <textarea id="ml-copilot-input" ref={textarea} rows={2} value={draft}
            onChange={event => setDraft(event.target.value)}
            onKeyDown={onComposerKeyDown}
            maxLength={1200}
            placeholder={fi ? "Kirjoita viesti…" : "Write a message…"} />
          {busy ? (
            <button type="button" onClick={stop} className="ml-copilot-send"
              aria-label={fi ? "Pysäytä vastaus" : "Stop response"}>■</button>
          ) : (
            <button type="submit" className="ml-copilot-send"
              disabled={draft.trim().length < 2}
              aria-label={fi ? "Lähetä viesti" : "Send message"}>↑</button>
          )}
        </form>
        <p className="ml-copilot-disclaimer">{fi ?
          "Copilot ei vielä näe yrityksesi tietoja eikä tee muutoksia." :
          "Copilot cannot yet access or change your company data."}</p>
        <span className="ml-copilot-sr-only" role="status" aria-live="polite">
          {busy ? (fi ? "Copilot muodostaa vastausta" : "Copilot is responding") : ""}
        </span>
      </footer>
    </>
  );
}
