"use client";

import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { usePathname, useRouter } from "next/navigation";
import type { Locale } from "@/lib/locale";
import type { CopilotSource } from "@/lib/rivora/copilot-context";
import { sourcePath, targetFromPath } from "@/lib/rivora/copilot-navigation";

type Message = { id: number; role: "user" | "assistant"; text: string; sources?: CopilotSource[]; uncertainties?: string[]; missingInformation?: string[] };
type Verified = { label: string; status?: string; incomplete?: boolean };
const starters = (type: string, fi: boolean) => {
  if (type === "rfq") return fi
    ? ["Mitkä rivit vaativat tarkistamista?", "Miksi tätä tuotetta ehdotettiin?", "Mitkä tiedot ovat epävarmoja?", "Onko tarjouspyyntö valmis tarjoukseksi?"]
    : ["Which lines need review?", "Why was this product suggested?", "Which details are uncertain?", "Is this RFQ ready for a quote?"];
  if (type === "quote") return fi
    ? ["Mitkä hinnat puuttuvat?", "Mitkä rivit sisältävät alennuksia?", "Mitä pitää tarkistaa ennen hyväksyntää?", "Mikä on tarjouksen nykyinen summa?"]
    : ["Which prices are missing?", "Which lines have discounts?", "What needs review before approval?", "What is the current quote total?"];
  if (type === "product") return fi ? ["Mitä tuotetietoja on tallennettu?", "Voiko teknisen vastaavuuden osoittaa?"] : ["What product data is saved?", "Can technical equivalence be verified?"];
  return fi ? ["Mitkä tarjouspyynnöt vaativat huomiota?", "Miten tarjouspyyntö etenee tarjoukseksi?"] : ["Which RFQs need attention?", "How does an RFQ become a quote?"];
};

