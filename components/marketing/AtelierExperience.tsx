"use client";

import { useState } from "react";
import Link from "next/link";
import { RivoraMark } from "./RivoraMark";
import type { Locale } from "@/lib/locale";

const stages = ["Request", "Match", "Quote", "PO Check", "ERP Draft"] as const;
type Stage = (typeof stages)[number];
const stageNames: Record<Locale, readonly string[]> = {
  en: stages,
  fi: ["Pyyntö", "Osuma", "Tarjous", "PO-tarkistus", "ERP-luonnos"],
};

export function AtelierNav({ locale }: { locale: Locale }) {
  const fi = locale === "fi";
  const [open, setOpen] = useState(false);
  const links = [
    ["#workflow", fi ? "Työnkulku" : "Workflow"],
    ["#product", fi ? "Tuote" : "Product"],
    ["#business-central", "Business Central"],
    ["#pricing", fi ? "Pilotti" : "Pilot"],
  ];
  return (
    <header className="atelier-header">
      <div className="atelier-container atelier-nav">
        <Link href="/" className="atelier-brand" aria-label="Averomira home"><RivoraMark withSymbol /></Link>
        <nav className="atelier-nav-links" aria-label={fi ? "Päävalikko" : "Main navigation"}>
          {links.map(([href, label]) => <a key={href} href={href}>{label}</a>)}
        </nav>
        <div className="atelier-nav-actions">
          <Link href="/login" className="atelier-login">{fi ? "Kirjaudu" : "Log in"}</Link>
          <a className="atelier-button atelier-button-dark atelier-nav-cta" href="#demo">{fi ? "Keskustellaan pilotista" : "Discuss your pilot"} <span aria-hidden="true">↗</span></a>
        </div>
        <button className="atelier-menu-toggle" type="button" aria-label={fi ? "Avaa valikko" : "Open menu"} aria-expanded={open} aria-controls="atelier-mobile-menu" onClick={() => setOpen(!open)}>
          <span /><span />
        </button>
      </div>
      <nav id="atelier-mobile-menu" className="atelier-mobile-menu" aria-label={fi ? "Mobiilivalikko" : "Mobile navigation"} hidden={!open}>
        {links.map(([href, label]) => <a key={href} href={href} onClick={() => setOpen(false)}>{label}</a>)}
        <Link href="/login" onClick={() => setOpen(false)}>{fi ? "Kirjaudu" : "Log in"}</Link>
        <a href="#demo" className="atelier-button atelier-button-dark" onClick={() => setOpen(false)}>{fi ? "Keskustellaan pilotista" : "Discuss your pilot"} <span aria-hidden="true">↗</span></a>
      </nav>
    </header>
  );
}

function UiHeader({ label, meta }: { label: string; meta: string }) {
  return <div className="atelier-ui-header"><strong>{label}</strong><span className="atelier-ui-meta">{meta}</span></div>;
}

