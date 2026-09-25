import Link from "next/link";

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <div className="v2-section-label">{children}</div>;
}

export function ProofStripV2() {
  const items = [
    ["Input", "PDF / XLSX / CSV"],
    ["Resolution", "Customer-specific product memory"],
    ["Control", "Source + confidence visible"],
    ["Approval", "Human review before quote"],
  ];

  return (
    <section className="marketing-shell proof-strip-v2" aria-label="Rivora workflow proof points">
      {items.map(([label, value]) => (
        <div key={label} className="proof-strip-v2-item">
          <span>{label}</span>
          <b>{value}</b>
        </div>
      ))}
    </section>
  );
}

export function ProductResolutionV2() {
  return (
    <section className="marketing-shell v2-section" id="resolution">
      <div className="v2-section-copy">
        <SectionLabel>Product resolution</SectionLabel>
        <h2>Customer language in. Your catalogue out.</h2>
        <p>
          Customer-specific SKUs, old product names and manufacturer codes are
          resolved into the products your team actually sells.
        </p>
      </div>

      <div className="resolution-proof">
        <div className="resolution-source">
          <span className="resolution-kicker">Customer line</span>
          <b>PUMP-37A</b>
          <strong>Circulation pump</strong>
          <small>10 pcs</small>
        </div>

        <div className="resolution-rail" aria-hidden="true">
          <span />
          <i>→</i>
          <span />
        </div>

        <div className="resolution-memory">
          <span className="resolution-kicker">Customer memory</span>
          <b>100%</b>
          <small>Confirmed mapping</small>
        </div>

        <div className="resolution-rail" aria-hidden="true">
          <span />
          <i>→</i>
          <span />
        </div>

        <div className="resolution-result">
          <span className="resolution-kicker">Canonical product</span>
          <b>GRU-98561418</b>
          <strong>Grundfos ALPHA2 25-60</strong>
          <small>Exact saved match</small>
        </div>
      </div>
    </section>
  );
}

export function CustomerMemoryV2() {
  return (
    <section className="marketing-shell v2-section memory-v2" id="memory">
      <div className="v2-section-copy">
        <SectionLabel>Customer memory</SectionLabel>
        <h2>Every correction becomes reusable knowledge.</h2>
        <p>
          When your team confirms a match, Rivora remembers it for that customer
          and applies the mapping automatically on the next RFQ.
        </p>
      </div>

      <div className="memory-v2-proof">
        <div className="memory-v2-customer">
          <span>Example customer</span>
          <small>Customer-specific product memory</small>
        </div>

        <div className="memory-v2-flow">
          <div>
            <span>Previous RFQ</span>
            <b>PUMP-37A</b>
            <small>Human confirmed</small>
          </div>

          <i aria-hidden="true">→</i>

          <div className="memory-v2-saved">
            <span>Saved mapping</span>
            <b>GRU-98561418</b>
            <small>ALPHA2 25-60</small>
          </div>

          <i aria-hidden="true">→</i>

          <div>
            <span>Next RFQ</span>
            <b>100%</b>
            <small>Customer memory</small>
          </div>
        </div>

        <div className="memory-v2-note">
          <span>Learn once</span>
          <i />
          <span>Reuse automatically</span>
        </div>
      </div>
    </section>
  );
}

