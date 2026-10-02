"use client";

import type { Locale } from "@/lib/locale";

export function MinimalShaderHero({ locale }: { locale: Locale }) {
  const fi = locale === "fi";

  return (
    <section className="minimal-hero v2-hero" id="product">
      <div className="minimal-hero-shader" aria-hidden="true">
        <span className="shader-blob shader-a" />
        <span className="shader-blob shader-b" />
        <span className="shader-blob shader-c" />
      </div>

      <div className="marketing-shell minimal-hero-inner v2-hero-inner">
        <div className="minimal-hero-copy">
          <div className="minimal-kicker">
            {fi
              ? "RFQ:sta ERP-valmiiksi tilaukseksi"
              : "From RFQ to ERP-ready order"}
          </div>

          <h1>
            {fi
              ? "Vähemmän käsityötä tarjouspyynnön ja ERP:n välissä."
              : "Less manual work between customer request and ERP."}
          </h1>

          <p>
            {fi
              ? "Averomira poimii tarjouspyynnön, ratkaisee tuotteet, auttaa rakentamaan tarjouksen, vertaa asiakkaan PO:n ja valmistaa hyväksytyn myyntitilauksen Business Centraliin."
              : "Averomira extracts the RFQ, resolves products, helps build the quote, reconciles the customer PO and prepares the approved sales order for Business Central."}
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
            <span>{fi ? "Business Central -valmis" : "Business Central ready"}</span>
          </div>

          <div className="minimal-flow" aria-label="Averomira workflow">
            <span>RFQ</span><i />
            <span>{fi ? "Tarjous" : "Quote"}</span><i />
            <span>PO</span><i />
            <span>{fi ? "Tarkistus" : "Review"}</span><i />
            <span>ERP</span>
          </div>
        </div>

        <div className="hero-proof hero-order-proof" aria-label="Averomira order workflow example">
          <div className="hero-proof-topline">
            <span>{fi ? "Tilauscase" : "Order case"}</span>
            <b>Nordic Flow Systems Oy</b>
          </div>

          <div className="hero-order-stages">
            <div className="is-done"><i>✓</i><span>RFQ</span><b>RFQ-2026-001</b></div>
            <div className="is-done"><i>✓</i><span>{fi ? "Tarjous" : "Quote"}</span><b>Q-2026-9421E3</b></div>
            <div className="is-done"><i>✓</i><span>PO</span><b>PO-2026-1001</b></div>
            <div className="is-current"><i>4</i><span>ERP</span><b>{fi ? "Valmis vientiin" : "Ready to export"}</b></div>
          </div>

          <div className="hero-order-summary">
            <div>
              <span>{fi ? "Quote ↔ PO" : "Quote ↔ PO"}</span>
              <strong>{fi ? "7/7 riviä täsmää" : "7/7 lines match"}</strong>
            </div>
            <em>{fi ? "Ei poikkeamia" : "No exceptions"}</em>
          </div>

          <div className="hero-order-action">
            <div>
              <span>Business Central</span>
              <strong>{fi ? "8/8 vastinetta tunnistettu" : "8/8 mappings identified"}</strong>
            </div>
            <b>{fi ? "Luo myyntitilaus" : "Create sales order"} →</b>
          </div>
        </div>
      </div>
    </section>
  );
}
