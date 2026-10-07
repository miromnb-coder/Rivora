import type { Locale } from "@/lib/locale";

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <div className="v2-section-label">{children}</div>;
}

export function ProofStripV2({ locale }: { locale: Locale }) {
  const fi = locale === "fi";
  const items = [
    [fi ? "Syöte" : "Input", "PDF / XLSX / CSV"],
    [fi ? "Tarjous" : "Quote", fi ? "Tuotteet ratkaistu ja tarkistettu" : "Products resolved and reviewed"],
    [fi ? "Ostotilaus" : "Purchase order", fi ? "Quote ↔ PO -vertailu" : "Quote ↔ PO reconciliation"],
    [fi ? "ERP" : "ERP", fi ? "ERP-valmis myyntitilaus" : "ERP-ready sales order"],
  ];

  return (
    <section className="marketing-shell proof-strip-v2" aria-label="Averomira workflow proof points">
      {items.map(([label, value]) => (
        <div key={label} className="proof-strip-v2-item">
          <span>{label}</span>
          <b>{value}</b>
        </div>
      ))}
    </section>
  );
}

export function ProductResolutionV2({ locale }: { locale: Locale }) {
  const fi = locale === "fi";
  return (
    <section className="marketing-shell v2-section resolution-v3" id="resolution">
      <div className="v2-section-copy">
        <SectionLabel>{fi ? "Tuotteiden ratkaisu" : "Product resolution"}</SectionLabel>
        <h2>{fi ? "Löydä asiakkaan tuoteriville oikea myytävä tuote nopeammin." : "Resolve each customer line to the product you actually sell."}</h2>
        <p>{fi ? "Averomira vertaa asiakkaan SKU:t, vanhat tuotenimet ja valmistajakoodit omaan katalogiisi. Epävarmat osumat jäävät tarkistettaviksi ennen tarjousta." : "Averomira compares customer SKUs, legacy names and manufacturer codes against your catalogue. Uncertain matches stay visible for review before quoting."}</p>
      </div>

      <div className="product-showcase product-resolution-showcase">
        <div className="product-showcase-toolbar">
          <div>
            <span>RFQ #1048</span>
            <strong>{fi ? "Esimerkkiasiakas" : "Example customer"}</strong>
          </div>
          <span className="product-showcase-status">{fi ? "Tuoterivi ratkaistu" : "Line resolved"}</span>
        </div>

        <div className="product-resolution-grid">
          <div className="product-resolution-cell is-source">
            <span>01 · {fi ? "Asiakkaan rivi" : "Customer line"}</span>
            <strong>PUMP-37A</strong>
            <p>{fi ? "Kiertovesipumppu · 10 kpl" : "Circulation pump · 10 pcs"}</p>
          </div>

          <div className="product-resolution-memory">
            <span>02 · {fi ? "Asiakaskohtainen muisti" : "Customer memory"}</span>
            <strong>100%</strong>
            <p>{fi ? "Ihmisen vahvistama vastine" : "Human-confirmed mapping"}</p>
          </div>

          <div className="product-resolution-cell is-result">
            <span>03 · {fi ? "Myytävä tuote" : "Sellable product"}</span>
            <strong>GRU-98561418</strong>
            <p>Grundfos ALPHA2 25-60</p>
          </div>
        </div>

        <div className="product-showcase-footer">
          <span>{fi ? "Lähde säilyy näkyvissä" : "Source stays visible"}</span>
          <span>{fi ? "Vahvistettu vastine voidaan käyttää uudelleen" : "Confirmed mapping can be reused"}</span>
        </div>
      </div>
    </section>
  );
}

