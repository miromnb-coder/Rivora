"use client";

import type { FormEvent } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import type { Locale } from "@/lib/locale";

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
  | { kind: "success"; ticketNumber: number; attachmentUploaded: boolean };

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

export function SupportCenter({ locale }: { locale: Locale }) {
  const fi = locale === "fi";
  const pathname = usePathname();
  const articles = helpArticles[locale];
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<PanelView>({ kind: "home" });
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("product");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [screenshot, setScreenshot] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);

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
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };

    document.addEventListener("keydown", onKeyDown);
    document.body.classList.add("support-center-open");

    const timer = window.setTimeout(() => {
      if (view.kind === "home") searchRef.current?.focus();
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
        ticketNumber?: number;
        attachmentUploaded?: boolean;
        error?: string;
      };

      if (!response.ok || !result.ticketNumber) {
        throw new Error(
          result.error ||
            (fi
              ? "Tukipyyntöä ei voitu lähettää."
              : "The support request could not be sent."),
        );
      }

      const ticketNumber = result.ticketNumber;
      const attachmentUploaded = result.attachmentUploaded !== false;
      resetContact();
      setView({ kind: "success", ticketNumber, attachmentUploaded });
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
        className="support-launcher"
        aria-label={fi ? "Avaa Averomira Help Center" : "Open Averomira Help Center"}
        aria-expanded={open}
        onClick={() => {
          setOpen(true);
          if (view.kind === "success") setView({ kind: "home" });
        }}
      >
        <HelpIcon />
        <span>{fi ? "Apua?" : "Help"}</span>
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
                      : view.kind === "success"
                        ? fi
                          ? "Pyyntö vastaanotettu"
                          : "Request received"
                        : selectedArticle?.title || (fi ? "Ohje" : "Help")}
                </h2>
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
                  <p className="support-center-intro">
                    {fi
                      ? "Hae ohjeista tai lähetä tukipyyntö suoraan Averomirasta."
                      : "Search the help articles or send a support request directly from Averomira."}
                  </p>

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
                      <span>{fi ? "Ohjeet" : "Help articles"}</span>
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

                  <div className="support-contact-card">
                    <span>{fi ? "Etkö löytänyt vastausta?" : "Couldn't find the answer?"}</span>
                    <strong>{fi ? "Ota yhteyttä Averomira-tukeen." : "Contact Averomira Support."}</strong>
                    <p>
                      {fi
                        ? "Lähetä kuvaus ongelmasta. Nykyinen sovellusnäkymä liitetään turvallisena teknisenä kontekstina."
                        : "Describe the issue. The current app view is attached as safe technical context."}
                    </p>
                    <button type="button" onClick={openContact}>
                      {fi ? "Lähetä tukipyyntö" : "Send support request"} <ArrowIcon />
                    </button>
                  </div>
                </>
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
                      ? "Pyyntö on tallennettu Averomiraan. Seuraavassa tukivaiheessa voit seurata vastauksia suoraan sovelluksessa."
                      : "The request is stored in Averomira. A later support phase will add in-app reply tracking."}
                  </p>
                  {!view.attachmentUploaded ? (
                    <p className="support-attachment-warning">
                      {fi
                        ? "Tukipyyntö tallentui, mutta kuvakaappausta ei saatu liitettyä."
                        : "The request was saved, but the screenshot could not be attached."}
                    </p>
                  ) : null}
                  <button type="button" onClick={() => setView({ kind: "home" })}>
                    {fi ? "Takaisin Help Centeriin" : "Back to Help Center"} <ArrowIcon />
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
