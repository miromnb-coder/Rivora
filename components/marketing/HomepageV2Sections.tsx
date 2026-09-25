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
