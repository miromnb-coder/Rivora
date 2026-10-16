import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireWorkspace } from "@/lib/rivora/workspace";
import { WorkspaceFrame } from "@/components/workspace/WorkspaceFrame";
import { MlStatusBadge } from "@/components/design-system/MinimalLinen";
import "@/styles/minimal-linen.css";
import "@/app/app/workspace-shell.css";
import "./preview.css";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { robots: { index: false, follow: false } };

const sections = [
  { name: "Yleiskuva", icon: "◫" },
  { name: "Tilaukset", icon: "▤" },
  { name: "Asiakkaat", icon: "◯" },
  { name: "Tuotteet", icon: "▦" },
  { name: "Asetukset", icon: "⚙" },
];
const cases = [
  { reference: "RFQ-EX-001", customer: "Esimerkkiyritys A", state: "Vaatii tarkistuksen", tone: "warning" as const, action: "Tarkista tarjouspyyntö" },
  { reference: "QT-EX-002", customer: "Esimerkkiyritys B", state: "Käsittelyssä", tone: "info" as const, action: "Viimeistele tarjous" },
  { reference: "PO-EX-003", customer: "Esimerkkiyritys C", state: "Valmis", tone: "success" as const, action: "Näytä ostotilaus" },
];

function StaticNav({ compact = false }: { compact?: boolean }) {
  return (
    <nav className={"app-sidebar-v2-nav" + (compact ? " is-compact" : "")} aria-label="Esimerkkinavigaatio">
      {sections.map(({ name, icon }) => (
        <span className={"app-sidebar-v2-link" + (name === "Tilaukset" ? " is-active" : "")} key={name}
          title={name} aria-label={name}>
          <span className="app-nav-main"><span className="app-nav-icon" aria-hidden="true">{icon}</span>
            <span className="app-nav-label">{name}</span></span>
        </span>
      ))}
    </nav>
  );
}

export default async function WorkspaceShellPreviewPage() {
  if (process.env.NODE_ENV !== "development" && process.env.VERCEL_ENV !== "preview") notFound();
  await requireWorkspace();

  return (
    <WorkspaceFrame locale="fi"
      sidebar={
        <aside className="app-sidebar-v2">
          <div className="app-sidebar-v2-top">
            <div className="app-sidebar-v2-brand">averomira</div>
            <div className="app-sidebar-v2-product">Työtila · esikatselu</div>
          </div>
          <StaticNav />
          <div className="app-sidebar-v2-account">
            <div className="app-sidebar-v2-account-label">YRITYSTYÖTILA</div>
            <div className="app-sidebar-v2-account-name">Esimerkkiyritys</div>
            <div className="app-sidebar-v2-role">Katselutila</div>
          </div>
        </aside>
      }
      mobileHeader={<header className="app-mobile-topbar"><strong>averomira</strong><span>Esikatselu</span></header>}
      mobileNavigation={<div className="app-mobile-bottom-nav"><StaticNav compact /></div>}
      support={null}
    >
      <div className="app-page-v2 ml-shell-preview">
        <div className="ml-shell-preview-eyebrow">TYÖTILA / TILAUKSET · SYNTEETTINEN NÄKYMÄ</div>
        <header className="ml-shell-preview-header">
          <div>
            <h1>Tilaukset</h1>
            <p>Seuraa tarjouspyyntöjä ja tilausprosessin etenemistä.</p>
          </div>
          <span className="ml-shell-preview-pill">Esikatselu</span>
        </header>
        <div className="ml-shell-preview-stats">
          {[
            { label: "Käsittelyssä", count: "12" },
            { label: "Vaatii huomiota", count: "6" },
            { label: "ERP-vaiheessa", count: "4" },
            { label: "Valmiit", count: "18" },
          ].map(({ label, count }) => (
            <div key={label} className="ml-shell-preview-stat">
              <div>{label}</div><strong>{count}</strong>
            </div>
          ))}
        </div>
        <div className="ml-shell-preview-section-title">Seuraavaksi käsiteltävät</div>
        <div className="ml-shell-preview-list">
          {cases.map(item => (
            <div key={item.reference} className="ml-shell-preview-row">
              <div className="ml-shell-preview-row-text">
                <strong>{item.customer}</strong><small>{item.reference}</small>
              </div>
              <MlStatusBadge tone={item.tone}>{item.state}</MlStatusBadge>
              <span className="ml-shell-preview-row-action">{item.action} ↗</span>
            </div>
          ))}
        </div>
        <p className="ml-shell-preview-disclaimer">Kaikki esimerkkiasiakkaat, tunnisteet ja luvut ovat synteettisiä. Tämä sivu ei hae eikä muokkaa tilaustietoja.</p>
      </div>
    </WorkspaceFrame>
  );
}
