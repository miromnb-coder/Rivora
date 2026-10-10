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
      question: "Miten ostotilaus tarkistetaan tarjoukseen nähden?",
      answer: "Averomira vertaa saapuneen ostotilauksen rivejä tarjoukseen ja nostaa esimerkiksi määrä-, hinta- tai tuote-erot käyttäjän tarkistettaviksi ennen hyväksyntää.",
    },
    {
      question: "Mitä Averomira maksaa?",
      answer: "Averomira maksaa 790 €/kk + alv. Tilaus on kuukausittainen ilman kolmen kuukauden minimijaksoa. Sovittu käyttöönotto ja tuki sisältyvät; uudet ERP-räätälöinnit arvioidaan ja hinnoitellaan erikseen.",
    },
    {
      question: "Voiko Averomiran yhdistää muuhun ERP-järjestelmään?",
      answer: "Muun ERP:n yhdistämismahdollisuus selvitetään tapauskohtaisesti. Business Central on ainoa valmis natiivi ERP-integraatio. Uusien ERP-yhteyksien toteutettavuus ja hinta arvioidaan erikseen.",
    },
    {
      question: "Toimiiko Averomira Microsoft Business Centralin kanssa?",
      answer:
        "Kyllä. Business Central on tällä hetkellä Averomiran ainoa valmis natiivi ERP-integraatio. Myyntitilausluonnoksen siirto edellyttää käyttöönottoa, käyttöoikeuksia sekä tuote- ja asiakasvastineita.",
    },
    {
      question: "Tekeekö Averomira kaupalliset päätökset automaattisesti?",
      answer:
        "Ei. Vahvat osumat voidaan ehdottaa nopeasti, mutta epävarmat tuoteosumat, tarjouspoikkeamat ja muut päätöstä vaativat kohdat nostetaan käyttäjän tarkistettaviksi ennen etenemistä.",
    },
    {
      question: "Korvaako Averomira nykyisen ERP-järjestelmän?",
      answer:
        "Ei. Averomiran tarjouspyyntöjen käsittelyä, tarjouksia ja tilausten tarkistusta voi käyttää myös ilman ERP-integraatiota. Automaattinen ERP-siirto edellyttää tuettua ja käyttöönotettua yhteyttä.",
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
      question: "How is a purchase order checked against a quote?",
      answer: "Averomira compares incoming PO lines with the quotation and brings differences in quantity, price or product information to a user for review before approval.",
    },
    {
      question: "How much does Averomira cost?",
      answer: "Averomira costs €790/month excluding VAT. The subscription is monthly with no three-month minimum. Agreed onboarding and support are included; custom ERP integrations are assessed and priced separately.",
    },
    {
      question: "Can Averomira connect to another ERP?",
      answer: "Connections to other ERPs are considered case by case. Business Central is the only available native integration. Feasibility and pricing for new ERP connections are assessed separately.",
    },
    {
      question: "Does Averomira work with Microsoft Business Central?",
      answer:
        "Yes. Business Central is currently Averomira’s only native ERP integration. Creating a draft sales order requires configuration, permissions, and customer and product mappings.",
    },
    {
      question: "Does Averomira make commercial decisions automatically?",
      answer:
        "No. Strong matches can be suggested quickly, while uncertain product matches, quote exceptions and other decision points are routed to a user for review before the workflow continues.",
    },
    {
      question: "Does Averomira replace our ERP?",
      answer:
        "No. Averomira’s RFQ, quoting and order-review workflow can be used without an ERP integration. Automatic ERP export requires a supported and configured connection.",
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
          <div className="v2-section-label">{fi ? "Kysymykset" : "Questions"}</div>
          <h2 id="faq-v2-title">{fi ? "Usein kysyttyä Averomirasta." : "Common questions about Averomira."}</h2>
          <p>
            {fi
              ? "Lyhyet vastaukset tuotteesta, työnkulusta ja integraatioista ennen käyttöönottoa."
              : "Short answers about the product, workflow and integrations before onboarding."}
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

          <div className="faq-v2-ai-item">
            <form className="faq-v2-ai-form" onSubmit={askAveromira}>
              <label className="sr-only" htmlFor="faq-v2-question">
                {fi ? "Kysy jotain muuta tekoälyltä" : "Ask something else with AI"}
              </label>
              <input
                id="faq-v2-question"
                type="text"
                value={question}
                onChange={(event) => {
                  setQuestion(event.target.value);
                  if (askResult) setAskResult(null);
                  if (askError) setAskError("");
                }}
                maxLength={500}
                autoComplete="off"
                placeholder={fi ? "Kysy jotain muuta tekoälyltä" : "Ask something else with AI"}
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
                aria-label={
                  asking
                    ? fi
                      ? "Haetaan vastausta"
                      : "Getting answer"
                    : fi
                      ? "Lähetä kysymys tekoälylle"
                      : "Send question to AI"
                }
              >
                <span aria-hidden="true">{asking ? "···" : "→"}</span>
              </button>
            </form>

            <div className="faq-v2-ai-status" aria-live="polite" aria-atomic="true">
              {askError ? <p className="faq-v2-ai-error">{askError}</p> : null}
              {askResult ? (
                <div
                  className={
                    askResult.supported
                      ? "faq-v2-ai-response"
                      : "faq-v2-ai-response is-unsupported"
                  }
                >
                  <p>{askResult.answer}</p>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
