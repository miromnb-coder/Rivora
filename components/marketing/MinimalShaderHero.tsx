"use client";

import Link from "next/link";

export function MinimalShaderHero() {
  return (
    <section className="minimal-hero" id="product">
      <div className="minimal-hero-shader" aria-hidden="true">
        <span className="shader-blob shader-a" />
        <span className="shader-blob shader-b" />
        <span className="shader-blob shader-c" />
        <span className="shader-blob shader-d" />
      </div>

      <div className="minimal-hero-grid" aria-hidden="true" />

      <div className="marketing-shell minimal-hero-inner">
        <div className="minimal-hero-copy">
          <div className="minimal-kicker">AI quote desk for industrial sales teams</div>

          <h1>Turn messy RFQs into ready-to-review quotes.</h1>

          <p>
            Rivora reads customer PDFs and spreadsheets, resolves product codes,
            learns customer-specific mappings and prepares the quote for human approval.
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
            <span>PDF / XLSX / Email</span><i />
            <span>Extract</span><i />
            <span>Match</span><i />
            <span>Review</span><i />
            <span>Quote</span>
          </div>
        </div>

        <div className="minimal-product-preview" aria-label="Rivora product preview">
          <div className="minimal-preview-top">
            <div>
              <span className="minimal-preview-overline">RFQ-2026-1187</span>
              <strong>ACME Industrial</strong>
            </div>
            <span className="minimal-status">Ready for review</span>
          </div>

          <div className="minimal-preview-columns">
            <div className="minimal-preview-panel">
              <div className="minimal-preview-heading">Customer input</div>

              <div className="minimal-preview-row">
                <div><b>PUMP-37A</b><small>Circulation pump · 10 pcs</small></div>
              </div>
              <div className="minimal-preview-row">
                <div><b>BV-220</b><small>Ball valve · 25 pcs</small></div>
              </div>
              <div className="minimal-preview-row">
                <div><b>PS-1000</b><small>Pressure sensor · 5 pcs</small></div>
              </div>
            </div>

            <div className="minimal-preview-panel minimal-preview-output">
              <div className="minimal-preview-heading">Rivora output</div>

              <div className="minimal-preview-row match">
                <div><b>GRU-98561418</b><small>ALPHA2 25-60</small></div>
                <span>99%</span>
              </div>
              <div className="minimal-preview-row match">
                <div><b>VLV-441002</b><small>KSB Ball Valve DN50</small></div>
                <span>98%</span>
              </div>
              <div className="minimal-preview-row match review">
                <div><b>SEN-773440</b><small>WIKA A-10</small></div>
                <span>Review</span>
              </div>
            </div>
          </div>

          <div className="minimal-preview-footer">
            <span>Customer memory</span>
            <span>Exact SKU</span>
            <span>Audit-friendly</span>
            <span>Human approval</span>
          </div>
        </div>
      </div>
    </section>
  );
}
