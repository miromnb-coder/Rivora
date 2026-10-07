"use client";

import type { FormEvent } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import type { Locale } from "@/lib/locale";
import { supportContextForPath } from "@/lib/rivora/support-context";
import { SUPPORT_OPEN_EVENT } from "@/components/support/ContextHelpTrigger";
import { SupportTicketTracker } from "@/components/support/SupportTicketTracker";

type HelpArticle = {
  id: string;
  title: string;
  summary: string;
  body: string[];
};

type PanelView =
  | { kind: "home" }
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
  supported?: boolean;
  articleIds?: string[];
};

const helpArticles: Record<Locale, HelpArticle[]> = {
  fi: [
    {
      id: "new-rfq",
      title: "Uuden tarjouspyynnön lisääminen",
      summary: "Näin tuot asiakkaan RFQ:n Averomiraan.",
      body: [
        "Avaa Työpöydältä Uusi tarjouspyyntö. Valitse asiakas ja lisää tarjouspyynnön tiedosto.",
        "Averomira jäsentää tarjouspyynnön riveiksi ja vie sen tarkistukseen ennen kuin kaupallinen työ jatkuu.",
        "Tarkista aina poimitut määrät, tunnisteet ja epävarmat rivit ennen hyväksymistä.",
      ],
    },
    {
      id: "rfq-review",
      title: "RFQ Review ja tuoteosumat",
      summary: "Mitä tehdä, kun rivi vaatii tarkistuksen.",
      body: [
        "RFQ Review näyttää asiakkaan pyytämän rivin, ehdotetun tuotteen ja osuman perusteen.",
        "Epävarma tai muistista tullut osuma ei ohita ihmisen tarkistusta. Vahvista oikea tuote ennen tarjouksen jatkamista.",
        "Jos oikeaa tuotetta ei löydy katalogista, tarkista ensin tuotetiedot tai lisää tuote katalogiin yrityksesi prosessin mukaisesti.",
      ],
    },
    {
      id: "catalogue",
      title: "Tuotekatalogi",
      summary: "Tuotteiden lisääminen ja tuotetietojen ylläpito.",
      body: [
        "Tuotteet-näkymässä ylläpidetään Averomiran käyttämää tuotekatalogia.",
        "Pidä SKU, nimi ja mahdollinen valmistajan tuotenumero ajan tasalla, jotta tuoteosumat toimivat mahdollisimman luotettavasti.",
        "Katalogimuutokset eivät saa korvata jo hyväksytyn tarjouksen kaupallisia tietoja jälkikäteen.",
      ],
    },
    {
      id: "quotes",
      title: "Tarjouksen tarkistus ja lähetys",
      summary: "Mitä tarkistaa ennen asiakkaalle lähettämistä.",
      body: [
        "Tarkista tuotteet, määrät, hinnat, alennukset, voimassaoloaika ja vastaanottaja ennen hyväksymistä.",
        "Averomira estää keskeneräisen hinnoittelun viemisen hyväksyttyyn tarjoukseen.",
        "Hyväksymisen jälkeen kaupalliset tiedot lukitaan prosessin eheyden säilyttämiseksi.",
      ],
    },
    {
      id: "purchase-order",
      title: "Ostotilauksen tarkistaminen",
      summary: "Näin käsittelet asiakkaan PO:n ja tarjouspoikkeamat.",
      body: [
        "Averomira vertaa ostotilausta tarjoukseen ja nostaa päätöstä vaativat erot näkyviin.",
        "Tarkista erityisesti tuote, määrä, hinta, valuutta ja mahdollinen tarjousviite.",
        "Poikkeama kannattaa ratkaista ennen ERP-valmiin tilauksen muodostamista.",
      ],
    },
    {
      id: "business-central",
      title: "Microsoft Business Central",
      summary: "Yhteys, vastineet ja ERP-valmis tilaus.",
      body: [
        "Business Central -integraatio tarvitsee oikean ympäristön, käyttöoikeudet sekä asiakkaiden ja tuotteiden vastineet.",
        "Jos työjonossa näkyy Täydennä Business Central -vastineet, avaa tehtävä ja täydennä puuttuvat ERP-vastineet ennen etenemistä.",
        "Averomira ei arvaa puuttuvia vastineita hiljaisesti.",
      ],
    },
    {
      id: "smart-memory",
      title: "Älykäs muisti",
      summary: "Miten vahvistettuja tuotevastineita käytetään uudelleen.",
      body: [
        "Älykäs muisti voi hyödyntää aiemmin vahvistettuja asiakaskohtaisia tuotevastineita.",
        "Vain vahvistettua muistia saa käyttää uudelleen. Muistista tullut ehdotus pysyy silti käyttäjän tarkistettavana.",
        "Muistin tietoja voi tarkastella Asetukset-valikon Älykäs muisti -kohdasta.",
      ],
    },
    {
      id: "rfq-why-review",
      title: "Miksi tuoterivi jäi tarkistettavaksi?",
      summary: "Miten Averomira päättää, mikä vaatii ihmisen vahvistuksen.",
      body: [
        "Rivi jää tarkistettavaksi, kun Averomira ei voi vahvistaa tuotetta turvallisesti ilman ihmisen päätöstä tai kun prosessin käytäntö vaatii erillisen vahvistuksen.",
        "Tarkka SKU-osuma tai muistettu vastine voi nostaa oikean tuotteen vahvaksi ehdokkaaksi, mutta se ei ohita RFQ Review -vahvistusta.",
        "Tarkista asiakkaan tunniste, kuvaus, määrä ja ehdotetun tuotteen tiedot. Vahvista vasta, kun ehdotus vastaa asiakkaan pyyntöä.",
      ],
    },
    {
      id: "business-central-client-id",
      title: "Mistä löydän Business Centralin Client ID:n?",
      summary: "Application (client) ID löytyy Microsoft Entra -sovellusrekisteröinnistä.",
      body: [
        "Avaa Microsoft Entra -hallinnassa se App registration, jota Averomiran Business Central -yhteys käyttää.",
        "Avaa sovelluksen Overview / Yleiskatsaus. Kopioi Application (client) ID -arvo Averomiran Business Central -asetuksiin.",
        "Client ID ei ole sama asia kuin Client Secret. Älä lähetä Client Secretiä tukipyyntöön tai kuvakaappaukseen.",
      ],
    },
    {
      id: "business-central-mapping",
      title: "Miksi Business Central -vastine puuttuu?",
      summary: "Asiakas tai tuote tarvitsee vahvistetun ERP-vastineen ennen vientiä.",
      body: [
        "Averomira tarvitsee Business Centralissa käytettävän asiakasnumeron ja item-numeron ennen ERP-valmiin tilauksen vientiä.",
        "Jos vastine puuttuu tai sitä ei ole vielä vahvistettu, työjono näyttää tehtävän Täydennä Business Central -vastineet.",
        "Täytä tai tarkista vastine Business Central -vastineet -näkymässä. Averomira ei korvaa puuttuvaa ERP-tunnistetta arvaamalla.",
      ],
    },
    {
      id: "po-exceptions",
      title: "Mitä ostotilauksen poikkeama tarkoittaa?",
      summary: "Näin tulkitset PO:n ja hyväksytyn tarjouksen erot.",
      body: [
        "PO-tarkistus vertaa asiakkaan ostotilausta hyväksyttyyn tarjoukseen ja nostaa esiin kohdat, joissa tiedot eivät vastaa toisiaan.",
        "Poikkeama voi liittyä esimerkiksi tuotteeseen, määrään, hintaan, valuuttaan tai tarjousviitteeseen.",
        "Tarkista poikkeaman lähdetiedot ja tee päätös ennen hyväksyntää. ERP-valmis tilaus muodostetaan vasta tarkistetusta reconciliationista.",
      ],
    },
    {
      id: "quote-locking",
      title: "Miksi tarjouksen tiedot ovat lukittu?",
      summary: "Hyväksyntä lukitsee kaupalliset tiedot prosessin eheyden vuoksi.",
      body: [
        "Kun tarjous hyväksytään, Averomira lukitsee keskeiset kaupalliset tiedot, jotta hyväksytty sisältö ei muutu huomaamatta.",
        "Jos tarjous on vielä Ready-tilassa ja tarvitsee muutoksia, palauta se luonnokseksi ennen hyväksyntää.",
        "Jo lähetetyn tarjouksen muuttamisen sijaan käsittele tarvittava muutos yrityksesi hyväksytyn prosessin mukaisesti.",
      ],
    },
  ],
  en: [
    {
      id: "new-rfq",
      title: "Add a new RFQ",
      summary: "Bring a customer RFQ into Averomira.",
      body: [
        "From the dashboard, choose New RFQ, select the customer and add the RFQ file.",
        "Averomira structures the request into line items and routes it to review before commercial work continues.",
        "Always review extracted quantities, identifiers and uncertain lines before approval.",
      ],
    },
    {
      id: "rfq-review",
      title: "RFQ Review and product matches",
      summary: "What to do when a line needs review.",
      body: [
        "RFQ Review shows the requested line, the suggested product and why it was suggested.",
        "An uncertain or remembered match never bypasses human review. Confirm the correct product before continuing.",
        "If the right item is missing, review or update the product catalogue according to your company process.",
      ],
    },
    {
      id: "catalogue",
      title: "Product catalogue",
      summary: "Add and maintain product data.",
      body: [
        "The Products view contains the catalogue Averomira uses for matching.",
        "Keep SKU, product name and manufacturer part number current to improve matching quality.",
        "Catalogue changes must not silently rewrite commercial data on an already approved quote.",
      ],
    },
    {
      id: "quotes",
      title: "Review and send a quote",
      summary: "What to verify before sending a quote.",
      body: [
        "Review products, quantities, prices, discounts, validity and recipient before approval.",
        "Averomira prevents incomplete pricing from moving into an approved quote.",
        "After approval, core commercial fields are locked to preserve process integrity.",
      ],
    },
    {
      id: "purchase-order",
      title: "Review a purchase order",
      summary: "Handle customer POs and quote differences.",
      body: [
        "Averomira compares the purchase order with the quote and surfaces differences that require a decision.",
        "Review product, quantity, price, currency and quote reference in particular.",
        "Resolve material differences before preparing the ERP-ready order.",
      ],
    },
    {
      id: "business-central",
      title: "Microsoft Business Central",
      summary: "Connection, mappings and ERP-ready orders.",
      body: [
        "Business Central requires the correct environment, permissions and customer/product mappings.",
        "If the work queue shows Complete Business Central mappings, open the task and complete the missing ERP mappings.",
        "Averomira does not silently guess missing mappings.",
      ],
    },
    {
      id: "smart-memory",
      title: "Smart memory",
      summary: "How confirmed product mappings are reused.",
      body: [
        "Smart memory can reuse customer-specific product mappings that were confirmed earlier.",
        "Only verified memory can be reused, and a remembered suggestion still remains reviewable by the user.",
        "Memory entries can be reviewed under Settings > Smart memory.",
      ],
    },
    {
      id: "rfq-why-review",
      title: "Why does this product line need review?",
      summary: "How Averomira decides what needs human confirmation.",
      body: [
        "A line stays in review when Averomira cannot safely confirm the product without a human decision or when the workflow policy requires explicit confirmation.",
        "An exact SKU match or remembered mapping can make a product a strong candidate, but it does not bypass RFQ Review confirmation.",
        "Check the customer identifier, description, quantity and suggested product details. Confirm only when the suggestion matches the customer's request.",
      ],
    },
    {
      id: "business-central-client-id",
      title: "Where do I find the Business Central Client ID?",
      summary: "The Application (client) ID is in the Microsoft Entra app registration.",
      body: [
        "Open the App registration in Microsoft Entra that your Averomira Business Central connection uses.",
        "Open the app's Overview page and copy the Application (client) ID into the Business Central settings in Averomira.",
        "The Client ID is not the Client Secret. Do not include a Client Secret in a support request or screenshot.",
      ],
    },
    {
      id: "business-central-mapping",
      title: "Why is a Business Central mapping missing?",
      summary: "A customer or product needs a verified ERP mapping before export.",
      body: [
        "Averomira needs the Business Central customer number and item number used by the ERP before an ERP-ready order can be exported.",
        "If a mapping is missing or not yet verified, the work queue shows a Complete Business Central mappings task.",
        "Complete or verify the mapping in the Business Central mappings view. Averomira does not guess missing ERP identifiers.",
      ],
    },
    {
      id: "po-exceptions",
      title: "What does a purchase-order exception mean?",
      summary: "How to interpret differences between the PO and approved quote.",
      body: [
        "PO review compares the customer's purchase order with the approved quote and surfaces fields that do not match.",
        "An exception can involve the product, quantity, price, currency or quote reference.",
        "Review the source values and make the decision before approval. The ERP-ready order is created only from a reviewed reconciliation.",
      ],
    },
    {
      id: "quote-locking",
      title: "Why are quote fields locked?",
      summary: "Approval locks commercial data to preserve process integrity.",
      body: [
        "When a quote is approved, Averomira locks core commercial fields so approved content cannot change silently.",
        "If a quote is still Ready and needs changes, return it to draft before approval.",
        "For an already sent quote, handle the required change through your company's approved commercial process instead of silently rewriting the sent quote.",
      ],
    },
  ],
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

export function SupportCenter({ locale }: { locale: Locale }) {
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
  const [view, setView] = useState<PanelView>({ kind: "home" });
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("product");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [screenshot, setScreenshot] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");
  const [aiQuestion, setAiQuestion] = useState("");
  const [aiMessages, setAiMessages] = useState<SupportAiMessage[]>([]);
  const [aiAsking, setAiAsking] = useState(false);
  const [aiSent, setAiSent] = useState(false);
  const [aiError, setAiError] = useState("");
  const [supportUnreadCount, setSupportUnreadCount] = useState(0);
  const [showHelpLibrary, setShowHelpLibrary] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const aiInputRef = useRef<HTMLInputElement>(null);
  const aiSuccessTimerRef = useRef<number | null>(null);
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
    setAiQuestion("");
    setAiMessages([]);
    setAiSent(false);
    setAiError("");
  }, [pathname]);

  useEffect(() => {
    return () => {
      if (aiSuccessTimerRef.current) {
        window.clearTimeout(aiSuccessTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const handleContextHelp = (event: Event) => {
      const detail = (event as CustomEvent<{ articleId?: string }>).detail;
      const articleId = detail?.articleId;
      if (!articleId || !articles.some((article) => article.id === articleId)) return;

      setQuery("");
      setView({ kind: "article", articleId });
      setOpen(true);
    };

    window.addEventListener(SUPPORT_OPEN_EVENT, handleContextHelp);
    return () => window.removeEventListener(SUPPORT_OPEN_EVENT, handleContextHelp);
  }, [articles]);

  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
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

  function openContact() {
    setView({ kind: "contact" });
    setFormError("");
  }

  function openContactFromAi() {
    const lastUser = [...aiMessages].reverse().find((item) => item.role === "user");
    const conversation = aiMessages
      .slice(-6)
      .map((item) =>
        `${item.role === "user" ? (fi ? "Käyttäjä" : "User") : "Averomira AI"}: ${item.text}`,
      )
      .join("\n\n");

    if (pathname.includes("business-central")) setCategory("integration");
    else setCategory("product");

    const fallbackSubject = fi
      ? "Support AI -kysymys vaatii tarkistuksen"
      : "Support AI question needs review";
    setSubject(
      lastUser?.text
        ? `${fi ? "Support AI" : "Support AI"}: ${lastUser.text}`.slice(0, 160)
        : fallbackSubject,
    );
    setMessage(
      [
        fi
          ? "Haluan tukea seuraavaan Support AI -keskusteluun:"
          : "I need support with the following Support AI conversation:",
        conversation,
      ]
        .filter(Boolean)
        .join("\n\n")
        .slice(0, 5000),
    );
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
    };

    const previousMessages = aiMessages;
    setAiMessages([...previousMessages, userMessage]);
    setAiQuestion("");
    setAiError("");
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
          history: previousMessages.slice(-6).map((item) => ({
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
        className={"support-launcher" + (open ? " is-open" : "")}
        aria-label={fi ? "Avaa Averomira Help Center" : "Open Averomira Help Center"}
        aria-expanded={open}
        onClick={() => {
          setOpen(true);
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
        <div className="support-center-layer">
          <button
            type="button"
            className="support-center-backdrop"
            aria-label={fi ? "Sulje Help Center" : "Close Help Center"}
            onClick={() => setOpen(false)}
          />

          <section
            className="support-center-panel"
            role="dialog"
            aria-modal="true"
            aria-labelledby="support-center-title"
          >
            <header className="support-center-header">
              <div>
                <span>AVEROMIRA SUPPORT</span>
                <h2 id="support-center-title">
                  {view.kind === "home"
                    ? fi
                      ? "Miten voimme auttaa?"
                      : "How can we help?"
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
                      ? "Tuki, ohjeet ja vastaukset yhdessä paikassa."
                      : "Support, guidance and answers in one place."}
                  </p>
                ) : null}
              </div>
              <button
                type="button"
                className="support-center-close"
                onClick={() => setOpen(false)}
                aria-label={fi ? "Sulje" : "Close"}
              >
                <CloseIcon />
              </button>
            </header>

            <div className="support-center-body">
              {view.kind === "home" ? (
                <>
                  <section className="support-ai-card" aria-labelledby="support-ai-title">
                    <div className="support-ai-head">
                      <div>
                        <span>AVEROMIRA AI</span>
                        <strong id="support-ai-title">
                          {fi ? "Kysy Averomira AI:lta" : "Ask Averomira AI"}
                        </strong>
                        <p>
                          {routeContext
                            ? fi
                              ? `AI tietää, että olet näkymässä: ${routeContext.title}.`
                              : `AI knows you are in: ${routeContext.title}.`
                            : fi
                              ? "AI käyttää vain hyväksyttyä Averomira-tukitietoa."
                              : "AI uses only approved Averomira support knowledge."}
                        </p>
                      </div>
                      <span className="support-ai-readonly">
                        {fi ? "Vain ohjeet" : "Read-only"}
                      </span>
                    </div>

                    {aiMessages.length ? (
                      <div className="support-ai-thread" aria-live="polite">
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
                                      onClick={() =>
                                        setView({ kind: "article", articleId: article.id })
                                      }
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

                    <form className="support-ai-form" onSubmit={askSupportAi}>
                      <label className="sr-only" htmlFor="support-ai-question">
                        {fi ? "Kysy Averomira AI:lta" : "Ask Averomira AI"}
                      </label>
                      <input
                        ref={aiInputRef}
                        id="support-ai-question"
                        value={aiQuestion}
                        onChange={(event) => setAiQuestion(event.target.value)}
                        maxLength={700}
                        autoComplete="off"
                        placeholder={
                          fi
                            ? "Esim. miksi tämä rivi vaatii tarkistuksen?"
                            : "E.g. why does this line need review?"
                        }
                      />
                      <button
                        type="submit"
                        className={
                          "support-ai-submit-motion" +
                          (aiAsking ? " is-working" : aiSent ? " is-success" : "")
                        }
                        disabled={aiAsking || aiQuestion.trim().length < 3}
                        aria-label={
                          aiAsking
                            ? fi
                              ? "Averomira AI hakee vastausta"
                              : "Averomira AI is checking"
                            : aiSent
                              ? fi
                                ? "Vastaus valmis"
                                : "Answer ready"
                              : fi
                                ? "Lähetä kysymys"
                                : "Send question"
                        }
                      >
                        {aiAsking ? (
                          <span className="motion-dots" aria-hidden="true">
                            <i />
                            <i />
                            <i />
                          </span>
                        ) : aiSent ? (
                          <span aria-hidden="true">✓</span>
                        ) : (
                          <ArrowIcon />
                        )}
                      </button>
                    </form>

                    <div className="support-ai-meta">
                      <span>
                        {fi
                          ? "Älä lähetä salasanoja, Client Secretejä, API-avaimia tai tokeneita."
                          : "Do not send passwords, Client Secrets, API keys or tokens."}
                      </span>
                      {aiMessages.length ? (
                        <button
                          type="button"
                          onClick={() => {
                            setAiMessages([]);
                            setAiQuestion("");
                            setAiError("");
                            window.setTimeout(() => aiInputRef.current?.focus(), 0);
                          }}
                        >
                          {fi ? "Tyhjennä keskustelu" : "Clear conversation"}
                        </button>
                      ) : null}
                    </div>

                    {aiError ? (
                      <p className="support-ai-error" role="alert">
                        {aiError}
                      </p>
                    ) : null}

                    {aiMessages.some((item) => item.role === "assistant") ? (
                      <button
                        type="button"
                        className="support-ai-escalate"
                        onClick={openContactFromAi}
                      >
                        {fi
                          ? "Luo tukipyyntö tästä keskustelusta"
                          : "Create a support request from this conversation"}{" "}
                        <ArrowIcon />
                      </button>
                    ) : null}
                  </section>

                  {!query.trim() && routeContext && contextArticles.length ? (
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
                          <button
                            key={article.id}
                            type="button"
                            onClick={() => setView({ kind: "article", articleId: article.id })}
                          >
                            <span>{article.title}</span>
                            <ArrowIcon />
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  <div className="support-home-actions">
                    <button
                      type="button"
                      className="support-home-action"
                      onClick={() => {
                        setShowHelpLibrary(true);
                        window.setTimeout(() => searchRef.current?.focus(), 0);
                      }}
                    >
                      <span className="support-home-action-icon"><BookIcon /></span>
                      <span className="support-home-action-copy">
                        <strong>{fi ? "Ohjeet" : "Help articles"}</strong>
                        <small>{fi ? "Selaa oppaita ja vastauksia." : "Browse guides and answers."}</small>
                      </span>
                      <ArrowIcon />
                    </button>

                    <button
                      type="button"
                      className="support-home-action"
                      onClick={() => setView({ kind: "tickets" })}
                    >
                      <span className="support-home-action-icon"><TicketIcon /></span>
                      <span className="support-home-action-copy">
                        <strong>{fi ? "Omat tukipyynnöt" : "My support requests"}</strong>
                        <small>{fi ? "Seuraa tilaa ja vastaa tukeen." : "Track status and reply to support."}</small>
                      </span>
                      <span className="support-home-action-end">
                        {supportUnreadCount > 0 ? <i>{supportUnreadCount > 9 ? "9+" : supportUnreadCount}</i> : null}
                        <ArrowIcon />
                      </span>
                    </button>

                    <button
                      type="button"
                      className="support-home-action"
                      onClick={openContact}
                    >
                      <span className="support-home-action-icon"><HeadsetIcon /></span>
                      <span className="support-home-action-copy">
                        <strong>{fi ? "Ota yhteyttä tukeen" : "Contact support"}</strong>
                        <small>{fi ? "Lähetä tukipyyntö tiimillemme." : "Send a request to our team."}</small>
                      </span>
                      <ArrowIcon />
                    </button>
                  </div>

                  {showHelpLibrary || query.trim() ? (
                    <section className="support-help-library">
                      <div className="support-help-library-head">
                        <div>
                          <span>{fi ? "OHJEKESKUS" : "HELP CENTER"}</span>
                          <strong>{fi ? "Etsi kaikista ohjeista" : "Search all help articles"}</strong>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setShowHelpLibrary(false);
                            setQuery("");
                          }}
                        >
                          {fi ? "Sulje" : "Close"}
                        </button>
                      </div>

                      <label className="support-search">
                        <span className="sr-only">{fi ? "Hae ohjeista" : "Search help"}</span>
                        <svg
                          width="17"
                          height="17"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.8"
                          strokeLinecap="round"
                          aria-hidden="true"
                        >
                          <circle cx="11" cy="11" r="6.5" />
                          <path d="m16 16 4 4" />
                        </svg>
                        <input
                          ref={searchRef}
                          value={query}
                          onChange={(event) => setQuery(event.target.value)}
                          placeholder={fi ? "Hae ohjeista…" : "Search help…"}
                        />
                      </label>

                      <div className="support-help-section">
                        <div className="support-help-section-head">
                          <span>{query.trim() ? (fi ? "Hakutulokset" : "Search results") : (fi ? "Kaikki ohjeet" : "All help articles")}</span>
                          <small>{filteredArticles.length}</small>
                        </div>

                        <div className="support-help-list">
                          {filteredArticles.map((article) => (
                            <button
                              key={article.id}
                              type="button"
                              onClick={() => setView({ kind: "article", articleId: article.id })}
                            >
                              <span>
                                <strong>{article.title}</strong>
                                <small>{article.summary}</small>
                              </span>
                              <ArrowIcon />
                            </button>
                          ))}
                          {filteredArticles.length === 0 ? (
                            <div className="support-empty">
                              {fi
                                ? "Tällä haulla ei löytynyt ohjetta."
                                : "No help article matched this search."}
                            </div>
                          ) : null}
                        </div>
                      </div>
                    </section>
                  ) : null}
                </>
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
                    onClick={() => setView({ kind: "home" })}
                  >
                    <ArrowIcon left /> {fi ? "Kaikki ohjeet" : "All help articles"}
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
