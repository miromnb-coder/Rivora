"use client";

import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { usePathname, useRouter } from "next/navigation";
import type { Locale } from "@/lib/locale";
import type { CopilotSource } from "@/lib/rivora/copilot-context";
import { sourcePath, targetFromPath } from "@/lib/rivora/copilot-navigation";

type Message = { id: number; role: "user" | "assistant"; text: string; time: number; sources?: CopilotSource[]; uncertainties?: string[]; missingInformation?: string[] };
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
  const [copiedId, setCopiedId] = useState<number | null>(null);
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
    if (!open || !overlay || !window.visualViewport) return;
    const viewport = window.visualViewport;
    const resize = () => { if (panelRef.current) { panelRef.current.style.height = `${viewport.height}px`; panelRef.current.style.top = `${viewport.offsetTop}px`; } };
    resize(); viewport.addEventListener("resize", resize); viewport.addEventListener("scroll", resize);
    return () => { viewport.removeEventListener("resize", resize); viewport.removeEventListener("scroll", resize); };
  }, [open, overlay]);
  useEffect(() => {
    if (!open) return;
    if (overlay) closeRef.current?.focus();
    const previousOverflow = document.body.style.overflow;
    if (overlay) document.body.style.overflow = "hidden";
    function handleKey(event: globalThis.KeyboardEvent) {
      if (event.key === "Escape" && (overlay || panelRef.current?.contains(document.activeElement))) { onClose(); return; }
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
    append(key, { id: ++nextId.current, role: "user", text, time: Date.now() });
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
        append(key, { id: ++nextId.current, role: "assistant", text: result.answer, time: Date.now(), sources: result.sources, uncertainties: result.uncertainties, missingInformation: result.missingInformation });
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
      const reveal = () => {
        const element = document.getElementById(hash);
        element?.scrollIntoView({ behavior: "smooth", block: "center" });
        element?.classList.add("copilot-line-highlight");
        window.setTimeout(() => element?.classList.remove("copilot-line-highlight"), 2200);
      };
      if (overlay) window.setTimeout(reveal, 50);
      else reveal();
    }
  }
  function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); void send(draft); }
  async function copyAnswer(message: Message) {
    try { await navigator.clipboard.writeText(message.text); setCopiedId(message.id); }
    catch { setError(fi ? "Kopiointi ei onnistunut." : "Could not copy the answer."); }
  }
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
          <div><div className="sales-copilot-title"><h2>Averomira AI Copilot</h2></div><div className="sales-copilot-context">{fi ? "Myynnin työtila" : "Sales workspace"}</div></div>
          <div className="sales-copilot-header-actions">
            <button type="button" onClick={newConversation} aria-label={fi ? "Uusi keskustelu" : "New conversation"} title={fi ? "Uusi keskustelu" : "New conversation"}><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true"><path d="M12 5H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-7M15 5h6m-3-3v6" /></svg></button>
            <button ref={closeRef} type="button" onClick={onClose} aria-label={fi ? "Sulje AI Copilot" : "Close AI Copilot"} title={fi ? "Sulje" : "Close"}><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true"><path d="M5 5 19 19M19 5 5 19" /></svg></button>
          </div>
        </header>
        <div ref={scrollRef} className="sales-copilot-scroll" role="log" aria-live="polite" aria-relevant="additions text">
          {verified ? <div className="sales-copilot-verified" title={fi ? "Palvelimella tarkistettu konteksti" : "Server verified context"}>{contextName}{verified.status ? ` · ${verified.status}` : ""}</div> : null}
          {messages.length === 0 ? <div className="sales-copilot-intro">
            <h3>{fi ? "Miten voin auttaa?" : "How can I help?"}</h3>
            <p>{fi ? "Voin käyttää tämän näkymän palvelimella tarkistettuja tietoja. Tarkista epävarmat tiedot ennen päätöksiä; en tee muutoksia." : "I can use server verified data for this view. Check uncertain details before decisions; I do not make changes."}</p>
            <span>{fi ? "KOKEILE KYSYÄ" : "SUGGESTED QUESTIONS"}</span>
            {starters(target.type, fi).map((item) => <button type="button" key={item} onClick={() => void send(item)} disabled={pending}>{item}<span aria-hidden="true">↗</span></button>)}
          </div> : messages.map((message) => <div key={message.id} className={`sales-copilot-message is-${message.role}`}><span>{message.role === "user" ? (fi ? "Sinä" : "You") : "AI Copilot"}</span><p>{message.text}</p>
            {message.role === "user" ? <time dateTime={new Date(message.time).toISOString()}>{new Intl.DateTimeFormat(locale, { hour: "2-digit", minute: "2-digit" }).format(message.time)}</time> : <div className="sales-copilot-message-actions"><button type="button" onClick={() => void copyAnswer(message)} aria-label={fi ? "Kopioi vastaus" : "Copy answer"}><svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true"><rect x="8" y="8" width="12" height="12" rx="2" /><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" /></svg>{copiedId === message.id ? (fi ? "Kopioitu" : "Copied") : (fi ? "Kopioi" : "Copy")}</button></div>}
            {message.sources?.length ? <div className="sales-copilot-sources">{message.sources.map((source) => <button type="button" key={`${source.recordId}:${source.lineId ?? ""}`} onClick={() => showSource(source)}>{source.lineId ? (fi ? `Näytä rivi ${source.lineNumber ?? ""} →` : `Show line ${source.lineNumber ?? ""} →`) : (fi ? "Näytä tietue →" : "Show record →")}</button>)}</div> : null}
            {message.uncertainties?.length ? <small>{fi ? "Epävarmaa: " : "Uncertain: "}{message.uncertainties.join("; ")}</small> : null}
            {message.missingInformation?.length ? <small>{fi ? "Puuttuu: " : "Missing: "}{message.missingInformation.join("; ")}</small> : null}
          </div>)}
          {pending ? <p className="sales-copilot-status" role="status">{fi ? "Analysoin tämän näkymän tietoja…" : "Analyzing data for this view…"}</p> : null}
          {error ? <p className="sales-copilot-error" role="alert">{error}</p> : null}
        </div>
        <div className="sales-copilot-bottom">
          <form onSubmit={submit}>
            <label className="sr-only" htmlFor="sales-copilot-input">{fi ? "Kysy AI Copilotilta" : "Ask AI Copilot"}</label>
            <textarea id="sales-copilot-input" value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={onKeyDown} maxLength={700} rows={2} placeholder={fi ? "Kysy AI Copilotilta…" : "Ask AI Copilot…"} />
            <button type="submit" disabled={pending || draft.trim().length < 3} aria-label={fi ? "Lähetä viesti" : "Send message"}><svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m5 12 7-7 7 7M12 5v14" /></svg></button>
          </form>
          <p>{fi ? "Vain luku · varmista päätökset itse" : "Read only · verify decisions yourself"}</p>
        </div>
      </aside>
    </>
  );
}