export function HowItWorksV2() {
  const steps = [
    {
      n: "01",
      title: "Extract",
      body: "PDFs, spreadsheets and emails become structured line items.",
      meta: "Source preserved",
    },
    {
      n: "02",
      title: "Resolve",
      body: "Customer product language is matched to your canonical catalogue.",
      meta: "Memory + exact identifiers",
    },
    {
      n: "03",
      title: "Review",
      body: "Only uncertain lines require human attention before quoting.",
      meta: "Human-in-the-loop",
    },
  ];

  return (
    <section className="marketing-shell v2-section how-v2" id="how-it-works">
      <div className="v2-section-copy">
        <SectionLabel>How it works</SectionLabel>
        <h2>From incoming RFQ to quote-ready lines.</h2>
        <p>
          Rivora turns unstructured customer requests into resolved, reviewable
          product lines without forcing your team through repeated manual searches.
        </p>
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

export function ConfidenceSystemV2() {
  const rows = [
    ["Customer memory", "100%", "Auto"],
    ["Exact SKU", "99%", "Auto"],
    ["Manufacturer PN", "97%", "Auto"],
    ["Fuzzy match", "78%", "Review"],
    ["No match", "0%", "Review"],
  ] as const;

  return (
    <section className="marketing-shell v2-section confidence-v2" id="confidence">
      <div className="v2-section-copy">
        <SectionLabel>Confidence system</SectionLabel>
        <h2>Automation where it’s safe. Humans where it matters.</h2>
        <p>
          High-confidence, deterministic matches move forward automatically.
          Anything uncertain is routed to review with the match method and score visible.
        </p>
      </div>

      <div className="confidence-v2-proof">
        <div className="confidence-v2-head">
          <span>Match method</span>
          <span>Confidence</span>
          <span>Route</span>
        </div>

        <div className="confidence-v2-table">
          {rows.map(([method, confidence, route]) => {
            const review = route === "Review";
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
          <span>Example review threshold</span>
          <b>90%</b>
          <div className="confidence-v2-scale" aria-hidden="true">
            <i />
            <strong />
          </div>
          <div className="confidence-v2-scale-labels">
            <span>Review</span>
            <span>Auto-process</span>
          </div>
        </div>
      </div>
    </section>
  );
}

export function AiExtractionV2() {
  return (
    <section className="marketing-shell v2-section ai-v2" id="ai-extraction">
      <div className="v2-section-copy">
        <SectionLabel>AI extraction</SectionLabel>
        <h2>AI structures. Rivora shows the evidence. You approve.</h2>
        <p>
          Every line keeps its source, extraction result, match method and confidence
          visible so your team can review decisions instead of trusting a black box.
        </p>
      </div>

      <div className="ai-v2-proof">
        <div className="ai-v2-source">
          <span className="ai-v2-kicker">Source · Page 2</span>
          <b>PUMP-37A</b>
          <strong>Circulation pump</strong>
          <small>10 pcs</small>
        </div>

        <div className="ai-v2-chain" aria-label="Audit trail">
          <div>
            <span>01</span>
            <b>Source</b>
            <small>PDF · Page 2</small>
          </div>
          <i>→</i>
          <div>
            <span>02</span>
            <b>Extraction</b>
            <small>96% confidence</small>
          </div>
          <i>→</i>
          <div>
            <span>03</span>
            <b>Product match</b>
            <small>99% · Exact SKU</small>
          </div>
          <i>→</i>
          <div>
            <span>04</span>
            <b>Review</b>
            <small>Ready to approve</small>
          </div>
        </div>

        <div className="ai-v2-result">
          <div>
            <span>Matched product</span>
            <b>GRU-98561418</b>
            <small>Grundfos ALPHA2 25-60</small>
          </div>
          <div>
            <span>Method</span>
            <b>Exact SKU</b>
            <small>Source preserved</small>
          </div>
          <div>
            <span>Confidence</span>
            <b>99%</b>
            <small>Above 90% threshold</small>
          </div>
        </div>
      </div>
    </section>
  );
}

export function BeforeAfterV2() {
  const before = [
    "Open the PDF",
    "Search ERP",
    "Search old quotes",
    "Decode customer SKUs",
    "Copy product details",
    "Build the quote",
  ];

  const after = [
    "Upload RFQ",
    "Extract line items",
    "Resolve products",
    "Review uncertainty",
    "Approve matches",
    "Quote-ready lines",
  ];

  return (
    <section className="marketing-shell v2-section before-after-v2" id="before-after">
      <div className="v2-section-copy">
        <SectionLabel>Before / after</SectionLabel>
        <h2>Less searching. More quoting.</h2>
        <p>
          Rivora replaces repeated product lookup work with a controlled workflow
          that preserves review where it actually matters.
        </p>
      </div>

      <div className="before-after-grid">
        <div className="before-after-column before">
          <div className="before-after-title">
            <span>Without Rivora</span>
            <small>Manual product-search loop</small>
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
            <span>With Rivora</span>
            <small>Controlled RFQ workflow</small>
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

export function FinalCtaV2() {
  return (
    <section className="marketing-shell final-cta-v2" id="get-started">
      <div className="final-cta-v2-card">
        <div className="final-cta-v2-shader" aria-hidden="true" />
        <div className="final-cta-v2-content">
          <SectionLabel>Start with one RFQ</SectionLabel>
          <h2>Your next RFQ could already be a quote.</h2>
          <p>
            Upload a PDF, XLSX or CSV and see what Rivora can extract, resolve and
            prepare for review.
          </p>

          <div className="final-cta-v2-actions">
            <Link href="/app/upload" className="final-cta-v2-primary">
              Upload an RFQ <span aria-hidden="true">→</span>
            </Link>
            <a href="#demo" className="final-cta-v2-secondary">
              Request a demo
            </a>
          </div>

          <div className="final-cta-v2-meta">
            <span>PDF / XLSX / CSV</span>
            <i />
            <span>Human approval</span>
            <i />
            <span>No ERP integration required to start</span>
          </div>
        </div>
      </div>
    </section>
  );
}
