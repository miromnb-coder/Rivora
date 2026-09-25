import Link from "next/link";

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <div className="marketing-label"><span />{children}</div>;
}

function MatchBadge({ tone = "green", children }: { tone?: "green" | "amber" | "gray"; children: React.ReactNode }) {
  return <span className={`match-badge ${tone}`}>{children}</span>;
}

export function HeroSection() {
  return (
    <section id="product" className="marketing-shell hero-section">
      <div className="hero-orbit" aria-hidden="true" />
      <div className="hero-copy">
        <div className="hero-eyebrow"><span />AI quote desk for industrial sales teams</div>
        <h1>Turn messy RFQs into<br className="hidden md:block" /> ready-to-review quotes.</h1>
        <p>Nodra reads customer PDFs and spreadsheets, resolves product codes, learns customer-specific mappings and prepares the quote for human approval.</p>
        <div className="mt-7 flex flex-wrap justify-center gap-3">
          <Link href="/app/upload" className="marketing-button primary large">Process an RFQ <span>→</span></Link>
          <a href="#how-it-works" className="marketing-button secondary large">See how it works</a>
        </div>
      </div>
      <div className="hero-workflow">
        <div className="workflow-panel">
          <div className="workflow-head">
            <div><div className="workflow-title">Customer request</div><div className="workflow-sub">PDF, Excel or email</div></div>
            <span className="mini-pill">View original ↗</span>
          </div>
          <div className="request-card">
            <div className="flex items-start justify-between gap-4">
              <div><div className="text-xs text-[#69736d]">ACME Industrial</div><div className="mt-1 font-extrabold">Request for Quotation</div></div>
              <div className="text-right text-xs text-[#69736d]">RFQ-2026-1187<br/>Sep 24, 2026</div>
            </div>
            <div className="request-table mt-5">
              <div className="table-row head"><span>#</span><span>Description</span><span>Customer code</span><span>Qty</span></div>
              {[
                ["1","Circulation pump","PUMP-37A","10 pcs"],
                ["2","Ball valve","BV-220","25 pcs"],
                ["3","Pressure sensor","PS-1000","5 pcs"],
                ["4","Expansion tank","XT-8","2 pcs"],
              ].map((row) => <div className="table-row" key={row[0]}>{row.map((cell) => <span key={cell}>{cell}</span>)}</div>)}
            </div>
          </div>
        </div>
        <div className="workflow-divider" aria-hidden="true">→</div>
        <div className="workflow-panel">
          <div className="workflow-head">
            <div><div className="workflow-title">Nodra output</div><div className="workflow-sub">Matched products and quote-ready lines</div></div>
            <MatchBadge>Ready for review</MatchBadge>
          </div>
          <div className="output-table">
            <div className="output-row output-head"><span>Customer input</span><span>Nodra match</span><span>Confidence</span><span>Source</span></div>
            <div className="output-row"><span><b>PUMP-37A</b><small>Circulation pump · 10 pcs</small></span><span><b>GRU-98561418</b><small>ALPHA2 25-60</small></span><MatchBadge>99% match</MatchBadge><MatchBadge tone="gray">Customer memory</MatchBadge></div>
            <div className="output-row"><span><b>BV-220</b><small>Ball valve · 25 pcs</small></span><span><b>VLV-441002</b><small>KSB Ball Valve DN50</small></span><MatchBadge>98% match</MatchBadge><MatchBadge tone="gray">Exact SKU</MatchBadge></div>
            <div className="output-row"><span><b>PS-1000</b><small>Pressure sensor · 5 pcs</small></span><span><b>SEN-773440</b><small>WIKA A-10</small></span><MatchBadge>96% match</MatchBadge><MatchBadge tone="gray">Customer memory</MatchBadge></div>
            <div className="output-row"><span><b>XT-8</b><small>Expansion tank · 2 pcs</small></span><span><b>TANK-32008</b><small>Reflex N 80</small></span><MatchBadge tone="amber">Needs review</MatchBadge><MatchBadge tone="amber">Similar match</MatchBadge></div>
          </div>
        </div>
      </div>
    </section>
  );
}

