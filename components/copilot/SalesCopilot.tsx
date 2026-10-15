"use client";

import { useEffect, useLayoutEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { usePathname, useRouter } from "next/navigation";
import type { Locale } from "@/lib/locale";
import type { CopilotSource } from "@/lib/rivora/copilot-context";
import { sourcePath, targetFromPath } from "@/lib/rivora/copilot-navigation";

import type { WorkspaceMode } from "@/components/workspace/useWorkspaceLayout";
import { useModal } from "@/components/workspace/useModal";

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

export function SalesCopilot({ open, present, phase, mode, onClose, locale, workspaceId }: {
  open: boolean; present: boolean; phase: "closed" | "opening" | "open" | "closing";
  mode: WorkspaceMode; onClose: () => void; locale: Locale; workspaceId: string;
}) {
  const fi = locale === "fi";
  const pathname = usePathname();
  const router = useRouter();
  const target = targetFromPath(pathname);
  const conversationKey = `${workspaceId}:${target.type}:${target.id ?? ""}`;
  const overlay = mode !== "desktop";
  const [conversations, setConversations] = useState<Record<string, Message[]>>({});
  const messages = conversations[conversationKey] ?? [];
  const [draftState, updateDraft] = useState({ key: conversationKey, text: "" });
  const draft = draftState.key === conversationKey ? draftState.text : "";
  const setDraft = (text: string) => updateDraft({ key: conversationKey, text });
  const [pending, setPending] = useState(false);
  const [errorState, updateError] = useState({ key: conversationKey, text: "" });
  const error = errorState.key === conversationKey ? errorState.text : "";
  const setError = (text: string) => updateError({ key: conversationKey, text });
  const [verifiedState, updateVerified] = useState<{ key: string; value: Verified | null }>({ key: conversationKey, value: null });
  const verified = verifiedState.key === conversationKey ? verifiedState.value : null;
  const setVerified = (value: Verified | null) => updateVerified({ key: conversationKey, value });
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const [showLatest, setShowLatest] = useState(false);
  const [announcement, setAnnouncement] = useState("");
  const nearBottom = useRef(true);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const workspaceRef = useRef(workspaceId);
  const scrollRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const requestRef = useRef<AbortController | null>(null);
  const currentKeyRef = useRef(conversationKey);
  currentKeyRef.current = conversationKey;
  const nextId = useRef(0);

  useEffect(() => {
    if (workspaceRef.current !== workspaceId) {
      workspaceRef.current = workspaceId;
      setConversations({});
    }
    nearBottom.current = true;
    setShowLatest(false);
    setAnnouncement("");
    requestRef.current?.abort();
    requestRef.current = null;
    setPending(false);
    setDraft("");
    setError("");
    setVerified(null);
  }, [conversationKey, workspaceId]);
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
  useLayoutEffect(() => {
    const element = scrollRef.current;
    if (!element || !open) return;
    if (nearBottom.current) { element.scrollTop = element.scrollHeight; setShowLatest(false); }
    else setShowLatest(element.scrollHeight - element.clientHeight - element.scrollTop > 80);
  }, [messages, open]);
  useLayoutEffect(() => {
    const input = textareaRef.current;
    if (!input) return;
    input.style.height = "0px";
    input.style.height = `${Math.min(148, Math.max(62, input.scrollHeight))}px`;
  }, [draft, present]);
  useModal({ active: open && overlay, panel: panelRef, initialFocus: closeRef, onClose,
    returnFocus: () => Array.from(document.querySelectorAll<HTMLButtonElement>(".app-copilot-trigger")).find(button => button.getClientRects().length > 0) ?? document.querySelector<HTMLElement>(".app-main-v2") });
  useEffect(() => {
    if (!open || overlay) return;
    const escape = (event: globalThis.KeyboardEvent) => {
      if (!event.defaultPrevented && event.key === "Escape" && panelRef.current?.contains(document.activeElement)) {
        event.preventDefault(); onClose();
        Array.from(document.querySelectorAll<HTMLButtonElement>(".app-copilot-trigger")).find(button => button.getClientRects().length)?.focus();
      }
    };
    document.addEventListener("keydown", escape);
    return () => document.removeEventListener("keydown", escape);
  }, [open, overlay, onClose]);
  // Preserve the existing iOS keyboard fallback. visualViewport supplies one
  // visible height; dvh remains the fallback and no keyboard height is subtracted.
  useEffect(() => {
    const viewport = window.visualViewport, element = panelRef.current;
    if (!open || !overlay || !viewport || !element) return;
    const update = () => {
      element.style.setProperty("--copilot-visible-height", `${viewport.height}px`);
      element.style.setProperty("--copilot-visible-top", `${viewport.offsetTop}px`);
    };
    update(); viewport.addEventListener("resize", update); viewport.addEventListener("scroll", update);
    return () => {
      viewport.removeEventListener("resize", update); viewport.removeEventListener("scroll", update);
      element.style.removeProperty("--copilot-visible-height"); element.style.removeProperty("--copilot-visible-top");
    };
  }, [open, overlay]);
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
    if (requestRef.current || pending || text.length < 3 || text.length > 700) return;
    nearBottom.current = true;
    setShowLatest(false);
    const key = conversationKey;
    const history = messages.slice(-6).map(({ role, text }) => ({ role, text }));
    append(key, { id: ++nextId.current, role: "user", text, time: Date.now() });
    setDraft("");
    setError("");
    setPending(true);
    const controller = new AbortController();
    requestRef.current = controller;
    const timeout = window.setTimeout(() => controller.abort("timeout"), 30_000);
    try {
      const response = await fetch("/api/copilot/ask", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: text, history, locale, context: target }), signal: controller.signal,
      });
      const result = await response.json() as { answer?: string; sources?: CopilotSource[]; uncertainties?: string[]; missingInformation?: string[]; context?: Verified; error?: string; requestId?: string };
      if (response.status === 429) throw new Error(result.error || (fi ? "Kysymysraja täynnä. Yritä myöhemmin." : "Question limit reached. Try later."));
      if (!response.ok || !result.answer) throw new Error(`${result.error || (fi ? "Vastaus epäonnistui." : "Could not get an answer.")}${result.requestId ? ` (${result.requestId})` : ""}`);
      if (currentKeyRef.current === key && !controller.signal.aborted) {
        append(key, { id: ++nextId.current, role: "assistant", text: result.answer, time: Date.now(), sources: result.sources, uncertainties: result.uncertainties, missingInformation: result.missingInformation });
        setVerified(result.context ?? null);
        setAnnouncement(fi ? "Uusi Copilot-vastaus." : "New Copilot answer.");
      }
    } catch (cause) {
      if (currentKeyRef.current === key && (!controller.signal.aborted || controller.signal.reason === "timeout")) {
        const message = controller.signal.reason === "timeout" ? (fi ? "Vastaus aikakatkaistiin. Voit yrittää uudelleen." : "The request timed out. You can try again.")
          : cause instanceof TypeError ? (fi ? "Verkkoyhteys katkesi. Tarkista yhteys ja yritä uudelleen." : "Network error. Check your connection and try again.")
          : cause instanceof Error ? cause.message : (fi ? "Vastaus epäonnistui." : "Could not get an answer.");
        setError(message);
        updateDraft(current => current.key === key && current.text ? current : { key, text });
      }
    } finally {
      window.clearTimeout(timeout);
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
        element?.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth", block: "center" });
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
    if (mode !== "mobile" && event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing && event.keyCode !== 229) { event.preventDefault(); void send(draft); }
  }
  if (!present) return null;
  const contextName = verified?.label || ({ rfq: "RFQ", quote: fi ? "Tarjous" : "Quote", product: fi ? "Tuote" : "Product", dashboard: fi ? "Työpöytä" : "Dashboard", general: "Averomira" } as const)[target.type];
  return (
    <>
      {overlay && open ? <button className="sales-copilot-backdrop" data-modal-backdrop="sales-copilot" type="button" aria-label={fi ? "Sulje AI Copilot" : "Close AI Copilot"} onClick={onClose} tabIndex={-1} /> : null}
      <aside id="sales-copilot" tabIndex={-1} inert={!open} data-phase={phase} ref={panelRef} className="sales-copilot" role={overlay ? "dialog" : "complementary"} aria-modal={overlay ? true : undefined} aria-label="AI Copilot">
        <header className="sales-copilot-header">
          <div><div className="sales-copilot-title"><h2>Averomira AI Copilot</h2></div><div className="sales-copilot-context">{fi ? "Myynnin työtila" : "Sales workspace"}</div></div>
          <div className="sales-copilot-header-actions">
            <button type="button" onClick={newConversation} aria-label={fi ? "Uusi keskustelu" : "New conversation"} title={fi ? "Uusi keskustelu" : "New conversation"}><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true"><path d="M12 5H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-7M15 5h6m-3-3v6" /></svg></button>
            <button ref={closeRef} type="button" onClick={onClose} aria-label={fi ? "Sulje AI Copilot" : "Close AI Copilot"} title={fi ? "Sulje" : "Close"}><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true"><path d="M5 5 19 19M19 5 5 19" /></svg></button>
          </div>
        </header>
        <div className="sr-only" role="status">{announcement}</div>
        <div ref={scrollRef} className="sales-copilot-scroll" role="log" aria-live="off" onScroll={() => {
          const element = scrollRef.current;
          if (element) { nearBottom.current = element.scrollHeight - element.clientHeight - element.scrollTop <= 80; setShowLatest(!nearBottom.current); }
        }}>
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
          {showLatest ? <button type="button" className="sales-copilot-latest" onClick={() => {
            nearBottom.current = true; setShowLatest(false);
            scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth" });
          }}>{fi ? "Siirry uusimpaan" : "Jump to latest"}</button> : null}
          <form onSubmit={submit}>
            <label className="sr-only" htmlFor="sales-copilot-input">{fi ? "Kysy AI Copilotilta" : "Ask AI Copilot"}</label>
            <textarea ref={textareaRef} id="sales-copilot-input" value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={onKeyDown} maxLength={700} rows={1} placeholder={fi ? "Kysy AI Copilotilta…" : "Ask AI Copilot…"} />
            <button type="submit" disabled={pending || draft.trim().length < 3} aria-label={fi ? "Lähetä viesti" : "Send message"}><svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m5 12 7-7 7 7M12 5v14" /></svg></button>
          </form>
          <p>{fi ? "Vain luku · varmista päätökset itse" : "Read only · verify decisions yourself"}</p>
        </div>
      </aside>
    </>
  );
}
