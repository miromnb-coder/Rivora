"use client";

import { useEffect, useRef, useState } from "react";
import { ScrollWorld3D } from "./ScrollWorld3D";

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
  const [isMobile, setIsMobile] = useState(false);
  const [webglReady, setWebglReady] = useState(false);

  useEffect(() => {
    const update = () => {
      frameRef.current = null;
      const section = sectionRef.current;
      if (!section) return;

      const rect = section.getBoundingClientRect();
      const scrollable = Math.max(1, section.offsetHeight - window.innerHeight);
      const raw = Math.min(1, Math.max(0, -rect.top / scrollable));
      const position = raw * (steps.length - 1);
      const nextActive = Math.min(steps.length - 1, Math.max(0, Math.round(position)));

      setProgress(raw);
      setActive(nextActive);
      setIsMobile(window.innerWidth <= 720);
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

  const current = steps[active];

  const desktopCamera = [
    { x: 0, y: 0, scale: 1 },
    { x: -600, y: 0, scale: 1.02 },
    { x: -1260, y: -4, scale: 1.03 },
    { x: -1930, y: -8, scale: 1.04 },
    { x: -2600, y: -12, scale: 1.055 },
    { x: -3220, y: -16, scale: 1.07 },
  ];

  const mobileCamera = [
    { x: 0, y: 18, scale: 1 },
    { x: -500, y: 10, scale: 1.06 },
    { x: -1015, y: 0, scale: 1.1 },
    { x: -1545, y: -8, scale: 1.14 },
    { x: -2100, y: -16, scale: 1.18 },
    { x: -2645, y: -24, scale: 1.21 },
  ];

  const cameraMap = isMobile ? mobileCamera : desktopCamera;
  const position = progress * (steps.length - 1);
  const fromIndex = Math.floor(position);
  const toIndex = Math.min(steps.length - 1, fromIndex + 1);
  const t = position - fromIndex;
  const from = cameraMap[fromIndex];
  const to = cameraMap[toIndex];
  const lerp = (a: number, b: number) => a + (b - a) * t;
  const camera = {
    x: lerp(from.x, to.x),
    y: lerp(from.y, to.y),
    scale: lerp(from.scale, to.scale),
  };

  const stationClass = (index: number, base: string) =>
    `world-station ${base} ${index === active ? "is-active" : Math.abs(index - active) === 1 ? "is-near" : "is-dim"}`;

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
          <ScrollWorld3D
            progress={progress}
            active={active}
            onReady={() => setWebglReady(true)}
          />
          {!webglReady && (
          <div
            className="scroll-world-camera scroll-world-fallback"
            style={{
              transform: `translate3d(${camera.x}px, ${camera.y}px, 0) scale(${camera.scale})`,
            }}
          >
            <div className="world-ground" />
            <div className="world-route route-main" />
            <div className="world-route route-review" />

            <div className={stationClass(0, "station-intake")}>
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

            <div className={stationClass(1, "station-extract")}>
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

            <div className={stationClass(2, "station-resolve")}>
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

            <div className={stationClass(3, "station-confidence")}>
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

            <div className={stationClass(4, "station-review")}>
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

            <div className={stationClass(5, "station-quote")}>
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
          )}

          <div className="scroll-world-vignette" />
          {active === 0 && (
            <div className="scroll-world-hint">Scroll to follow an RFQ <span>↓</span></div>
          )}
        </div>
      </div>

      <ol className="sr-only">
        {steps.map((step) => <li key={step.no}>{step.no} {step.label}: {step.title} {step.body}</li>)}
      </ol>
    </section>
  );
}
