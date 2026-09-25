"use client";

import Link from "next/link";

export function MinimalShaderHero() {
  return (
    <section className="minimal-hero v2-hero" id="product">
      <div className="minimal-hero-shader" aria-hidden="true">
        <span className="shader-blob shader-a" />
        <span className="shader-blob shader-b" />
        <span className="shader-blob shader-c" />
      </div>

      <div className="marketing-shell minimal-hero-inner v2-hero-inner">
        <div className="minimal-hero-copy">
          <div className="minimal-kicker">RFQ automation for industrial sales teams</div>

          <h1>Turn incoming RFQs into quote-ready product lines.</h1>

          <p>
            Upload a customer PDF or spreadsheet. Rivora extracts the line items,
            resolves customer product codes against your catalogue, flags uncertainty
            and learns from confirmed matches.
          </p>

          <div className="minimal-hero-actions">
            <Link href="/app/upload" className="minimal-btn minimal-btn-primary">
              Upload an RFQ <span aria-hidden="true">→</span>
            </Link>
            <a href="#resolution" className="minimal-btn minimal-btn-secondary">
              See a resolved line
            </a>
          </div>

          <div className="hero-conversion-note">
            <span>No ERP integration required to start</span>
            <i />
            <span>Human approval stays in control</span>
          </div>

          <div className="minimal-flow" aria-label="Rivora workflow">
            <span>PDF / XLSX</span><i />
            <span>Extract</span><i />
            <span>Resolve</span><i />
            <span>Review</span><i />
            <span>Quote-ready</span>
          </div>
        </div>

        <div className="hero-proof" aria-label="Example Rivora product match">
          <div className="hero-proof-label">Customer line</div>
          <div className="hero-proof-input">
            <div>
              <b>PUMP-37A</b>
              <span>Circulation pump</span>
            </div>
            <strong>10 pcs</strong>
          </div>

          <div className="hero-proof-arrow" aria-hidden="true">↓</div>

          <div className="hero-proof-label">Resolved product</div>
          <div className="hero-proof-result">
            <div>
              <b>GRU-98561418</b>
              <span>Grundfos ALPHA2 25-60</span>
            </div>
            <em>99% · Exact SKU</em>
          </div>

          <div className="hero-proof-review">
            <span>OLD-991-A</span>
            <i>→</i>
            <b>78%</b>
            <em>Needs review</em>
          </div>
        </div>
      </div>
    </section>
  );
}
