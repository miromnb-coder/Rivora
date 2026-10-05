"use client";

import type { Locale } from "@/lib/locale";

export function MinimalShaderHero({ locale }: { locale: Locale }) {
  const fi = locale === "fi";

  const stages = fi
    ? [
        ["RFQ", "7 riviä", "Poimittu"],
        ["Tuotteet", "7 / 7", "Vahvistettu"],
        ["Tarjous", "Q-2026-9421E3", "Hyväksytty"],
        ["PO", "7 / 7", "Täsmää"],
      ]
    : [
        ["RFQ", "7 lines", "Extracted"],
        ["Products", "7 / 7", "Confirmed"],
        ["Quote", "Q-2026-9421E3", "Approved"],
        ["PO", "7 / 7", "Matched"],
      ];

  return (
    <section className="minimal-hero v2-hero" id="product">
      <div className="marketing-shell minimal-hero-inner v2-hero-inner">
        <div className="minimal-hero-copy">
          <span className="minimal-kicker">
            {fi ? "RFQ → tarjous → PO → ERP" : "RFQ → quote → PO → ERP"}
          </span>

          <h1>
            {fi
              ? "Tarjouspyynnöstä tarkistetuksi tilaukseksi — ilman käsin yhdistelyä."
              : "From customer RFQ to verified order — without manual stitching."}
          </h1>

          <p>
            {fi
              ? "Averomira tunnistaa tarjouspyynnön rivit, ehdottaa oikeat katalogituotteet, ohjaa epävarmat osumat tarkistukseen, rakentaa tarjouksen ja vertaa asiakkaan PO:n ennen ERP-vientiä."
              : "Averomira extracts RFQ lines, resolves them to your catalogue, routes uncertain matches for review, builds the quote and reconciles the customer PO before ERP handoff."}
          </p>

          <div className="minimal-hero-actions">
            <a href="#pricing" className="minimal-btn minimal-btn-primary">
              {fi ? "Aloita pilotti" : "Start pilot"} <span aria-hidden="true">→</span>
            </a>
            <a href="#how-it-works" className="minimal-btn minimal-btn-secondary">
              {fi ? "Katso työnkulku" : "See the workflow"}
            </a>
          </div>

          <div className="hero-conversion-note">
            <span>{fi ? "Ihminen hyväksyy tärkeät päätökset" : "Humans approve the important decisions"}</span>
            <i />
            <span>{fi ? "ERP-valmis" : "ERP ready"}</span>
          </div>

          <div className="minimal-flow" aria-label="Averomira workflow">
            <span>RFQ</span><i />
            <span>{fi ? "Tarjous" : "Quote"}</span><i />
            <span>PO</span><i />
            <span>{fi ? "Tarkistus" : "Review"}</span><i />
            <span>ERP</span>
          </div>
        </div>

        <div className="hero-product-preview" aria-label={fi ? "Esimerkki Averomiran tilauscasesta" : "Example Averomira order case"}>
          <div className="hero-product-preview-head">
            <div>
              <span>{fi ? "Tilauscase" : "Order case"}</span>
              <strong>Nordic Flow Systems Oy</strong>
            </div>
            <em>{fi ? "Valmis ERP:iin" : "ERP ready"}</em>
          </div>

          <div className="hero-product-preview-grid">
            {stages.map(([label, value, status], index) => (
              <div key={label} className="hero-product-preview-stage">
                <div className="hero-product-preview-stage-top">
                  <span>{String(index + 1).padStart(2, "0")} · {label}</span>
                  <i aria-hidden="true">✓</i>
                </div>
                <strong>{value}</strong>
                <small>{status}</small>
              </div>
            ))}
          </div>

          <div className="hero-product-preview-footer">
            <div>
              <span>{fi ? "Tuoteosumat" : "Product matches"}</span>
              <b>7 / 7</b>
              <small>{fi ? "ihmisen vahvistama" : "human confirmed"}</small>
            </div>
            <div>
              <span>{fi ? "Quote ↔ PO" : "Quote ↔ PO"}</span>
              <b>7 / 7</b>
              <small>{fi ? "riviä täsmää" : "lines match"}</small>
            </div>
            <div>
              <span>{fi ? "ERP-integraatio" : "ERP integration"}</span>
              <b>{fi ? "BC natiivisti" : "Native BC"}</b>
              <small>{fi ? "Microsoft Business Central tuettu" : "Microsoft Business Central supported"}</small>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
