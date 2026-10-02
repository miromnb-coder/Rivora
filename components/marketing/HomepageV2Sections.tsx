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
    [fi ? "ERP" : "ERP", fi ? "Business Central -valmis myyntitilaus" : "Business Central-ready sales order"],
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
    <section className="marketing-shell v2-section" id="resolution">
      <div className="v2-section-copy">
        <SectionLabel>{fi ? "Tuotteiden ratkaisu" : "Product resolution"}</SectionLabel>
        <h2>{fi ? "Asiakkaan kieli sisään. Oma katalogisi ulos." : "Customer language in. Your catalogue out."}</h2>
        <p>{fi ? "Asiakaskohtaiset SKU:t, vanhat tuotenimet ja valmistajakoodit ratkaistaan tuotteiksi, joita tiimisi oikeasti myy." : "Customer-specific SKUs, old product names and manufacturer codes are resolved into the products your team actually sells."}</p>
      </div>

      <div className="resolution-proof">
        <div className="resolution-source">
          <span className="resolution-kicker">{fi ? "Asiakkaan rivi" : "Customer line"}</span>
          <b>PUMP-37A</b>
          <strong>{fi ? "Kiertovesipumppu" : "Circulation pump"}</strong>
          <small>10 {fi ? "kpl" : "pcs"}</small>
        </div>

        <div className="resolution-rail" aria-hidden="true">
          <span />
          <i>→</i>
          <span />
        </div>

        <div className="resolution-memory">
          <span className="resolution-kicker">{fi ? "Asiakaskohtainen muisti" : "Customer memory"}</span>
          <b>100%</b>
          <small>{fi ? "Vahvistettu vastine" : "Confirmed mapping"}</small>
        </div>

        <div className="resolution-rail" aria-hidden="true">
          <span />
          <i>→</i>
          <span />
        </div>

        <div className="resolution-result">
          <span className="resolution-kicker">{fi ? "Kanoninen tuote" : "Canonical product"}</span>
          <b>GRU-98561418</b>
          <strong>Grundfos ALPHA2 25-60</strong>
          <small>{fi ? "Tallennettu tarkka osuma" : "Exact saved match"}</small>
        </div>
      </div>
    </section>
  );
}