export function CustomerMemoryV2({ locale }: { locale: Locale }) {
  const fi = locale === "fi";
  return (
    <section className="marketing-shell v2-section memory-v3" id="memory">
      <div className="v2-section-copy">
        <SectionLabel>{fi ? "Asiakaskohtainen muisti" : "Customer memory"}</SectionLabel>
        <h2>{fi ? "Jokainen korjaus muuttuu uudelleenkäytettäväksi tiedoksi." : "Every correction becomes reusable knowledge."}</h2>
        <p>{fi ? "Kun tiimisi vahvistaa osuman, Averomira muistaa sen kyseiselle asiakkaalle ja käyttää vastinetta seuraavassa tarjouspyynnössä." : "When your team confirms a match, Averomira remembers it for that customer and applies the mapping automatically on the next RFQ."}</p>
      </div>

      <div className="product-showcase memory-showcase">
        <div className="product-showcase-toolbar">
          <div>
            <span>{fi ? "Tuotemuisti" : "Product memory"}</span>
            <strong>{fi ? "Esimerkkiasiakas" : "Example customer"}</strong>
          </div>
          <span className="product-showcase-status is-verified">{fi ? "Vahvistettu" : "Verified"}</span>
        </div>

        <div className="memory-showcase-flow">
          <div className="memory-showcase-step">
            <span>01 · {fi ? "Edellinen tarjouspyyntö" : "Previous RFQ"}</span>
            <strong>PUMP-37A</strong>
            <p>{fi ? "Käyttäjä vahvistaa tuotteen kerran." : "A user confirms the product once."}</p>
          </div>

          <div className="memory-showcase-step is-saved">
            <span>02 · {fi ? "Tallennettu vastine" : "Saved mapping"}</span>
            <strong>GRU-98561418</strong>
            <p>ALPHA2 25-60</p>
          </div>

          <div className="memory-showcase-step">
            <span>03 · {fi ? "Seuraava tarjouspyyntö" : "Next RFQ"}</span>
            <strong>100%</strong>
            <p>{fi ? "Vastine löytyy asiakaskohtaisesta muistista." : "The mapping is found from customer memory."}</p>
          </div>
        </div>

        <div className="memory-showcase-reuse">
          <span>{fi ? "Opi kerran" : "Learn once"}</span>
          <i aria-hidden="true" />
          <strong>{fi ? "käytä uudelleen seuraavassa tilauksessa" : "reuse on the next order"}</strong>
        </div>
      </div>
    </section>
  );
}

