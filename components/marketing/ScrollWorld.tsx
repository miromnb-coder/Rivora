"use client";

import { useEffect, useRef, useState } from "react";

const steps = [
  {
    no: "01",
    label: "Intake",
    title: "Every RFQ starts messy.",
    body: "PDFs, spreadsheets and email requests arrive in different formats, with different customer codes and descriptions.",
    proof: ["PDF", "XLSX", "EMAIL"],
  },
  {
    no: "02",
    label: "Extract",
    title: "Unstructured requests become structured line items.",
    body: "Rivora reads the RFQ and extracts customer details, references, product codes, descriptions and quantities.",
    proof: ["PUMP-37A", "10 PCS", "PAGE 1"],
  },
  {
    no: "03",
    label: "Resolve",
    title: "Customer language becomes your product language.",
    body: "Customer memory, exact SKUs and manufacturer part numbers are checked before uncertain candidates are considered.",
    proof: ["MEMORY", "SKU", "MPN"],
  },
  {
    no: "04",
    label: "Confidence",
    title: "Automation where it’s safe. Humans where it matters.",
    body: "Deterministic matches continue automatically. Uncertain lines are routed to review.",
    proof: ["100% AUTO", "99% AUTO", "78% REVIEW"],
  },
  {
    no: "05",
    label: "Review",
    title: "Your team only touches what needs judgment.",
    body: "Sales reviews only the uncertain matches, with the original customer context and suggested products side by side.",
    proof: ["1 ITEM", "78%", "CONFIRM"],
  },
  {
    no: "06",
    label: "Quote",
    title: "A clean quote emerges from the mess.",
    body: "Resolved lines come together as a ready-to-review quote for human approval.",
    proof: ["12 / 12", "€17,250", "READY"],
  },
];

export function ScrollWorld() {
  const sectionRef = useRef<HTMLElement>(null);
  const frameRef = useRef<number | null>(null);
  const [progress, setProgress] = useState(0);
  const [active, setActive] = useState(0);

  useEffect(() => {
    const update = () => {
      frameRef.current = null;
      const section = sectionRef.current;
      if (!section) return;

      const rect = section.getBoundingClientRect();
      const scrollable = Math.max(1, section.offsetHeight - window.innerHeight);
      const raw = Math.min(1, Math.max(0, -rect.top / scrollable));
      const nextActive = Math.min(steps.length - 1, Math.floor(raw * steps.length));

      setProgress(raw);
      setActive(nextActive);
    };

    const onScroll = () => {
      if (frameRef.current !== null) return;
      frameRef.current = window.requestAnimationFrame(update);
    };

    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);

    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (frameRef.current !== null) window.cancelAnimationFrame(frameRef.current);
    };
  }, []);

  const cameraX = progress * 68;
  const current = steps[active];

  return (
    <section ref={sectionRef} id="scroll-world" className="scroll-world-section" aria-label="Rivora RFQ processing journey">
      <div className="scroll-world-sticky">
        <div className="scroll-world-copy" aria-live="polite">
          <div className="scroll-world-kicker">RFQ PROCESSING LANDSCAPE</div>
          <div className="scroll-world-step">{current.no} / {current.label}</div>
          <h2>{current.title}</h2>
          <p>{current.body}</p>
          <div className="scroll-world-proof">
            {current.proof.map((item) => <span key={item}>{item}</span>)}
          </div>
          <div className="scroll-world-progress" aria-hidden="true">
            {steps.map((step, i) => <span key={step.no} className={i === active ? "active" : i < active ? "done" : ""} />)}
          </div>
        </div>

        <div className="scroll-world-viewport" aria-hidden="true">
          <div
            className="scroll-world-camera"
            style={{ transform: `translate3d(calc(-${cameraX}% + 1px), 0, 0)` }}
          >
            <div className="world-ground" />
            <div className="world-route route-main" />
            <div className="world-route route-review" />

            <div className="world-station station-intake">
              <div className="station-label">01 / Intake</div>
              <div className="intake-stack">
                <div className="doc-object pdf">PDF</div>
                <div className="doc-object xls">XLS</div>
                <div className="doc-object mail">MAIL</div>
              </div>
              <div className="world-float-card incoming">
                <b>Incoming RFQs</b>
                <span>Valve_RFQ_ACME.pdf</span>
                <span>BOM_Request.xlsx</span>
                <span>RFQ from Nordisk</span>
              </div>
            </div>

            <div className="world-station station-extract">
              <div className="station-label">02 / Extract</div>
              <div className="world-machine">
                <span className="machine-brand">RIVORA</span>
                <div className="machine-door"><span>RFQ</span></div>
              </div>
              <div className="line-item-stack">
                <span>PUMP-37A · 10 pcs</span>
                <span>BV-220 · 25 pcs</span>
                <span>PS-1000 · 5 pcs</span>
              </div>
              <div className="world-float-card extracted">
                <b>Extracted line items</b>
                <span>PUMP-37A — 10 pcs</span>
                <span>Ball valve — 25 pcs</span>
                <span>Pressure sensor — 5 pcs</span>
              </div>
            </div>

            <div className="world-station station-resolve">
              <div className="station-label">03 / Resolve</div>
              <div className="resolver-core">
                <span>RIVORA</span>
                <small>PRODUCT RESOLVER</small>
              </div>
              <div className="product-shelf">
                <span>GRU-98561418</span>
                <span>VLV-441002</span>
                <span>SEN-773440</span>
              </div>
              <div className="world-float-card mapping">
                <b>Matching to supplier products</b>
                <span>PUMP-37A → GRU-98561418</span>
                <span>BV-220 → VLV-441002</span>
                <span>PS-1000 → SEN-773440</span>
              </div>
            </div>

            <div className="world-station station-confidence">
              <div className="station-label">04 / Confidence</div>
              <div className="confidence-gate">
                <div className="gate-opening" />
              </div>
              <div className="world-float-card confidence">
                <b>Confidence check</b>
                <span><strong>100%</strong> Customer memory · Auto</span>
                <span><strong>99%</strong> Exact SKU · Auto</span>
                <span className="review"><strong>78%</strong> Fuzzy candidate · Review</span>
              </div>
              <div className="route-tag auto">AUTO</div>
              <div className="route-tag needs-review">REVIEW</div>
            </div>

            <div className="world-station station-review">
              <div className="station-label">05 / Review</div>
              <div className="review-desk">
                <div className="review-screen">
                  <b>OLD-991-A</b>
                  <span>Suggested: GRU-98561418</span>
                  <strong>78%</strong>
                  <button tabIndex={-1}>Confirm match</button>
                </div>
              </div>
              <div className="memory-loop">LEARNED → CUSTOMER MEMORY</div>
            </div>

            <div className="world-station station-quote">
              <div className="station-label">06 / Quote</div>
              <div className="quote-output">
                <div className="quote-paper">
                  <small>RIVORA</small>
                  <b>Quote ready</b>
                  <span>Nordic Process Service Oy</span>
                  <div className="quote-lines"><i /><i /><i /><i /></div>
                  <strong>€17,250</strong>
                </div>
              </div>
              <div className="world-float-card quote-ready">
                <b>Ready for approval</b>
                <span>12 / 12 lines resolved</span>
                <span>0 unresolved</span>
              </div>
            </div>
          </div>

          <div className="scroll-world-vignette" />
          <div className="scroll-world-hint">Scroll to follow an RFQ <span>↓</span></div>
        </div>
      </div>

      <ol className="sr-only">
        {steps.map((step) => <li key={step.no}>{step.no} {step.label}: {step.title} {step.body}</li>)}
      </ol>
    </section>
  );
}
