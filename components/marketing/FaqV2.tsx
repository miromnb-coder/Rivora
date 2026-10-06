"use client";

import { useState } from "react";
import type { Locale } from "@/lib/locale";

type FaqItem = {
  question: string;
  answer: string;
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

  return (
    <section className="marketing-shell v2-section faq-v2" id="faq" aria-labelledby="faq-v2-title">
      <div className="faq-v2-layout">
        <div className="faq-v2-intro">
          <div className="v2-section-label">{fi ? "Kysymykset" : "Questions"}</div>
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
        </div>
      </div>
    </section>
  );
}