export function HowItWorksV2({ locale }: { locale: Locale }) {
  const fi = locale === "fi";
  const steps = fi ? [
    { n: "01", title: "Poimi RFQ", body: "PDF:t ja taulukot muuttuvat rakenteisiksi tuoteriveiksi, joiden lähde säilyy.", meta: "RFQ → tuoterivit" },
    { n: "02", title: "Rakenna tarjous", body: "Asiakkaan tuotekieli ratkaistaan katalogiisi ja epävarmat osumat nostetaan tarkistukseen.", meta: "Tuotemuisti + hyväksyntä" },
    { n: "03", title: "Tarkista PO", body: "Asiakkaan ostotilaus verrataan hyväksyttyyn tarjoukseen ja vain poikkeamat vaativat päätöksen.", meta: "Quote ↔ PO" },
    { n: "04", title: "Vie ERP:iin", body: "Hyväksytty tilaus valmistellaan myyntitilausluonnokseksi ja ERP-vastineet voidaan säilyttää seuraavia tilauksia varten.", meta: "Sales Order → ERP" },
  ] : [
    { n: "01", title: "Extract RFQ", body: "PDFs and spreadsheets become structured line items while preserving their source.", meta: "RFQ → line items" },
    { n: "02", title: "Build quote", body: "Customer product language is resolved to your catalogue and uncertain matches are routed to review.", meta: "Product memory + approval" },
    { n: "03", title: "Check PO", body: "The customer purchase order is reconciled with the approved quote and only exceptions need a decision.", meta: "Quote ↔ PO" },
    { n: "04", title: "Send to ERP", body: "The approved order becomes a sales order draft and ERP mappings can be retained for future orders.", meta: "Sales Order → ERP" },
  ];

  return (
    <section className="marketing-shell v2-section how-v3" id="how-it-works">
      <div className="v2-section-copy">
        <SectionLabel>{fi ? "Näin se toimii" : "How it works"}</SectionLabel>
        <h2>{fi ? "Yksi hallittu polku tarjouspyynnöstä ERP-valmiiksi tilaukseksi." : "One controlled path from RFQ to ERP-ready order."}</h2>
        <p>{fi ? "Averomira yhdistää tuoteratkaisun, tarjouksen, asiakkaan PO:n tarkistuksen ja ERP-valmistelun samaan tilauscaseen." : "Averomira connects product resolution, quoting, customer PO review and ERP preparation in one order case."}</p>
      </div>

      <div className="workflow-showcase">
        <div className="workflow-showcase-header">
          <div>
            <span>{fi ? "Tilauscase" : "Order case"}</span>
            <strong>#1048</strong>
          </div>
          <p>RFQ → Quote → PO → ERP</p>
        </div>

        <div className="workflow-showcase-track">
          {steps.map((step, index) => (
            <article key={step.n} className="workflow-showcase-stage">
              <div className="workflow-showcase-index">
                <span>{step.n}</span>
                {index < steps.length - 1 ? <i aria-hidden="true" /> : null}
              </div>
              <span className="workflow-showcase-meta">{step.meta}</span>
              <h3>{step.title}</h3>
              <p>{step.body}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

export function ConfidenceSystemV2({ locale }: { locale: Locale }) {
  const fi = locale === "fi";
  const rows = fi ? [
    ["Asiakaskohtainen muisti", "100%", "Vahvista"],
    ["Tarkka SKU", "99%", "Vahvista"],
    ["Valmistajan tuotenumero", "97%", "Vahvista"],
    ["Fuzzy-osuma", "78%", "Tarkista"],
    ["Ei osumaa", "0%", "Tarkista"],
  ] as const : [
    ["Customer memory", "100%", "Confirm"],
    ["Exact SKU", "99%", "Confirm"],
    ["Manufacturer PN", "97%", "Confirm"],
    ["Fuzzy match", "78%", "Review"],
    ["No match", "0%", "Review"],
  ] as const;

  return (
    <section className="marketing-shell v2-section confidence-v3" id="confidence">
      <div className="v2-section-copy">
        <SectionLabel>{fi ? "Varmuusjärjestelmä" : "Confidence system"}</SectionLabel>
        <h2>{fi ? "Nopeat ehdotukset, mutta kaupallinen päätös pysyy ihmisellä." : "Fast suggestions, while the commercial decision stays with your team."}</h2>
        <p>{fi ? "Averomira näyttää vahvat tuoteosumat nopeasti ja nostaa epävarmat tapaukset tarkistukseen. Tuotevalinta vahvistetaan ennen tarjousta, joten automaatio ei piilota päätöstä käyttäjältä." : "Averomira surfaces strong product matches quickly and routes uncertain cases for review. Product selection is confirmed before quoting, so automation never hides the decision from the user."}</p>
      </div>

      <div className="confidence-showcase">
        <div className="confidence-showcase-threshold">
          <div>
            <span>{fi ? "Tarkistusraja" : "Review threshold"}</span>
            <strong>90%</strong>
          </div>
          <p>{fi ? "Alle rajan oleva osuma ohjataan tarkistukseen. Vahva osuma näkyy nopeana ehdotuksena, mutta käyttäjä vahvistaa tuotteen ennen tarjousta." : "Matches below the threshold are routed to review. Strong matches are shown as fast suggestions, while the user confirms the product before quoting."}</p>
        </div>

        <div className="confidence-showcase-scale" aria-hidden="true">
          <span />
          <i />
        </div>

        <div className="confidence-showcase-head">
          <span>{fi ? "Osumamenetelmä" : "Match method"}</span>
          <span>{fi ? "Varmuus" : "Confidence"}</span>
          <span>{fi ? "Reitti" : "Route"}</span>
        </div>

        <div className="confidence-showcase-rows">
          {rows.map(([method, confidenceValue, route]) => {
            const review = route === "Review" || route === "Tarkista";
            return (
              <div key={method} className={review ? "confidence-showcase-row is-review" : "confidence-showcase-row"}>
                <span>{method}</span>
                <strong>{confidenceValue}</strong>
                <em>{route}</em>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

export function AiExtractionV2({ locale }: { locale: Locale }) {
  const fi = locale === "fi";
  return (
    <section className="marketing-shell v2-section ai-v3" id="ai-extraction">
      <div className="v2-section-copy">
        <SectionLabel>{fi ? "AI-poiminta" : "AI extraction"}</SectionLabel>
        <h2>{fi ? "AI jäsentää. Averomira näyttää perustelut. Sinä hyväksyt." : "AI structures. Averomira shows the evidence. You approve."}</h2>
        <p>{fi ? "Jokainen rivi säilyttää lähteen, poimintatuloksen, osumamenetelmän ja varmuuden näkyvissä, jotta tiimisi voi tarkistaa päätökset mustan laatikon sijaan." : "Every line keeps its source, extraction result, match method and confidence visible so your team can review decisions instead of trusting a black box."}</p>
      </div>

      <div className="product-showcase ai-showcase">
        <div className="product-showcase-toolbar">
          <div>
            <span>RFQ #1048 · {fi ? "Rivi 03" : "Line 03"}</span>
            <strong>{fi ? "Poiminta ja tuoteosuma" : "Extraction and product match"}</strong>
          </div>
          <span className="product-showcase-status">{fi ? "Valmis tarkistettavaksi" : "Ready for review"}</span>
        </div>

        <div className="ai-showcase-grid">
          <div className="ai-showcase-source">
            <span>{fi ? "Lähde · Sivu 2" : "Source · Page 2"}</span>
            <strong>PUMP-37A</strong>
            <p>Circulation pump</p>
            <small>10 {fi ? "kpl" : "pcs"}</small>
          </div>

          <div className="ai-showcase-evidence">
            <div>
              <span>01</span>
              <p>{fi ? "Poiminta" : "Extraction"}</p>
              <strong>96%</strong>
            </div>
            <div>
              <span>02</span>
              <p>{fi ? "Tarkka SKU" : "Exact SKU"}</p>
              <strong>99%</strong>
            </div>
            <div>
              <span>03</span>
              <p>{fi ? "Lähde säilytetty" : "Source preserved"}</p>
              <strong>✓</strong>
            </div>
          </div>

          <div className="ai-showcase-decision">
            <span>{fi ? "Ehdotettu tuote" : "Suggested product"}</span>
            <strong>GRU-98561418</strong>
            <p>Grundfos ALPHA2 25-60</p>
            <div>
              <span>{fi ? "Menetelmä" : "Method"} · {fi ? "Tarkka SKU" : "Exact SKU"}</span>
              <b>99%</b>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export function BeforeAfterV2({ locale }: { locale: Locale }) {
  const fi = locale === "fi";
  const before = fi ? [
    "Avaa RFQ ja etsi tuotteet", "Rakenna tarjous", "Odota asiakkaan PO:ta", "Vertaa rivejä käsin", "Etsi ERP-tuotenumerot", "Syötä myyntitilaus ERP:iin",
  ] : [
    "Open RFQ and search products", "Build the quote", "Wait for customer PO", "Compare lines manually", "Find ERP item numbers", "Enter the sales order in ERP",
  ];

  const after = fi ? [
    "Lataa RFQ", "Tarkista vain epävarmat tuotteet", "Lähetä tarjous", "Lataa PO", "Ratkaise vain poikkeamat", "Luo myyntitilaus ERP:iin",
  ] : [
    "Upload RFQ", "Review only uncertain products", "Send quote", "Upload PO", "Resolve only exceptions", "Create the sales order in ERP",
  ];

  return (
    <section className="marketing-shell v2-section before-after-v2" id="before-after">
      <div className="v2-section-copy">
        <SectionLabel>{fi ? "Ennen / jälkeen" : "Before / after"}</SectionLabel>
        <h2>{fi ? "Vähemmän hyppimistä järjestelmien välillä." : "Less jumping between systems."}</h2>
        <p>{fi ? "Sama tilauscase jatkuu tarjouspyynnöstä asiakkaan PO:hon ja edelleen ERP:iin. Käyttäjä tekee vain ne päätökset, joita automaatio ei voi tehdä turvallisesti." : "The same order case continues from RFQ to customer PO and into ERP. The user only makes decisions automation cannot safely make."}</p>
      </div>

      <div className="before-after-grid">
        <div className="before-after-column before">
          <div className="before-after-title">
            <span>{fi ? "Ilman Averomiraa" : "Without Averomira"}</span>
            <small>{fi ? "Hajanaiset työvaiheet" : "Fragmented workflow"}</small>
          </div>
          <ol>
            {before.map((item, index) => (
              <li key={item}>
                <span>{String(index + 1).padStart(2, "0")}</span>
                <b>{item}</b>
              </li>
            ))}
          </ol>
        </div>

        <div className="before-after-column after">
          <div className="before-after-title">
            <span>{fi ? "Averomiran kanssa" : "With Averomira"}</span>
            <small>{fi ? "Yksi tilauspolku" : "One order workflow"}</small>
          </div>
          <ol>
            {after.map((item, index) => (
              <li key={item}>
                <span>{String(index + 1).padStart(2, "0")}</span>
                <b>{item}</b>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}

export function FinalCtaV2({ locale }: { locale: Locale }) {
  const fi = locale === "fi";
  return (
    <section className="marketing-shell final-cta-v2" id="get-started">
      <div className="final-cta-v2-card">
        <div className="final-cta-v2-shader" aria-hidden="true" />
        <div className="final-cta-v2-content">
          <SectionLabel>{fi ? "Aloita pilotilla" : "Start with a pilot"}</SectionLabel>
          <h2>{fi ? "Vie seuraava asiakastilaus RFQ:sta ERP:iin yhdellä hallitulla polulla." : "Run your next customer order from RFQ to ERP in one controlled flow."}</h2>
          <p>{fi ? "Aloita Averomira Pilot oikealla tarjouspyynnöllä ja näe, kuinka paljon käsityötä voidaan poistaa ilman että tärkeät hyväksynnät katoavat." : "Start the Averomira Pilot with a real RFQ and see how much manual work can be removed without losing important approvals."}</p>

          <div className="final-cta-v2-actions">
            <a href="#pricing" className="final-cta-v2-primary">
              {fi ? "Aloita Averomira Pilot" : "Start Averomira Pilot"} <span aria-hidden="true">→</span>
            </a>
            <a href="#demo" className="final-cta-v2-secondary">
              {fi ? "Keskustele pilotista" : "Discuss the pilot"}
            </a>
          </div>

          <div className="final-cta-v2-meta">
            <span>PDF / XLSX / CSV</span>
            <i />
            <span>{fi ? "Ihmisen hyväksyntä" : "Human approval"}</span>
            <i />
            <span>{fi ? "RFQ → Quote → PO → ERP" : "RFQ → Quote → PO → ERP"}</span>
          </div>
        </div>
      </div>
    </section>
  );
}