export function SalesCopilot({ open, onClose, locale, workspaceId }: { open: boolean; onClose: () => void; locale: Locale; workspaceId: string }) {
  const fi = locale === "fi";
  const pathname = usePathname();
  const router = useRouter();
  const target = targetFromPath(pathname);
  const conversationKey = `${workspaceId}:${target.type}:${target.id ?? ""}`;
  const [overlay, setOverlay] = useState(false);
  const [conversations, setConversations] = useState<Record<string, Message[]>>({});
  const messages = conversations[conversationKey] ?? [];
  const [draft, setDraft] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [verified, setVerified] = useState<Verified | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const requestRef = useRef<AbortController | null>(null);
  const currentKeyRef = useRef(conversationKey);
  const nextId = useRef(0);

  useEffect(() => {
    const media = window.matchMedia("(max-width: 1199px)");
    const update = () => setOverlay(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  useEffect(() => {
    currentKeyRef.current = conversationKey;
    requestRef.current?.abort();
    requestRef.current = null;
    setPending(false);
    setDraft("");
    setError("");
    setVerified(null);
  }, [conversationKey]);
  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    const params = new URLSearchParams({ type: target.type });
    if (target.id) params.set("id", target.id);
    void fetch(`/api/copilot/ask?${params}`, { signal: controller.signal, cache: "no-store" })
      .then((response) => response.ok ? response.json() : null)
      .then((body: { context?: Verified } | null) => { if (!controller.signal.aborted) setVerified(body?.context ?? null); })
      .catch(() => { if (!controller.signal.aborted) setVerified(null); });
    return () => controller.abort();
  }, [open, conversationKey, target.type, target.id]);
  useEffect(() => { if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight; }, [messages, pending]);
  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
    const previousOverflow = document.body.style.overflow;
    if (overlay) document.body.style.overflow = "hidden";
    function handleKey(event: globalThis.KeyboardEvent) {
      if (event.key === "Escape") { onClose(); return; }
      if (event.key !== "Tab" || !overlay) return;
      const controls = panelRef.current?.querySelectorAll<HTMLElement>("button:not(:disabled), textarea:not(:disabled)");
      if (!controls?.length) return;
      const first = controls[0];
      const last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    }
    document.addEventListener("keydown", handleKey);
    return () => { document.removeEventListener("keydown", handleKey); document.body.style.overflow = previousOverflow; };
  }, [open, onClose, overlay]);
  useEffect(() => () => requestRef.current?.abort(), []);

  function append(key: string, message: Message) {
    setConversations((current) => ({ ...current, [key]: [...(current[key] ?? []), message] }));
  }
  function newConversation() {
    requestRef.current?.abort();
    requestRef.current = null;
    setPending(false);
    setConversations((current) => ({ ...current, [conversationKey]: [] }));
    setDraft("");
    setError("");
  }
  async function send(question: string) {
    const text = question.trim();
    if (pending || text.length < 3 || text.length > 700) return;
    const key = conversationKey;
    const history = messages.slice(-6).map(({ role, text }) => ({ role, text }));
    append(key, { id: ++nextId.current, role: "user", text });
    setDraft("");
    setError("");
    setPending(true);
    const controller = new AbortController();
    requestRef.current = controller;
    try {
      const response = await fetch("/api/copilot/ask", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: text, history, locale, context: target }), signal: controller.signal,
      });
      const result = await response.json() as { answer?: string; sources?: CopilotSource[]; uncertainties?: string[]; missingInformation?: string[]; context?: Verified; error?: string; requestId?: string };
      if (!response.ok || !result.answer) throw new Error(`${result.error || (fi ? "Vastaus epäonnistui." : "Could not get an answer.")}${result.requestId ? ` (${result.requestId})` : ""}`);
      if (currentKeyRef.current === key && !controller.signal.aborted) {
        append(key, { id: ++nextId.current, role: "assistant", text: result.answer, sources: result.sources, uncertainties: result.uncertainties, missingInformation: result.missingInformation });
        setVerified(result.context ?? null);
      }
    } catch (cause) {
      if (!controller.signal.aborted && currentKeyRef.current === key) setError(cause instanceof Error ? cause.message : (fi ? "Vastaus epäonnistui." : "Could not get an answer."));
    } finally {
      if (requestRef.current === controller) { requestRef.current = null; setPending(false); }
    }
  }
  function showSource(source: CopilotSource) {
    const path = sourcePath(source);
    if (!path) return;
    const [route, hash] = path.split("#");
    if (route !== pathname) { router.push(path); if (overlay) onClose(); return; }
    if (overlay) onClose();
    if (hash) {
      const element = document.getElementById(hash);
      element?.scrollIntoView({ behavior: "smooth", block: "center" });
      element?.classList.add("copilot-line-highlight");
      window.setTimeout(() => element?.classList.remove("copilot-line-highlight"), 2200);
    }
  }
  function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); void send(draft); }
  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); void send(draft); }
  }
  if (!open) return null;
  const contextName = verified?.label || ({ rfq: "RFQ", quote: fi ? "Tarjous" : "Quote", product: fi ? "Tuote" : "Product", dashboard: fi ? "Työpöytä" : "Dashboard", general: "Averomira" } as const)[target.type];
  return (
    <>
      {overlay ? <button className="sales-copilot-backdrop" type="button" aria-label={fi ? "Sulje AI Copilot" : "Close AI Copilot"} onClick={onClose} tabIndex={-1} /> : null}
      <aside id="sales-copilot" ref={panelRef} className="sales-copilot" role={overlay ? "dialog" : "complementary"} aria-modal={overlay ? true : undefined} aria-label="AI Copilot">
        <header className="sales-copilot-header">
          <div><div className="sales-copilot-title"><span className="sales-copilot-symbol" aria-hidden="true">✧</span><h2>AI Copilot</h2></div><div className="sales-copilot-context" title={verified ? (fi ? "Palvelimella tarkistettu konteksti" : "Server verified context") : undefined}>{contextName}{verified?.status ? ` · ${verified.status}` : ""}</div></div>
          <div className="sales-copilot-header-actions">
            <button type="button" onClick={newConversation} aria-label={fi ? "Uusi keskustelu" : "New conversation"} title={fi ? "Uusi keskustelu" : "New conversation"}>＋</button>
            <button ref={closeRef} type="button" onClick={onClose} aria-label={fi ? "Sulje AI Copilot" : "Close AI Copilot"} title={fi ? "Sulje" : "Close"}>×</button>
          </div>
        </header>
        <div ref={scrollRef} className="sales-copilot-scroll" role="log" aria-live="polite" aria-relevant="additions text">
          {messages.length === 0 ? <div className="sales-copilot-intro">
            <h3>{fi ? "Miten voin auttaa?" : "How can I help?"}</h3>
            <p>{fi ? "Voin käyttää tämän näkymän palvelimella tarkistettuja tietoja. Tarkista epävarmat tiedot ennen päätöksiä; en tee muutoksia." : "I can use server verified data for this view. Check uncertain details before decisions; I do not make changes."}</p>
            <span>{fi ? "KOKEILE KYSYÄ" : "SUGGESTED QUESTIONS"}</span>
            {starters(target.type, fi).map((item) => <button type="button" key={item} onClick={() => void send(item)} disabled={pending}>{item}<span aria-hidden="true">↗</span></button>)}
          </div> : messages.map((message) => <div key={message.id} className={`sales-copilot-message is-${message.role}`}><span>{message.role === "user" ? (fi ? "Sinä" : "You") : "AI Copilot"}</span><p>{message.text}</p>
            {message.sources?.length ? <div className="sales-copilot-sources">{message.sources.map((source) => <button type="button" key={`${source.recordId}:${source.lineId ?? ""}`} onClick={() => showSource(source)}>{source.lineId ? (fi ? `Näytä rivi ${source.lineNumber ?? ""} →` : `Show line ${source.lineNumber ?? ""} →`) : (fi ? "Näytä tietue →" : "Show record →")}</button>)}</div> : null}
            {message.uncertainties?.length ? <small>{fi ? "Epävarmaa: " : "Uncertain: "}{message.uncertainties.join("; ")}</small> : null}
            {message.missingInformation?.length ? <small>{fi ? "Puuttuu: " : "Missing: "}{message.missingInformation.join("; ")}</small> : null}
          </div>)}
          {pending ? <p className="sales-copilot-status" role="status">{fi ? "Haetaan vastausta…" : "Getting an answer…"}</p> : null}
          {error ? <p className="sales-copilot-error" role="alert">{error}</p> : null}
        </div>
        <div className="sales-copilot-bottom">
          <form onSubmit={submit}>
            <label className="sr-only" htmlFor="sales-copilot-input">{fi ? "Kysy AI Copilotilta" : "Ask AI Copilot"}</label>
            <textarea id="sales-copilot-input" value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={onKeyDown} maxLength={700} rows={2} placeholder={fi ? "Kysy AI Copilotilta…" : "Ask AI Copilot…"} />
            <button type="submit" disabled={pending || draft.trim().length < 3} aria-label={fi ? "Lähetä viesti" : "Send message"}>↑</button>
          </form>
          <p>{fi ? "Vain luku · varmista päätökset itse" : "Read only · verify decisions yourself"}</p>
        </div>
      </aside>
    </>
  );
}