export function CustomerMemoryV2({ locale }: { locale: Locale }) {
  const fi = locale === "fi";
  return (
    <section className="marketing-shell v2-section memory-v2" id="memory">
      <div className="v2-section-copy">
        <SectionLabel>{fi ? "Asiakaskohtainen muisti" : "Customer memory"}</SectionLabel>
        <h2>{fi ? "Jokainen korjaus muuttuu uudelleenkäytettäväksi tiedoksi." : "Every correction becomes reusable knowledge."}</h2>
        <p>{fi ? "Kun tiimisi vahvistaa osuman, Averomira muistaa sen kyseiselle asiakkaalle ja käyttää vastinetta seuraavassa tarjouspyynnössä." : "When your team confirms a match, Averomira remembers it for that customer and applies the mapping automatically on the next RFQ."}</p>
      </div>

      <div className="memory-v2-proof">
        <div className="memory-v2-customer">
          <span>{fi ? "Esimerkkiasiakas" : "Example customer"}</span>
          <small>{fi ? "Asiakaskohtainen tuotemuisti" : "Customer-specific product memory"}</small>
        </div>

        <div className="memory-v2-flow">
          <div>
            <span>{fi ? "Edellinen tarjouspyyntö" : "Previous RFQ"}</span>
            <b>PUMP-37A</b>
            <small>{fi ? "Ihmisen vahvistama" : "Human confirmed"}</small>
          </div>

          <i aria-hidden="true">→</i>

          <div className="memory-v2-saved">
            <span>{fi ? "Tallennettu vastine" : "Saved mapping"}</span>
            <b>GRU-98561418</b>
            <small>ALPHA2 25-60</small>
          </div>

          <i aria-hidden="true">→</i>

          <div>
            <span>{fi ? "Seuraava tarjouspyyntö" : "Next RFQ"}</span>
            <b>100%</b>
            <small>{fi ? "Asiakaskohtainen muisti" : "Customer memory"}</small>
          </div>
        </div>

        <div className="memory-v2-note">
          <span>{fi ? "Opi kerran" : "Learn once"}</span>
          <i />
          <span>{fi ? "Käytä uudelleen automaattisesti" : "Reuse automatically"}</span>
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
    { n: "04", title: "Vie ERP:iin", body: "Hyväksytty tilaus valmistellaan myyntitilausluonnokseksi ja Business Central -vastineet muistetaan.", meta: "Sales Order → ERP" },
  ] : [
    { n: "01", title: "Extract RFQ", body: "PDFs and spreadsheets become structured line items while preserving their source.", meta: "RFQ → line items" },
    { n: "02", title: "Build quote", body: "Customer product language is resolved to your catalogue and uncertain matches are routed to review.", meta: "Product memory + approval" },
    { n: "03", title: "Check PO", body: "The customer purchase order is reconciled with the approved quote and only exceptions need a decision.", meta: "Quote ↔ PO" },
    { n: "04", title: "Send to ERP", body: "The approved order becomes a sales order draft and Business Central mappings are remembered.", meta: "Sales Order → ERP" },
  ];

  return (
    <section className="marketing-shell v2-section how-v2" id="how-it-works">
      <div className="v2-section-copy">
        <SectionLabel>{fi ? "Näin se toimii" : "How it works"}</SectionLabel>
        <h2>{fi ? "Yksi hallittu polku tarjouspyynnöstä ERP-valmiiksi tilaukseksi." : "One controlled path from RFQ to ERP-ready order."}</h2>
        <p>{fi ? "Averomira yhdistää tuoteratkaisun, tarjouksen, asiakkaan PO:n tarkistuksen ja ERP-valmistelun samaan tilauscaseen." : "Averomira connects product resolution, quoting, customer PO review and ERP preparation in one order case."}</p>
      </div>

      <div className="how-v2-grid">
        {steps.map((step) => (
          <article key={step.n} className="how-v2-step">
            <div className="how-v2-top">
              <span className="how-v2-number">{step.n}</span>
              <span className="how-v2-meta">{step.meta}</span>
            </div>
            <h3>{step.title}</h3>
            <p>{step.body}</p>
          </article>
        ))}
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
    <section className="marketing-shell v2-section confidence-v2" id="confidence">
      <div className="v2-section-copy">
        <SectionLabel>{fi ? "Varmuusjärjestelmä" : "Confidence system"}</SectionLabel>
        <h2>{fi ? "Automaatio siellä missä se on turvallista. Ihminen siellä missä sillä on merkitystä." : "Automation where it’s safe. Humans where it matters."}</h2>
        <p>{fi ? "Averomira ehdottaa korkean varmuuden deterministiset osumat nopeasti, mutta tuotevalinta vahvistetaan silti ennen tarjousta. Epävarmat tapaukset nostetaan selvästi tarkistukseen." : "Averomira surfaces high-confidence deterministic matches quickly, while product selection is still confirmed before quoting. Uncertain cases are clearly routed to review."}</p>
      </div>

      <div className="confidence-v2-proof">
        <div className="confidence-v2-head">
          <span>{fi ? "Osumamenetelmä" : "Match method"}</span>
          <span>{fi ? "Varmuus" : "Confidence"}</span>
          <span>{fi ? "Reitti" : "Route"}</span>
        </div>

        <div className="confidence-v2-table">
          {rows.map(([method, confidence, route]) => {
            const review = route === "Review" || route === "Tarkista";
            return (
              <div key={method} className={review ? "confidence-v2-row is-review" : "confidence-v2-row"}>
                <span>{method}</span>
                <b>{confidence}</b>
                <em>{route}</em>
              </div>
            );
          })}
        </div>

        <div className="confidence-v2-threshold">
          <span>{fi ? "Esimerkkikynnys tarkistukselle" : "Example review threshold"}</span>
          <b>90%</b>
          <div className="confidence-v2-scale" aria-hidden="true">
            <i />
            <strong />
          </div>
          <div className="confidence-v2-scale-labels">
            <span>{fi ? "Tarkistus" : "Review"}</span>
            <span>{fi ? "Nopea ehdotus" : "Fast suggestion"}</span>
          </div>
        </div>
      </div>
    </section>
  );
}

