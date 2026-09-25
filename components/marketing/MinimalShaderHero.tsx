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
          <div className="minimal-kicker">AI quote desk for industrial sales teams</div>

          <h1>Turn messy RFQs into ready-to-review quotes.</h1>

          <p>
            Rivora reads customer PDFs and spreadsheets, resolves product codes
            and prepares quote-ready lines for human approval.
          </p>

          <div className="minimal-hero-actions">
            <Link href="/app/upload" className="minimal-btn minimal-btn-primary">
              Process an RFQ <span aria-hidden="true">→</span>
            </Link>
            <a href="#how-it-works" className="minimal-btn minimal-btn-secondary">
              See how it works
            </a>
          </div>

          <div className="minimal-flow" aria-label="Rivora workflow">
            <span>PDF / XLSX</span><i />
            <span>Extract</span><i />
            <span>Match</span><i />
            <span>Review</span><i />
            <span>Quote</span>
          </div>
        </div>

        <div className="hero-proof" aria-label="Example Rivora product match">
          <div className="hero-proof-label">Customer input</div>
          <div className="hero-proof-input">
            <div>
              <b>PUMP-37A</b>
              <span>Circulation pump</span>
            </div>
            <strong>10 pcs</strong>
          </div>

          <div className="hero-proof-arrow" aria-hidden="true">↓</div>

          <div className="hero-proof-label">Rivora output</div>
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
            <em>Review</em>
          </div>
        </div>
      </div>
    </section>
  );
}
