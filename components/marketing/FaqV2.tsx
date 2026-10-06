"use client";

import { FormEvent, useState } from "react";
import type { Locale } from "@/lib/locale";

type FaqItem = {
  question: string;
  answer: string;
};

type AskResult = {
  answer: string;
  supported: boolean;
};

const faqContent: Record<Locale, FaqItem[]> = {
  fi: [
    {
      question: "Mitä Averomira tekee?",
      answer:
        "Averomira kokoaa teollisen myynnin tilauspolun yhteen: tarjouspyyntö jäsennetään tuoteriveiksi, tuotteet ratkaistaan omaan katalogiin, tarjous tarkistetaan, asiakkaan ostotilaus verrataan tarjoukseen ja hyväksytty tilaus valmistellaan ERP:iä varten.",
    },
    {
      question: "Kenelle Averomira sopii?",
      answer:
        "Averomira on tarkoitettu myynti- ja tilaustiimeille, jotka käsittelevät paljon asiakaskohtaisia tarjouspyyntöjä, tuoterivejä ja ostotilauksia ja joutuvat siirtämään samaa tietoa dokumenttien, sähköpostin ja ERP:n välillä.",
    },
    {
      question: "Mitä tiedostoja Averomira pystyy käsittelemään?",
      answer:
        "Averomiran työnkulku tukee tarjouspyyntöjen käsittelyä PDF-, XLSX- ja CSV-muodoista. Poimitut rivit säilyttävät lähdetiedon, jotta käyttäjä voi tarkistaa, mistä tieto on tullut.",
    },
    {
      question: "Miten tuoteosumat ja asiakaskohtainen muisti toimivat?",
      answer:
        "Averomira vertaa asiakkaan SKU:ita, tuotenimiä ja valmistajakoodeja omaan tuotekatalogiisi. Kun käyttäjä vahvistaa vastineen, se voidaan tallentaa asiakaskohtaiseen tuotemuistiin ja käyttää myöhemmissä tarjouspyynnöissä.",
    },
    {
      question: "Toimiiko Averomira Microsoft Business Centralin kanssa?",
      answer:
        "Averomirassa on Business Central -integraatio ERP-valmiin myyntitilausluonnoksen valmistelua varten. Käyttöönotto riippuu yrityksesi Business Central -ympäristöstä, käyttöoikeuksista ja tarvittavista tuote- ja asiakasvastineista.",
    },
    {
      question: "Tekeekö Averomira kaupalliset päätökset automaattisesti?",
      answer:
        "Ei. Vahvat osumat voidaan ehdottaa nopeasti, mutta epävarmat tuoteosumat, tarjouspoikkeamat ja muut päätöstä vaativat kohdat nostetaan käyttäjän tarkistettaviksi ennen etenemistä.",
    },
    {
      question: "Korvaako Averomira nykyisen ERP-järjestelmän?",
      answer:
        "Ei. Averomira on suunniteltu toimimaan ERP:n rinnalla. Se vähentää käsityötä ennen ERP-kirjausta ja auttaa siirtämään tarkistetun tilausdatan hallitusti nykyiseen järjestelmään.",
    },
  ],
  en: [
    {
      question: "What does Averomira do?",
      answer:
        "Averomira connects the industrial sales order flow in one place: an RFQ becomes structured line items, products are resolved against your catalogue, the quote is reviewed, the customer PO is reconciled and the approved order is prepared for ERP.",
    },
    {
      question: "Who is Averomira for?",
      answer:
        "Averomira is built for sales and order teams handling customer-specific RFQs, product lines and purchase orders that currently require the same information to be moved between documents, email and ERP systems.",
    },
    {
      question: "Which file formats can Averomira handle?",
      answer:
        "Averomira supports RFQ workflows from PDF, XLSX and CSV files. Extracted line items keep their source reference so users can review where the information came from.",
    },
    {
      question: "How do product matching and customer memory work?",
      answer:
        "Averomira compares customer SKUs, product names and manufacturer codes against your product catalogue. Once a user confirms a mapping, it can be stored as customer-specific product memory and reused on later RFQs.",
    },
    {
      question: "Does Averomira work with Microsoft Business Central?",
      answer:
        "Averomira includes a Business Central integration for preparing ERP-ready sales order drafts. Setup depends on your Business Central environment, permissions and the customer and product mappings required for your workflow.",
    },
    {
      question: "Does Averomira make commercial decisions automatically?",
      answer:
        "No. Strong matches can be suggested quickly, while uncertain product matches, quote exceptions and other decision points are routed to a user for review before the workflow continues.",
    },
    {
      question: "Does Averomira replace our ERP?",
      answer:
        "No. Averomira is designed to work alongside your ERP. It reduces manual work before ERP entry and helps move reviewed order data into the system you already use.",
    },
  ],
};

