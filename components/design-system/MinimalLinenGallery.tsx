"use client";

import { useState } from "react";
import {
  MlAlert,
  MlButton,
  MlCard,
  MlCheckbox,
  MlDataTable,
  MlDialog,
  MlEmptyState,
  MlSelectField,
  MlSkeleton,
  MlStatusBadge,
  MlTabs,
  MlTextField,
  MlTextareaField,
} from "./MinimalLinen";

const swatches = [
  { name: "Canvas", value: "#FAF7F3" },
  { name: "Surface", value: "#FFFFFF" },
  { name: "Surface Warm", value: "#FFFCF8" },
  { name: "Soft Surface", value: "#F7F4F0" },
  { name: "Selected", value: "#F2E8E1" },
  { name: "Ink", value: "#24211F" },
  { name: "Muted", value: "#665E57" },
  { name: "Primary", value: "#635244" },
  { name: "Border", value: "#E5DED6" },
  { name: "Strong Border", value: "#D8CDC4" },
] as const;

export function MinimalLinenGallery() {
  const [company, setCompany] = useState("");
  const [description, setDescription] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [notice, setNotice] = useState("");
  const [agreed, setAgreed] = useState(false);

  return (
    <main className="ml-theme" lang="fi">
      <div className="ml-preview">
        <header className="ml-preview-header">
          <div className="ml-stack">
            <div className="ml-overline">Averomira / Design Foundation / Phase 1</div>
            <h1 className="ml-display">Minimal Linen.</h1>
            <p className="ml-muted" style={{ maxWidth: 600, margin: 0 }}>
              Eristetty komponenttien esikatselu. Mikään tämän sivun toiminto ei muuta yritysdataa.
            </p>
          </div>
          <MlStatusBadge tone="info">Kehitysesikatselu</MlStatusBadge>
        </header>

        <section className="ml-preview-section" aria-labelledby="ml-colors-title">
          <div className="ml-preview-section-head">
            <div className="ml-overline">01 / Värit</div>
            <h2 id="ml-colors-title" className="ml-subheading">Yhteinen väripaletti</h2>
            <p className="ml-muted" style={{ margin: 0 }}>Värit pysyvät samoina markkinoinnissa, kirjautumisessa ja työtilassa.</p>
          </div>
          <div className="ml-swatches">
            {swatches.map((color) => (
              <div className="ml-swatch" key={color.name}>
                <div className="ml-swatch-color" style={{ backgroundColor: color.value }} />
                <div className="ml-swatch-name">{color.name}</div>
                <div className="ml-swatch-value">{color.value}</div>
              </div>
            ))}
          </div>
        </section>

        <section className="ml-preview-section" aria-labelledby="ml-type-title">
          <div className="ml-preview-section-head">
            <div className="ml-overline">02 / Typografia</div>
            <h2 id="ml-type-title" className="ml-subheading">Selkeä typografinen hierarkia</h2>
          </div>
          <MlCard>
            <div className="ml-stack">
              <div className="ml-overline">Työtila / Tilaukset</div>
              <h2 className="ml-heading">Tilaukset</h2>
              <h3 className="ml-subheading">Seuraavaksi käsiteltävät</h3>
              <h4 className="ml-card-heading">Tarjouspyynnön tarkistus</h4>
              <p style={{ margin: 0 }}>Normaali sisältöteksti säilyy selkeänä ja helposti luettavana.</p>
              <span className="ml-caption">Toissijainen kuvausteksti ja aikaleimat.</span>
            </div>
          </MlCard>
        </section>

        <section className="ml-preview-section" aria-labelledby="ml-button-title">
          <div className="ml-preview-section-head">
            <div className="ml-overline">03 / Toiminnot</div>
            <h2 id="ml-button-title" className="ml-subheading">Painikkeet ja toimintatilat</h2>
          </div>
          <MlCard>
            <div className="ml-stack">
              <div className="ml-cluster">
                <MlButton type="button" onClick={() => setNotice("Esimerkkipainiketta painettiin. Tietoja ei tallennettu.")}>Ensisijainen</MlButton>
                <MlButton type="button" variant="secondary" onClick={() => setDialogOpen(true)}>Avaa dialogi</MlButton>
                <MlButton type="button" variant="quiet" onClick={() => setNotice("Hiljainen toiminto valittu.")}>Hiljainen</MlButton>
                <MlButton type="button" variant="danger" onClick={() => setDialogOpen(true)}>Vaatii vahvistuksen</MlButton>
              </div>
              <div className="ml-cluster">
                <MlButton type="button" disabled>Ei käytettävissä</MlButton>
                <MlButton type="button" loading>Ladataan</MlButton>
              </div>
              {notice ? <MlAlert tone="success" title="Paikallinen käyttöliittymäpalaute">{notice}</MlAlert> : null}
            </div>
          </MlCard>
        </section>

        <section className="ml-preview-section" aria-labelledby="ml-fields-title">
          <div className="ml-preview-section-head">
            <div className="ml-overline">04 / Lomakkeet</div>
            <h2 id="ml-fields-title" className="ml-subheading">Kentät ja niiden tilat</h2>
          </div>
          <MlCard>
            <form className="ml-stack" onSubmit={(event) => {
              event.preventDefault();
              setNotice("Esimerkkilomake tarkistettiin paikallisesti. Mitään ei tallennettu.");
            }}>
              <div className="ml-grid">
                <MlTextField label="Yrityksen nimi" placeholder="Kirjoita nimi" value={company} onChange={(event) => setCompany(event.target.value)} hint="Normaali syöttökenttä" required />
                <MlSelectField label="Käsittelytila" options={[{ value: "review", label: "Vaatii huomiota" }, { value: "ready", label: "Valmis" }]} hint="Valintakenttä" />
              </div>
              <MlTextareaField label="Kuvaus" placeholder="Lisätiedot" value={description} onChange={(event) => setDescription(event.target.value)} />
              <MlTextField label="Virheellinen kenttä" defaultValue="Virheellinen arvo" error="Tarkista kentän sisältö." />
              <MlTextField label="Lukittu kenttä" value="Ei muokattavissa" readOnly hint="Vain luku -tila" />
              <MlCheckbox checked={agreed} onChange={(event) => setAgreed(event.target.checked)}>Hyväksyn esikatselun ehdot.</MlCheckbox>
              <div><MlButton type="submit">Tarkista lomake</MlButton></div>
            </form>
          </MlCard>
        </section>

        <section className="ml-preview-section" aria-labelledby="ml-status-title">
          <div className="ml-preview-section-head">
            <div className="ml-overline">05 / Prosessin tilat</div>
            <h2 id="ml-status-title" className="ml-subheading">Tunnisteet ja palautteet</h2>
          </div>
          <MlCard>
            <div className="ml-stack">
              <div className="ml-cluster">
                <MlStatusBadge>Luonnos</MlStatusBadge>
                <MlStatusBadge tone="success">Valmis</MlStatusBadge>
                <MlStatusBadge tone="warning">Vaatii huomiota</MlStatusBadge>
                <MlStatusBadge tone="danger">Virhe</MlStatusBadge>
                <MlStatusBadge tone="info">Käsittelyssä</MlStatusBadge>
              </div>
              <MlAlert tone="warning" title="Tarkistus tarvitaan">Esimerkki tarkistusta vaativasta tilasta.</MlAlert>
              <MlAlert tone="danger" title="Toiminto epäonnistui">Esimerkki virhetilasta, ei oikea virhe.</MlAlert>
            </div>
          </MlCard>
        </section>

        <section className="ml-preview-section" aria-labelledby="ml-data-title">
          <div className="ml-preview-section-head">
            <div className="ml-overline">06 / Tietojen esitys</div>
            <h2 id="ml-data-title" className="ml-subheading">Välilehdet, taulukko ja tyhjätila</h2>
          </div>
          <MlCard>
            <MlTabs label="Esimerkkitietojen näkymät" items={[
              { id: "rows", label: "Tuoterivit", content:
                <MlDataTable label="Synteettiset tuoterivit" columns={[
                  { key: "code", label: "Tuotekoodi" }, { key: "name", label: "Kuvaus" }, { key: "status", label: "Tila" }, { key: "quantity", label: "Määrä", right: true },
                ]} rows={[
                  { id: "one", code: "EX-101", name: "Mallituote A", status: <MlStatusBadge tone="success">Valmis</MlStatusBadge>, quantity: "12" },
                  { id: "two", code: "EX-102", name: "Mallituote B", status: <MlStatusBadge tone="warning">Tarkistettava</MlStatusBadge>, quantity: "4" },
                ]} /> },
              { id: "empty", label: "Tyhjätila", content: <MlEmptyState title="Ei vielä tietoja">Lisää uusi tietue aloittaaksesi.</MlEmptyState> },
              { id: "loading", label: "Lataustila", content: <div className="ml-stack"><MlSkeleton height="17px" width="62%" /><MlSkeleton height="17px" width="90%" /><MlSkeleton height="17px" width="75%" /></div> },
            ]} />
          </MlCard>
        </section>

        <section className="ml-preview-section" aria-labelledby="ml-shell-title">
          <div className="ml-preview-section-head">
            <div className="ml-overline">07 / Asettelu</div>
            <h2 id="ml-shell-title" className="ml-subheading">Rakenne ilman varsinaista navigaatiota</h2>
          </div>
          <div className="ml-preview-columns">
            <div className="ml-preview-shell"><div className="ml-overline">Valkoinen työpinta</div><h3 className="ml-card-heading">Sisältöalue</h3><p className="ml-muted">Tämä pinta toimii myöhemmin keskimmäisen työtilan perustana.</p></div>
            <div className="ml-preview-shell" style={{ background: "var(--ml-canvas)" }}><div className="ml-overline">Avoin paneelialue</div><h3 className="ml-card-heading">Copilotin tausta</h3><p className="ml-muted">Sama pellavanvärinen pinta kuin koko sovelluksessa.</p></div>
          </div>
        </section>

        <footer className="ml-preview-section">
          <hr className="ml-divider" />
          <span className="ml-caption">Phase 1 — Vain eristetty designjärjestelmän esikatselu. Ei oikeaa yritysdataa, AI-kutsuja tai tietokantamuutoksia.</span>
        </footer>
      </div>
      <MlDialog open={dialogOpen} onClose={() => setDialogOpen(false)} title="Esimerkkivahvistus">
        <p className="ml-muted">Tämä dialogi havainnollistaa turvallista vahvistusta. Mitään tietoja ei muuteta.</p>
        <div className="ml-cluster" style={{ justifyContent: "flex-end" }}>
          <MlButton type="button" variant="secondary" onClick={() => setDialogOpen(false)}>Sulje</MlButton>
          <MlButton type="button" onClick={() => { setDialogOpen(false); setNotice("Esimerkkivahvistus hyväksyttiin paikallisesti."); }}>Vahvista esimerkki</MlButton>
        </div>
      </MlDialog>
    </main>
  );
}
