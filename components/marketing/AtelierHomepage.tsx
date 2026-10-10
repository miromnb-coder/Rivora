import Link from "next/link";
import { RivoraMark } from "./RivoraMark";
import { AtelierNav, HeroMatch, WorkflowExperience } from "./AtelierExperience";
import { PricingLeadCapture } from "./PricingLeadCapture";
import { FaqV2 } from "./FaqV2";
import type { Locale } from "@/lib/locale";

export function AtelierHomepage({ locale }: { locale: Locale }) {
  const fi = locale === "fi";
  return (
    <div className="atelier-page">
      <a className="atelier-skip" href="#main-content">{fi ? "Siirry sisältöön" : "Skip to content"}</a>
      <AtelierNav locale={locale} />
      <main id="main-content">
      <section className="atelier-hero atelier-container" aria-labelledby="atelier-hero-title">
        <div className="atelier-hero-copy">
          <div className="atelier-eyebrow"><i />{fi ? "TEOLLISILLE MYYNTITIIMEILLE" : "FOR INDUSTRIAL SALES TEAMS"}</div>
          <h1 id="atelier-hero-title">{fi ? <>Muuta monimutkaiset tarjouspyynnöt <em>tarkistetuiksi tarjouksiksi.</em></> : <>Turn complex RFQs into <em>reviewed quotes.</em></>}</h1>
          <p>{fi ? "Yhdistä asiakkaan pyynnöt omaan tuotekatalogiisi, tarkista ehdotetut tuotteet ja valmistele tarjoukset tiimisi hallinnassa." : "Match customer requests to your catalogue, review suggested products, and prepare quotations with your team in control."}</p>
          <div className="atelier-hero-actions"><a className="atelier-button atelier-button-dark" href="#demo">{fi ? "Keskustellaan Averomirasta" : "Discuss Averomira"} <span aria-hidden="true">↗</span></a><a className="atelier-button atelier-button-outline" href="#workflow">{fi ? "Tutustu työnkulkuun" : "Explore the workflow"} <span aria-hidden="true">↓</span></a></div>
          <div className="atelier-hero-facts"><span>{fi ? "RFQ-tuoteosumat" : "RFQ matching"}</span><span>{fi ? "Ihmisen tarkistus" : "Human-reviewed decisions"}</span><span>{fi ? "Toimii myös ilman ERP-integraatiota" : "Works without an ERP integration"}</span></div>
        </div>
        <HeroMatch locale={locale} />
        <div className="atelier-hero-index" aria-hidden="true"><span>01 / AVEROMIRA</span><span>RFQ → ERP</span></div>
      </section>

      <div className="atelier-boundary atelier-container"><span>{fi ? "Yksi tarkistettava tilauspolku" : "One reviewable order flow"}</span><span>RFQ <b>↗</b> MATCH <b>↗</b> QUOTE <b>↗</b> PO <b>↗</b> ERP</span></div>

      <section id="workflow" className="atelier-section atelier-container atelier-workflow" aria-labelledby="atelier-workflow-title">
        <div className="atelier-section-heading"><div><span className="atelier-eyebrow">01 / {fi ? "TYÖNKULKU" : "THE WORKFLOW"}</span><h2 id="atelier-workflow-title">{fi ? "Seuraa yhtä tilausta Averomiran läpi." : "Follow one order through Averomira."}</h2></div><p>{fi ? "Tarjouspyynnöstä tuoteosumaan, tarjoukseen ja ostotilauksen tarkistukseen. Jokainen vaihe jättää tilaa oikealle päätökselle." : "From the first customer request to a reviewed order. Explore where the information moves and where your team makes the decision."}</p></div>
        <WorkflowExperience locale={locale} />
      </section>

      <section id="product" className="atelier-section atelier-value" aria-labelledby="atelier-value-title">
        <div className="atelier-container">
          <div className="atelier-section-heading"><div><span className="atelier-eyebrow">02 / {fi ? "TYÖ DOKUMENTTIEN VÄLISSÄ" : "BETWEEN THE DOCUMENTS"}</span><h2 id="atelier-value-title">{fi ? "Dokumenttien välinen työ kasautuu." : "The work between the documents adds up."}</h2></div><p>{fi ? "Asiakkaan nimikkeet, oman katalogin tuotteet ja saapuva ostotilaus tarvitsevat yhteisen kontekstin." : "Customer item names, catalogue products and incoming orders need one place to be compared and reviewed."}</p></div>
          <div className="atelier-value-layout">
            <div className="atelier-value-primary"><span className="atelier-large-number">01</span><div><h3>{fi ? "Asiakkaan kieli kohtaa katalogin." : "Customer language meets your catalogue."}</h3><p>{fi ? "Tunnista asiakkaan tuotekuvauksen, SKU:n tai valmistajakoodin mahdolliset vastineet. Käyttäjä vahvistaa oikean tuotteen ennen tarjousta." : "Find possible matches for a customer description, SKU or manufacturer code. A person confirms the right product before it reaches the quote."}</p></div><div className="atelier-value-spec"><span>CP-25-60</span><i aria-hidden="true">→</i><strong>CAT-1042</strong><small>{fi ? "HAVAINNOLLISTAVA VASTINE" : "ILLUSTRATIVE MAPPING"}</small></div></div>
            <div className="atelier-value-secondary"><div><span className="atelier-small-number">02 /</span><h3>{fi ? "Vahvistettu vastine muistetaan." : "A confirmed mapping can be reused."}</h3><p>{fi ? "Asiakaskohtainen tuotemuisti voi tuoda aiemmin vahvistetun vastineen seuraavan tarjouspyynnön avuksi." : "Customer-specific product memory can bring a previously confirmed mapping into a later RFQ."}</p></div><div className="atelier-value-rule" /><div><span className="atelier-small-number">03 /</span><h3>{fi ? "Poikkeama tulee näkyviin." : "Differences become visible."}</h3><p>{fi ? "Vertaa ostotilauksen rivejä tarjoukseen. Määrä-, hinta- ja tuote-erot voidaan tarkistaa ennen hyväksyntää." : "Compare purchase order lines with the quote. Review quantity, price and product differences before approval."}</p></div></div>
          </div>
        </div>
      </section>

      <section className="atelier-section atelier-control" aria-labelledby="atelier-control-title">
        <div className="atelier-container atelier-control-grid">
          <div className="atelier-control-copy"><span className="atelier-eyebrow">03 / {fi ? "IHMISEN PÄÄTÖS" : "HUMAN CONTROL"}</span><h2 id="atelier-control-title">{fi ? <>Näe lähde. Tarkista osuma. <em>Tee päätös.</em></> : <>See the source. Review the match. <em>Make the decision.</em></>}</h2><p>{fi ? "Averomira jäsentää ja ehdottaa. Tiimisi tarkistaa lähderivin, valitsee oikean tuotteen ja vahvistaa etenemisen. Epäselvät kohdat pysyvät näkyvissä." : "Averomira structures the request and suggests a match. Your team sees the source, checks the proposed product and confirms what moves forward."}</p><a className="atelier-text-link" href="#workflow">{fi ? "Katso työnkulku" : "Explore the workflow"} <span aria-hidden="true">↗</span></a></div>
          <div className="atelier-control-panel"><div className="atelier-control-top"><span>{fi ? "TARKISTUSPISTE" : "REVIEW POINT"}</span><span>RFQ / 001</span></div><div className="atelier-control-source"><small>{fi ? "LÄHDERIVI · ASIAKKAAN RFQ" : "SOURCE LINE · CUSTOMER RFQ"}</small><strong>Circulation pump, 25-60</strong><span>CP-25-60 · 12 pcs</span></div><div className="atelier-control-divider"><span>{fi ? "Ehdotettu vastine" : "Suggested match"}</span><i aria-hidden="true">↓</i></div><div className="atelier-control-target"><small>{fi ? "OMA TUOTEKATALOGI" : "YOUR PRODUCT CATALOGUE"}</small><strong>Circulation pump 25-60</strong><span>CAT-1042 · DN25 · 230 V</span></div><div className="atelier-control-confirm"><span className="atelier-check" aria-hidden="true">✓</span><div><strong>{fi ? "Käyttäjän vahvistus" : "Confirmed by a person"}</strong><small>{fi ? "Vasta tarkistettu rivi etenee tarjoukseen" : "Only reviewed lines continue to the quote"}</small></div></div><span className="atelier-example-label">{fi ? "Havainnollistava esimerkki" : "Illustrative example"}</span></div>
        </div>
      </section>

      <section id="integrations" className="atelier-section atelier-erp" aria-labelledby="atelier-erp-title"><div className="atelier-container"><div className="atelier-section-heading"><div><span className="atelier-eyebrow">04 / ERP {fi ? "INTEGRAATIOT" : "INTEGRATIONS"}</span><h2 id="atelier-erp-title">{fi ? "ERP-yhteydet yrityksesi tarpeen mukaan." : "ERP connections based on your needs."}</h2></div><p>{fi ? "Tarjouspyynnöt, tarjoukset ja tilausten tarkistus toimivat myös ilman ERP-yhteyttä. Business Central on tällä hetkellä ainoa valmis natiivi ERP-integraatio." : "RFQ processing, quoting and order review also work without an ERP connection. Business Central is currently the only available native ERP integration."}</p></div><div className="atelier-erp-diagram"><div><small>AVEROMIRA</small><strong>{fi ? "Tarkistettu ostotilaus" : "Reviewed purchase order"}</strong><span>{fi ? "Rivit ja vastineet hyväksytty" : "Lines and mappings approved"}</span></div><div className="atelier-erp-connector" aria-hidden="true"><span /><b>→</b><span /></div><div><small>MICROSOFT BUSINESS CENTRAL · {fi ? "TUETTU ESIMERKKI" : "SUPPORTED EXAMPLE"}</small><strong>{fi ? "Myyntitilausluonnos" : "Draft sales order"}</strong><span>{fi ? "Yhteys vaatii käyttöönoton" : "Connection requires setup"}</span></div></div><p className="atelier-erp-note">{fi ? "Muiden ERP-järjestelmien yhteydet arvioidaan tapauskohtaisesti: ne eivät ole valmiita integraatioita, ja räätälöinnit hinnoitellaan erikseen." : "Connections to other ERP systems are assessed case by case. They are not ready-made integrations, and custom work is priced separately."}</p></div></section>

      <PricingLeadCapture locale={locale} />
      <FaqV2 locale={locale} />

      <section className="atelier-final" aria-labelledby="atelier-final-title"><div className="atelier-container atelier-final-inner"><div><span className="atelier-eyebrow">05 / {fi ? "ALOITETAAN" : "THE NEXT STEP"}</span><h2 id="atelier-final-title">{fi ? "Katso, mitä Averomira voi tehdä seuraavalla tarjouspyynnölläsi." : "See what Averomira can do with your next RFQ."}</h2><p>{fi ? "Käydään nykyinen työnkulkunne läpi ja sovitaan käyttöönoton laajuudesta." : "Discuss your workflow and agree on the scope of onboarding."}</p></div><a className="atelier-button atelier-button-light" href="#demo">{fi ? "Keskustellaan Averomirasta" : "Discuss Averomira"} <span aria-hidden="true">↗</span></a></div></section>
      </main>
      <footer className="atelier-footer"><div className="atelier-container"><div className="atelier-footer-main"><div><Link href="/" className="atelier-footer-brand" aria-label="Averomira home"><RivoraMark withSymbol /></Link><p>{fi ? "Teollisen B2B-myynnin tarkistettava tilauspolku tarjouspyynnöstä ERP-luonnokseen." : "A reviewable industrial sales workflow, from customer RFQ to ERP draft."}</p></div><nav aria-label={fi ? "Alatunniste" : "Footer navigation"}><div><span>{fi ? "Tutustu" : "Explore"}</span><a href="#workflow">{fi ? "Työnkulku" : "Workflow"}</a><a href="#product">{fi ? "Tuote" : "Product"}</a><a href="#integrations">{fi ? "Integraatiot" : "Integrations"}</a></div><div><span>{fi ? "Averomira" : "Averomira"}</span><a href="#pricing">{fi ? "Hinnoittelu" : "Pricing"}</a><a href="#demo">{fi ? "Yhteys" : "Contact"}</a><Link href="/login">{fi ? "Kirjaudu" : "Log in"}</Link></div><div><span>{fi ? "Asiakirjat" : "Legal"}</span><Link href="/privacy">{fi ? "Tietosuoja" : "Privacy"}</Link><Link href="/terms">{fi ? "Ehdot" : "Terms"}</Link></div></nav></div><div className="atelier-footer-bottom"><span>© 2026 Averomira</span><span>{fi ? "Rakennettu teollisille myyntitiimeille." : "Built for industrial sales teams."}</span></div></div></footer>
    </div>
  );
}