export function LightDarkTransition() {
  return (
    <div className="marketing-transition" aria-hidden="true">
      <div className="transition-arc arc-one" />
      <div className="transition-arc arc-two" />
      <div className="transition-grid" />
      <div className="transition-dot one" />
      <div className="transition-dot two" />
    </div>
  );
}

export function HowItWorks() {
  const steps = [
    { n:"01", title:"Extract", body:"PDF, Excel and email RFQs become structured line items.", visual:["PDF document","Excel spreadsheet","Email request"] },
    { n:"02", title:"Resolve", body:"Customer SKUs are matched to your canonical catalogue.", visual:["PUMP-37A → GRU-98561418","BV-220 → VLV-441002","PS-1000 → SEN-773440"] },
    { n:"03", title:"Review", body:"Only uncertain lines require a human decision.", visual:["Needs review · 1","Ready to quote · 3","Confirm match"] },
  ];
  return (
    <section id="how-it-works" className="dark-section">
      <div className="marketing-shell">
        <div className="dark-heading">
          <SectionLabel>How it works</SectionLabel>
          <h2>From inbox to quote,<br/>without the product-search grind.</h2>
          <p>Nodra automates RFQ intake, product resolution and review, turning messy customer requests into quote-ready lines in minutes.</p>
        </div>
        <div className="dark-card-grid">
          {steps.map((step) => (
            <article key={step.n} className="dark-step-card">
              <div className="flex items-start gap-4"><span className="step-number">{step.n}</span><div><h3>{step.title}</h3><p>{step.body}</p></div></div>
              <div className="step-visual">
                {step.visual.map((line, i) => {
                  const tag = step.n==="01" ? ["PDF","XLS","MAIL"][i] : step.n==="02" ? ["MAP","SKU","MPN"][i] : ["CHECK","READY","REVIEW"][i];
                  return <div key={line} className={i===2 && step.n==="03" ? "step-line active" : "step-line"}><span className="step-icon">{tag}</span><span>{line}</span></div>;
                })}
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

export function ProblemSolution() {
  return (
    <section className="marketing-shell light-section problem-section">
      <div className="problem-top"><SectionLabel>Problem & Solution</SectionLabel><h2>Real Problems Met With<br/>Practical Solutions</h2></div>
      <div className="circle-stage">
        <div className="problem-circle">
          <span className="circle-kicker">Problem</span>
          <p>Open the PDF. Search ERP. Search old quotes. Decode customer SKUs. Check stock. Copy prices. Build the quote.</p>
        </div>
        <div className="solution-circle">
          <span className="circle-kicker">Solution</span>
          <p>Upload RFQ. Extract line items. Match products. Review uncertain rows. Approve the quote.</p>
        </div>
      </div>
    </section>
  );
}

export function CustomerMemory() {
  const mappings = [
    ["PUMP-37A","GRU-98561418","ALPHA2 25-60"],
    ["BV-220","VLV-441002","KSB Ball valve DN20"],
    ["PS-1000","SEN-773440","WIKA pressure sensor"],
    ["XT-8","TANK-32008","Reflex N 80"],
  ];
  return (
    <section id="memory" className="marketing-shell light-section split-section">
      <div className="section-copy">
        <SectionLabel>Customer Memory</SectionLabel>
        <h2>Nodra gets better with every correction.</h2>
        <p>Each confirmed match becomes reusable knowledge for future RFQs.</p>
        <div className="feature-list">
          <div><i>01</i><span><b>Learns from your decisions</b><small>Every confirmed match is saved to your customer's product memory.</small></span></div>
          <div><i>02</i><span><b>Applies knowledge automatically</b><small>Future RFQs from the same customer are matched instantly.</small></span></div>
          <div><i>03</i><span><b>Gets more accurate over time</b><small>Your corrections make Nodra smarter for your business.</small></span></div>
        </div>
      </div>
      <div className="memory-ui">
        <div className="memory-head"><div><div className="text-xl font-black">Nordic Process Service Oy</div><div className="mt-1 text-sm text-[#758078]">Customer profile · Industrial pumps & valves</div></div><MatchBadge>24 learned mappings</MatchBadge></div>
        <div className="memory-tabs"><span>Overview</span><b>Product memory</b><span>RFQ history</span><span>Settings</span></div>
        <div className="memory-table">
          <div className="memory-row memory-row-head"><span>Customer SKU</span><span>Remembered as</span><span>Product details</span><span>Status</span></div>
          {mappings.map((m,i) => <div className={`memory-row ${i===0 ? "highlight":""}`} key={m[0]}><span><b>{m[0]}</b></span><span><b>→ &nbsp; {m[1]}</b></span><span>{m[2]}</span><MatchBadge>Learned mapping</MatchBadge></div>)}
        </div>
        <div className="next-rfq-card">
          <div><b>Next RFQ → 100% customer memory match</b><small>Nodra automatically applies your learned mappings.</small></div>
          <div className="next-rfq-flow"><b>PUMP-37A</b><span>→</span><b>GRU-98561418</b><MatchBadge>100% match</MatchBadge></div>
        </div>
      </div>
    </section>
  );
}

export function ConfidenceSystem() {
  const rows = [
    ["CUSTOMER MEMORY","100%","Auto","Auto-approved","Matched from customer memory","green"],
    ["EXACT SKU","99%","Auto","Auto-approved","Exact SKU match","green"],
    ["MANUFACTURER PN","97%","Auto","Auto-approved","Manufacturer part number","green"],
    ["FUZZY MATCH","78%","Review","Needs review","Similar product","amber"],
    ["NO MATCH","0%","Review","Routed to review","No match found","amber"],
  ] as const;
  return (
    <section id="confidence" className="marketing-shell light-section split-section reverse-mobile">
      <div className="section-copy">
        <SectionLabel>Confidence System</SectionLabel>
        <h2>Automation where it’s safe. Humans where it matters.</h2>
        <p>Nodra separates deterministic matches from uncertain ones and routes only risky lines to review.</p>
        <div className="feature-list compact">
          <div><i>01</i><span><b>Deterministic matching</b><small>Exact and high-confidence matches auto-process.</small></span></div>
          <div><i>02</i><span><b>Human review for uncertainty</b><small>Only uncertain lines are routed to your team.</small></span></div>
          <div><i>03</i><span><b>Audit-friendly by design</b><small>Every decision keeps its confidence and method.</small></span></div>
        </div>
      </div>
      <div className="confidence-ui">
        <div className="confidence-head"><div><div className="text-xl font-black">Confidence & routing</div><div className="text-sm text-[#758078]">How Nodra handles each line item</div></div><MatchBadge>Policy active</MatchBadge></div>
        <div className="confidence-chips"><span>✓ Deterministic</span><span>⚠ Review required</span><span>⌁ 90% threshold</span><span>▤ Audit-friendly</span></div>
        <div className="confidence-table">
          <div className="confidence-row head"><span>Match method</span><span>Confidence</span><span>Route</span><span>Status</span></div>
          {rows.map((r) => <div key={r[0]} className={`confidence-row ${r[5]}`}><span><b>{r[0]}</b><small>{r[4]}</small></span><span><b>{r[1]}</b></span><span>{r[2]}</span><MatchBadge tone={r[5]}>{r[3]}</MatchBadge></div>)}
        </div>
        <div className="threshold-bar"><div className="safe">Auto-process (≥ 90%)</div><div className="review">Route to review (&lt; 90%)</div><i /></div>
      </div>
    </section>
  );
}

export function AiExtraction() {
  return (
    <section id="ai-extraction" className="marketing-shell light-section split-section">
      <div className="section-copy">
        <SectionLabel>AI Extraction</SectionLabel>
        <h2>AI extracts. Nodra verifies. You approve.</h2>
        <p>PDF data extraction and product matching are intentionally separated for safety and control.</p>
        <div className="feature-list compact">
          <div><i>01</i><span><b>Full traceability</b><small>See exactly what was extracted, where it came from, and how it was matched.</small></span></div>
          <div><i>02</i><span><b>Separate extraction and matching</b><small>AI reads the document first. Nodra matches products in a second step.</small></span></div>
          <div><i>03</i><span><b>Human approval</b><small>Only reviewed lines move forward to quotes.</small></span></div>
        </div>
      </div>
      <div className="audit-ui">
        <div className="audit-head"><div><b>RFQ-2026-1187</b><small>ACME Industrial</small></div><MatchBadge>Ready for review</MatchBadge></div>
        <div className="audit-product"><b>PUMP-37A</b><span>Circulation pump · 10 pcs</span></div>
        <div className="audit-pipeline"><div><i>PDF</i><span><b>PDF extraction</b><small>Extracts text and structure</small></span></div><em>→</em><div><i>SKU</i><span><b>Product matching</b><small>Finds the best product in your catalog</small></span></div></div>
        <div className="audit-metrics"><div><span>PDF extraction</span><b>96%</b></div><div><span>Product match</span><b>99%</b></div><div><span>Source</span><b>Page 2</b></div><div><span>Method</span><b>Exact SKU</b></div></div>
        <div className="audit-bottom"><div className="audit-fields"><b>Extraction result</b><pre>PUMP-37A{"\n"}Circulation pump{"\n"}10 pcs</pre><div><span>Customer code</span><b>PUMP-37A</b></div><div><span>Description</span><b>Circulation pump</b></div><div><span>Quantity</span><b>10 pcs</b></div></div><div className="audit-side"><div className="audit-tabs">Verification <span>Warnings 1</span></div><div className="matched-product"><b>GRU-98561418</b><small>Grundfos ALPHA2 25-60</small></div><div className="warning-box"><b>Low confidence on description</b><small>Customer description differs slightly from catalog. Please confirm the match.</small></div></div></div>
      </div>
    </section>
  );
}

export function FinalCta() {
  return (
    <section id="pricing" className="marketing-shell cta-section">
      <div className="cta-card">
        <div className="cta-copy"><SectionLabel>Nodra</SectionLabel><h2>Your next RFQ could already be <em>a quote.</em></h2><p>Upload an RFQ and let Nodra extract, resolve and prepare it for review.</p><div className="mt-7 flex flex-wrap gap-3"><Link href="/app/upload" className="cta-primary">Upload an RFQ <span>→</span></Link><a href="mailto:hello@nodra.fi" className="cta-secondary">Book a demo →</a></div><small>PDF, XLSX or CSV. No ERP integration required to start.</small></div>
        <div className="cta-flow">
          <div className="file-stack"><span>PDF</span><span>XLSX</span><span>CSV</span></div>
          <div className="cta-rivora">R</div>
          <span className="cta-arrow">→</span>
          <div className="quote-card"><div className="flex items-center gap-2"><i>✓</i><b>Quote ready</b></div><div className="mt-5 space-y-3"><span>GRU-98561418 <b>10 pcs</b></span><span>VLV-441002 <b>25 pcs</b></span><span>SEN-773440 <b>5 pcs</b></span></div></div>
        </div>
        <div className="cta-features"><span><b>Fast setup</b><small>No ERP integration required</small></span><span><b>Your data stays secure</b><small>Organization-scoped access</small></span><span><b>Built for industrial teams</b><small>Save manual product-search time</small></span></div>
      </div>
    </section>
  );
}