export function HeroMatch({ locale }: { locale: Locale }) {
  const fi = locale === "fi";
  const [selected, setSelected] = useState(true);
  const [confirmed, setConfirmed] = useState(false);
  function choose() { setSelected(true); setConfirmed(false); }
  return (
    <div className="atelier-hero-product">
      <div className="atelier-ui-topline"><span className="atelier-live-dot" /> {fi ? "TUOTTEIDEN RATKAISU" : "PRODUCT RESOLUTION"} <span>{fi ? "Havainnollistava esimerkki" : "Illustrative example"}</span></div>
      <div className="atelier-match-shell">
        <UiHeader label={fi ? "Tarjouspyyntö" : "Customer request"} meta="RFQ · 001" />
        <div className="atelier-match-columns">
          <div className="atelier-request-column">
            <div className="atelier-ui-kicker"><span>01 / {fi ? "ASIAKKAAN RIVI" : "CUSTOMER LINE"}</span><span>{fi ? "Määrä" : "QTY"}</span></div>
            <button type="button" className={"atelier-request-row " + (selected ? "is-selected" : "")} onClick={choose} aria-label={fi ? "Valitse asiakasrivi" : "Select customer request line"}>
              <span className="atelier-row-number">01</span>
              <span className="atelier-row-detail"><strong>Circulation pump, 25-60</strong><small>Customer ref. CP-25-60</small></span>
              <strong className="atelier-qty">12 <small>pcs</small></strong>
            </button>
            <div className="atelier-muted-row"><span>02</span><span>Seal kit, DN25</span><span>12 pcs</span></div>
            <div className="atelier-source-note"><span className="atelier-doc-icon" aria-hidden="true">≡</span>{fi ? "Lähde: asiakkaan RFQ" : "Source: customer RFQ"} <span>PDF</span></div>
          </div>
          <div className={"atelier-connection " + (selected ? "is-active" : "")} aria-hidden="true"><span /><i /><span /></div>
          <div className="atelier-suggestion-column">
            <div className="atelier-ui-kicker"><span>02 / {fi ? "KATALOGIN EHDOTUS" : "CATALOGUE SUGGESTION"}</span></div>
            <div className={"atelier-suggestion " + (selected ? "is-selected" : "")}>
              <div className="atelier-suggestion-heading"><span className="atelier-status-review">{confirmed ? (fi ? "Vahvistettu" : "Confirmed") : (fi ? "Tarkistettava" : "Review match")}</span></div>
              <strong>Circulation pump 25-60</strong>
              <p>CAT-1042 <span>·</span> DN25 <span>·</span> 230 V</p>
              <div className="atelier-suggestion-footer">
                <span>{fi ? "Vastaavuus tarkistetaan ennen tarjousta" : "Review before adding to quote"}</span>
                <button type="button" onClick={() => { setSelected(true); setConfirmed(!confirmed); }} aria-pressed={confirmed}>{confirmed ? (fi ? "Vahvistettu ✓" : "Confirmed ✓") : (fi ? "Vahvista osuma" : "Confirm match")} <span aria-hidden="true">→</span></button>
              </div>
            </div>
            <div className="atelier-muted-row atelier-more-results"><span>Additional catalogue results</span><span>2</span></div>
          </div>
        </div>
        <div className="atelier-ui-bottom"><span>{fi ? "Asiakkaan kuvaus" : "Customer description"}</span><span aria-hidden="true">→</span><span>{fi ? "Oman katalogin tuote" : "Your catalogue product"}</span><span className="atelier-human-note">{fi ? "Ihmisen vahvistus" : "Human confirmation"}</span></div>
      </div>
    </div>
  );
}

const copy = {
  en: {
    descriptions: [
      "Bring a customer RFQ into one reviewable workspace. Keep the source alongside each extracted line.",
      "Compare customer descriptions and references with your own catalogue. Confirm the correct mapping.",
      "Prepare a quotation from reviewed lines, then check the commercial details before sending.",
      "Compare an incoming purchase order against the quotation. Review differences before approval.",
      "Prepare a draft sales order for Microsoft Business Central after the required review and mapping."
    ],
    labels: ["RFQ intake", "Product resolution", "Quote builder", "PO reconciliation", "Business Central"],
  },
  fi: {
    descriptions: [
      "Tuo asiakkaan tarjouspyyntö tarkistettavaan työtilaan. Lähde säilyy poimittujen rivien rinnalla.",
      "Vertaa asiakkaan kuvauksia ja koodeja omaan katalogiin. Vahvista oikea vastine.",
      "Valmistele tarjous tarkistetuista riveistä ja tarkista kaupalliset tiedot ennen lähetystä.",
      "Vertaa saapunutta ostotilausta tarjoukseen. Tarkista erot ennen hyväksyntää.",
      "Valmistele myyntitilausluonnos Business Centraliin tarkistusten ja vastineiden jälkeen."
    ],
    labels: ["RFQ-käsittely", "Tuoteosuma", "Tarjous", "PO-tarkistus", "Business Central"],
  },
};