export function FaqV2({ locale }: { locale: Locale }) {
  const fi = locale === "fi";
  const items = faqContent[locale];
  const [openIndex, setOpenIndex] = useState<number | null>(0);
  const [question, setQuestion] = useState("");
  const [website, setWebsite] = useState("");
  const [askResult, setAskResult] = useState<AskResult | null>(null);
  const [askError, setAskError] = useState("");
  const [asking, setAsking] = useState(false);

  async function askAveromira(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const cleanQuestion = question.trim();
    if (cleanQuestion.length < 3 || asking) return;

    setAsking(true);
    setAskError("");
    setAskResult(null);

    try {
      const response = await fetch("/api/marketing/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: cleanQuestion,
          locale,
          website,
        }),
      });

      const data = (await response.json()) as {
        answer?: string;
        supported?: boolean;
        error?: string;
      };

      if (!response.ok || !data.answer) {
        throw new Error(
          data.error ||
            (fi
              ? "Vastausta ei saatu juuri nyt. Yritä hetken kuluttua uudelleen."
              : "No answer is available right now. Please try again shortly."),
        );
      }

      setAskResult({
        answer: data.answer,
        supported: data.supported === true,
      });
    } catch (error) {
      setAskError(
        error instanceof Error
          ? error.message
          : fi
            ? "Vastausta ei saatu juuri nyt."
            : "No answer is available right now.",
      );
    } finally {
      setAsking(false);
    }
  }

  return (
    <section className="marketing-shell v2-section faq-v2" id="faq" aria-labelledby="faq-v2-title">
      <div className="faq-v2-layout">
        <div className="faq-v2-intro">
          <div className="v2-section-label">{fi ? "Kysymykset" : "Questions"} <span className="faq-v2-preview-badge">PREVIEW</span></div>
          <h2 id="faq-v2-title">{fi ? "Usein kysyttyä Averomirasta." : "Common questions about Averomira."}</h2>
          <p>
            {fi
              ? "Lyhyet vastaukset tuotteesta, työnkulusta ja integraatioista ennen pilotin aloittamista."
              : "Short answers about the product, workflow and integrations before starting a pilot."}
          </p>
        </div>

        <div className="faq-v2-list">
          {items.map((item, index) => {
            const open = openIndex === index;
            const panelId = `faq-v2-panel-${index}`;
            const buttonId = `faq-v2-button-${index}`;

            return (
              <article className={open ? "faq-v2-item is-open" : "faq-v2-item"} key={item.question}>
                <h3>
                  <button
                    id={buttonId}
                    type="button"
                    className="faq-v2-trigger"
                    aria-expanded={open}
                    aria-controls={panelId}
                    onClick={() => setOpenIndex(open ? null : index)}
                  >
                    <span>{item.question}</span>
                    <i className="faq-v2-chevron" aria-hidden="true" />
                  </button>
                </h3>
                <div
                  id={panelId}
                  className="faq-v2-answer-wrap"
                  role="region"
                  aria-labelledby={buttonId}
                  aria-hidden={!open}
                >
                  <div className="faq-v2-answer">
                    <p>{item.answer}</p>
                  </div>
                </div>
              </article>
            );
          })}

          <div className="faq-v2-ask">
            <div className="faq-v2-ask-card">
              <div className="faq-v2-ask-heading">
                <div>
                  <span className="faq-v2-ask-eyebrow">AVEROMIRA AI</span>
                  <strong>{fi ? "Kysy jotain muuta" : "Ask something else"}</strong>
                  <p>
                    {fi
                      ? "Kysy tuotteesta, työnkulusta tai integraatioista. Vastaus perustuu vain Averomiran julkiseen tuotetietoon."
                      : "Ask about the product, workflow or integrations. Answers use only Averomira's public product knowledge."}
                  </p>
                </div>
              </div>

              <form className="faq-v2-ask-form" onSubmit={askAveromira}>
              <label className="sr-only" htmlFor="faq-v2-question">
                {fi ? "Kysy Averomirasta" : "Ask about Averomira"}
              </label>
              <input
                id="faq-v2-question"
                type="text"
                value={question}
                onChange={(event) => setQuestion(event.target.value)}
                maxLength={500}
                autoComplete="off"
                placeholder={
                  fi
                    ? "Esim. voiko Averomira käsitellä PDF-tarjouspyynnön?"
                    : "E.g. can Averomira process a PDF RFQ?"
                }
              />
              <input
                className="faq-v2-honeypot"
                type="text"
                value={website}
                onChange={(event) => setWebsite(event.target.value)}
                tabIndex={-1}
                autoComplete="off"
                aria-hidden="true"
                name="website"
              />
              <button
                type="submit"
                disabled={asking || question.trim().length < 3}
                aria-label={fi ? "Lähetä kysymys" : "Send question"}
              >
                <span>{asking ? (fi ? "Haetaan" : "Thinking") : fi ? "Kysy" : "Ask"}</span>
                <i aria-hidden="true">→</i>
              </button>
              </form>

              <div className="faq-v2-ask-status" aria-live="polite">
              {askError ? <p className="faq-v2-ask-error">{askError}</p> : null}

              {askResult ? (
                <div className={askResult.supported ? "faq-v2-ai-answer" : "faq-v2-ai-answer is-unsupported"}>
                  <span>{askResult.supported ? (fi ? "Averomira AI" : "Averomira AI") : fi ? "Rajattu vastaus" : "Limited answer"}</span>
                  <p>{askResult.answer}</p>
                  <a href="#demo">
                    {fi ? "Keskustele pilotista" : "Discuss the pilot"} <span aria-hidden="true">→</span>
                  </a>
                </div>
              ) : null}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
