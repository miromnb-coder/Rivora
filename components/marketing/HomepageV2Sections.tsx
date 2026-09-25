function SectionLabel({ children }: { children: React.ReactNode }) {
  return <div className="v2-section-label">{children}</div>;
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
          <span>Nordic Process Service Oy</span>
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
          <span>Confidence threshold</span>
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
