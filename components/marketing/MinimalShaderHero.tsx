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
      </div>
    </section>
  );
}