export function AiExtractionV2({ locale }: { locale: Locale }) {
  const fi = locale === "fi";
  return (
    <section className="marketing-shell v2-section ai-v2" id="ai-extraction">
      <div className="v2-section-copy">
        <SectionLabel>{fi ? "AI-poiminta" : "AI extraction"}</SectionLabel>
        <h2>{fi ? "AI jäsentää. Averomira näyttää perustelut. Sinä hyväksyt." : "AI structures. Averomira shows the evidence. You approve."}</h2>
        <p>{fi ? "Jokainen rivi säilyttää lähteen, poimintatuloksen, osumamenetelmän ja varmuuden näkyvissä, jotta tiimisi voi tarkistaa päätökset mustan laatikon sijaan." : "Every line keeps its source, extraction result, match method and confidence visible so your team can review decisions instead of trusting a black box."}</p>
      </div>

      <div className="ai-v2-proof">
        <div className="ai-v2-source">
          <span className="ai-v2-kicker">{fi ? "Lähde · Sivu 2" : "Source · Page 2"}</span>
          <b>PUMP-37A</b>
          <strong>Circulation pump</strong>
          <small>10 {fi ? "kpl" : "pcs"}</small>
        </div>

        <div className="ai-v2-chain" aria-label="Audit trail">
          <div>
            <span>01</span>
            <b>{fi ? "Lähde" : "Source"}</b>
            <small>PDF · {fi ? "Sivu 2" : "Page 2"}</small>
          </div>
          <i>→</i>
          <div>
            <span>02</span>
            <b>{fi ? "Poiminta" : "Extraction"}</b>
            <small>96% {fi ? "varmuus" : "confidence"}</small>
          </div>
          <i>→</i>
          <div>
            <span>03</span>
            <b>{fi ? "Tuoteosuma" : "Product match"}</b>
            <small>99% · {fi ? "Tarkka SKU" : "Exact SKU"}</small>
          </div>
          <i>→</i>
          <div>
            <span>04</span>
            <b>{fi ? "Tarkistus" : "Review"}</b>
            <small>{fi ? "Valmis vahvistettavaksi" : "Ready to approve"}</small>
          </div>
        </div>

        <div className="ai-v2-result">
          <div>
            <span>{fi ? "Osunut tuote" : "Matched product"}</span>
            <b>GRU-98561418</b>
            <small>Grundfos ALPHA2 25-60</small>
          </div>
          <div>
            <span>{fi ? "Menetelmä" : "Method"}</span>
            <b>{fi ? "Tarkka SKU" : "Exact SKU"}</b>
            <small>{fi ? "Lähde säilytetty" : "Source preserved"}</small>
          </div>
          <div>
            <span>Confidence</span>
            <b>99%</b>
            <small>{fi ? "Yli 90 % kynnyksen" : "Above 90% threshold"}</small>
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
    "Lataa RFQ", "Tarkista vain epävarmat tuotteet", "Lähetä tarjous", "Lataa PO", "Ratkaise vain poikkeamat", "Luo myyntitilaus Business Centraliin",
  ] : [
    "Upload RFQ", "Review only uncertain products", "Send quote", "Upload PO", "Resolve only exceptions", "Create the sales order in Business Central",
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
              {fi ? "Pyydä demo" : "Request a demo"}
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
