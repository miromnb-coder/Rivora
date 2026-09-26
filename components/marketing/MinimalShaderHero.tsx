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
          <div className="minimal-kicker">{fi ? "Tarjouspyyntöautomaatio teollisille myyntitiimeille" : "RFQ automation for industrial sales teams"}</div>
          <h1>{fi ? "Muuta saapuvat tarjouspyynnöt tarjousvalmiiksi tuoteriveiksi." : "Turn incoming RFQs into quote-ready product lines."}</h1>
          <p>{fi ? "Lataa asiakkaan PDF tai taulukko. Nodra poimii tuoterivit, ratkaisee asiakkaan tuotekoodit katalogiasi vasten, merkitsee epävarmuuden ja oppii vahvistetuista osumista." : "Upload a customer PDF or spreadsheet. Nodra extracts the line items, resolves customer product codes against your catalogue, flags uncertainty and learns from confirmed matches."}</p>

          <div className="minimal-hero-actions">
            <a href="#pricing" className="minimal-btn minimal-btn-primary">{fi ? "Aloita pilotti" : "Start pilot"} <span aria-hidden="true">→</span></a>
            <a href="#resolution" className="minimal-btn minimal-btn-secondary">{fi ? "Katso ratkaistu tuoterivi" : "See a resolved line"}</a>
          </div>

          <div className="hero-conversion-note">
            <span>{fi ? "ERP-integraatiota ei tarvita aloitukseen" : "No ERP integration required to start"}</span><i />
            <span>{fi ? "Ihmisen hyväksyntä säilyy hallinnassa" : "Human approval stays in control"}</span>
          </div>

          <div className="minimal-flow" aria-label="Nodra workflow">
            <span>PDF / XLSX</span><i /><span>{fi ? "Poimi" : "Extract"}</span><i />
            <span>{fi ? "Ratkaise" : "Resolve"}</span><i /><span>{fi ? "Tarkista" : "Review"}</span><i />
            <span>{fi ? "Tarjousvalmis" : "Quote-ready"}</span>
          </div>
        </div>

        <div className="hero-proof" aria-label="Example Nodra product match">
          <div className="hero-proof-label">{fi ? "Asiakkaan rivi" : "Customer line"}</div>
          <div className="hero-proof-input"><div><b>PUMP-37A</b><span>{fi ? "Kiertovesipumppu" : "Circulation pump"}</span></div><strong>10 {fi ? "kpl" : "pcs"}</strong></div>
          <div className="hero-proof-arrow" aria-hidden="true">↓</div>
          <div className="hero-proof-label">{fi ? "Ratkaistu tuote" : "Resolved product"}</div>
          <div className="hero-proof-result"><div><b>GRU-98561418</b><span>Grundfos ALPHA2 25-60</span></div><em>99% · {fi ? "Tarkka SKU" : "Exact SKU"}</em></div>
          <div className="hero-proof-review"><span>OLD-991-A</span><i>→</i><b>78%</b><em>{fi ? "Vaatii tarkistuksen" : "Needs review"}</em></div>
        </div>
      </div>
    </section>
  );
}
