"use client";

import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { usePathname } from "next/navigation";
import type { Locale } from "@/lib/locale";

type Message = { id: number; role: "user" | "assistant"; text: string };

function suggestions(path: string, fi: boolean) {
  if (path.startsWith("/app/quotes")) return fi
    ? ["Miten tarkistan tarjouksen ennen hyväksyntää?", "Mitä tarjouksen tilat tarkoittavat?"]
    : ["How do I review a quote before approval?", "What do quote statuses mean?"];
  if (path.startsWith("/app/rfq") || path.startsWith("/app/inbox")) return fi
    ? ["Miten käsittelen epävarman tuoteosuman?", "Miten etenen tarjouspyynnöstä tarjoukseen?"]
    : ["How should I review an uncertain product match?", "How do I move from an RFQ to a quote?"];
  return fi
    ? ["Miten tarjouspyyntö etenee tarjoukseksi?", "Mistä aloitan tuotteiden tarkistamisen?"]
    : ["How does an RFQ become a quote?", "Where should I start reviewing products?"];
}

export function SalesCopilot({ open, onClose, locale }: { open: boolean; onClose: () => void; locale: Locale }) {
  const fi = locale === "fi";
  const pathname = usePathname();
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const requestRef = useRef<AbortController | null>(null);
  const nextId = useRef(0);

  useEffect(() => {
    const scroll = scrollRef.current;
    if (scroll) scroll.scrollTop = scroll.scrollHeight;
  }, [messages, pending]);
  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
    const previousOverflow = document.body.style.overflow;
    const mobile = window.matchMedia("(max-width: 1599px)").matches;
    if (mobile) document.body.style.overflow = "hidden";
    function handleKey(event: globalThis.KeyboardEvent) {
      if (event.key === "Escape") { onClose(); return; }
      if (event.key !== "Tab" || !window.matchMedia("(max-width: 1599px)").matches) return;
      const controls = panelRef.current?.querySelectorAll<HTMLElement>("button:not(:disabled), textarea:not(:disabled)");
      if (!controls?.length) return;
      const first = controls[0];
      const last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    }
    document.addEventListener("keydown", handleKey);
    return () => { document.removeEventListener("keydown", handleKey); document.body.style.overflow = previousOverflow; };
  }, [open, onClose]);
  useEffect(() => () => requestRef.current?.abort(), []);

  function newConversation() {
    requestRef.current?.abort();
    requestRef.current = null;
    setPending(false);
    setMessages([]);
    setDraft("");
    setError("");
  }

  async function send(question: string) {
    const text = question.trim();
    if (pending || text.length < 3 || text.length > 700) return;
    const history = messages.slice(-6).map(({ role, text }) => ({ role, text }));
    setMessages((current) => [...current, { id: ++nextId.current, role: "user", text }]);
    setDraft("");
    setError("");
    setPending(true);
    const controller = new AbortController();
    requestRef.current = controller;
    try {
      const response = await fetch("/api/copilot/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: text, history, locale }),
        signal: controller.signal,
      });
      const result = await response.json() as { answer?: string; error?: string };
      if (!response.ok || !result.answer) throw new Error(result.error || (fi ? "Vastaus epäonnistui." : "Could not get an answer."));
      setMessages((current) => [...current, { id: ++nextId.current, role: "assistant", text: result.answer! }]);
    } catch (cause) {
      if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : (fi ? "Vastaus epäonnistui." : "Could not get an answer."));
    } finally {
      if (requestRef.current === controller) { requestRef.current = null; setPending(false); }
    }
  }

  function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); void send(draft); }
  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault(); void send(draft);
    }
  }

  if (!open) return null;
  return (
    <>
      <button className="sales-copilot-backdrop" type="button" aria-label={fi ? "Sulje AI Copilot" : "Close AI Copilot"} onClick={onClose} tabIndex={-1} />
      <aside id="sales-copilot" ref={panelRef} className="sales-copilot" role="dialog" aria-modal={typeof window !== "undefined" && window.matchMedia("(max-width: 1599px)").matches ? true : undefined} aria-label="AI Copilot">
        <header className="sales-copilot-header">
          <div><span className="sales-copilot-kicker">AVEROMIRA</span><h2>✧ AI Copilot</h2></div>
          <div className="sales-copilot-header-actions">
            <button type="button" onClick={newConversation} aria-label={fi ? "Uusi keskustelu" : "New conversation"} title={fi ? "Uusi keskustelu" : "New conversation"}>＋</button>
            <button ref={closeRef} type="button" onClick={onClose} aria-label={fi ? "Sulje AI Copilot" : "Close AI Copilot"} title={fi ? "Sulje" : "Close"}>×</button>
          </div>
        </header>
        <div ref={scrollRef} className="sales-copilot-scroll" role="log" aria-live="polite" aria-relevant="additions text">
          {messages.length === 0 ? <div className="sales-copilot-intro">
            <h3>{fi ? "Kysy työnkulusta" : "Ask about your workflow"}</h3>
            <p>{fi ? "Voin neuvoa tarjouspyyntöjen, tuotteiden ja tarjousten käsittelyssä. En näe tämän sivun asiakastietoja enkä tee muutoksia puolestasi." : "I can guide you through RFQs, products and quotes. I cannot see customer data on this page or make changes for you."}</p>
            <span>{fi ? "KOKEILE KYSYÄ" : "SUGGESTED QUESTIONS"}</span>
            {suggestions(pathname, fi).map((item) => <button type="button" key={item} onClick={() => void send(item)} disabled={pending}>{item}<span aria-hidden="true">↗</span></button>)}
          </div> : messages.map((message) => <div key={message.id} className={`sales-copilot-message is-${message.role}`}><span>{message.role === "user" ? (fi ? "Sinä" : "You") : "AI Copilot"}</span><p>{message.text}</p></div>)}
          {pending ? <p className="sales-copilot-status" role="status">{fi ? "Haetaan vastausta…" : "Getting an answer…"}</p> : null}
          {error ? <p className="sales-copilot-error" role="alert">{error}</p> : null}
        </div>
        <div className="sales-copilot-bottom">
          <form onSubmit={submit}>
            <label className="sr-only" htmlFor="sales-copilot-input">{fi ? "Kysy AI Copilotilta" : "Ask AI Copilot"}</label>
            <textarea id="sales-copilot-input" value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={onKeyDown} maxLength={700} rows={3} placeholder={fi ? "Kirjoita kysymys…" : "Write a question…"} />
            <button type="submit" disabled={pending || draft.trim().length < 3} aria-label={fi ? "Lähetä viesti" : "Send message"}>↑</button>
          </form>
          <p>{fi ? "Yleistä ohjeistusta · ei pääsyä asiakastietoihin" : "General guidance · no access to customer records"}</p>
        </div>
      </aside>
    </>
  );
}