function StageVisual({ stage, locale }: { stage: Stage; locale: Locale }) {
  const fi = locale === "fi";
  if (stage === "Request") return <div className="atelier-stage-document"><div className="atelier-paper-label">RFQ / 001 <span>PDF</span></div><h4>{fi ? "Tarjouspyyntö" : "Request for quotation"}</h4><p>{fi ? "Circulation pump, 25-60" : "Circulation pump, 25-60"} <b>12 pcs</b></p><p>Seal kit, DN25 <b>12 pcs</b></p><div className="atelier-paper-footer">{fi ? "Lähde säilyy rivin yhteydessä" : "Source retained with each line"} <span>↗</span></div></div>;
  if (stage === "Match") return <div className="atelier-stage-match"><div><small>{fi ? "ASIAKKAAN KUVAUS" : "CUSTOMER DESCRIPTION"}</small><strong>Circulation pump, 25-60</strong><span>CP-25-60 · 12 pcs</span></div><span className="atelier-stage-arrow" aria-hidden="true">⟶</span><div className="atelier-stage-selected"><small>{fi ? "KATALOGIN TUOTE" : "CATALOGUE PRODUCT"}</small><strong>Circulation pump 25-60</strong><span>CAT-1042 · {fi ? "Tarkistettava" : "Review match"}</span></div></div>;
  if (stage === "Quote") return <div className="atelier-stage-document"><div className="atelier-paper-label">{fi ? "TARJOUSLUONNOS" : "QUOTE DRAFT"} <span>Q-001</span></div><h4>{fi ? "Tarjouksen rivit" : "Quotation lines"}</h4><p>CAT-1042 · Circulation pump <b>12 pcs</b></p><p>CAT-2088 · Seal kit <b>12 pcs</b></p><div className="atelier-paper-footer">{fi ? "Tarkista tiedot ennen lähetystä" : "Review details before sending"} <span>→</span></div></div>;
  if (stage === "PO Check") return <div className="atelier-po-compare"><div><small>{fi ? "TARJOUS" : "QUOTATION"} · Q-001</small><strong>CAT-1042</strong><span>12 pcs</span></div><div className="atelier-po-difference"><small>{fi ? "ASIAKKAAN PO" : "CUSTOMER PO"} · PO-001</small><strong>CAT-1042</strong><span>10 pcs</span></div><p><b>{fi ? "Määräpoikkeama" : "Quantity difference"}</b> · {fi ? "Tarjous 12 kpl, tilaus 10 kpl. Tarkista ennen hyväksyntää." : "Quote 12 pcs, order 10 pcs. Review before approval."}</p></div>;
  return <div className="atelier-stage-erp"><div><small>AVEROMIRA</small><strong>{fi ? "Tarkistettu tilaus" : "Reviewed order"}</strong><span>PO-001 · {fi ? "Vastineet valmiina" : "Mappings ready"}</span></div><span className="atelier-stage-arrow" aria-hidden="true">⟶</span><div><small>BUSINESS CENTRAL</small><strong>{fi ? "Myyntitilausluonnos" : "Draft sales order"}</strong><span>{fi ? "Ei kirjattu" : "Not posted"}</span></div></div>;
}

export function WorkflowExperience({ locale }: { locale: Locale }) {
  const [active, setActive] = useState(0);
  const content = copy[locale];
  return (
    <div className="atelier-workflow-experience">
      <div className="atelier-workflow-tabs" role="tablist" aria-label={locale === "fi" ? "Tilauspolun vaiheet" : "Order workflow stages"}>
        {stages.map((stage, index) => <button key={stage} id={"atelier-tab-" + index} role="tab" type="button" aria-selected={active === index} aria-controls="atelier-stage-panel" tabIndex={active === index ? 0 : -1} onClick={() => setActive(index)} onKeyDown={(event) => { if (event.key === "ArrowRight" || event.key === "ArrowLeft") { event.preventDefault(); const next = (active + (event.key === "ArrowRight" ? 1 : stages.length - 1)) % stages.length; setActive(next); document.getElementById("atelier-tab-" + next)?.focus(); } }}>
          <span>0{index + 1}</span>{stageNames[locale][index]}
        </button>)}
      </div>
      <div className="atelier-workflow-panel" id="atelier-stage-panel" role="tabpanel" aria-labelledby={"atelier-tab-" + active} tabIndex={0}>
        <div className="atelier-workflow-copy"><span className="atelier-eyebrow">0{active + 1} / 05 · {content.labels[active]}</span><h3>{stageNames[locale][active]}</h3><p>{content.descriptions[active]}</p><span className="atelier-example-label">{locale === "fi" ? "Havainnollistava esimerkki · sama tilaus kaikissa vaiheissa" : "Illustrative example · the same order throughout"}</span></div>
        <div className="atelier-workflow-visual" key={active}><StageVisual stage={stages[active]} locale={locale} /></div>
      </div>
    </div>
  );
}
