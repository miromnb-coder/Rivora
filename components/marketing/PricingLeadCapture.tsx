"use client";

import { FormEvent, useRef, useState } from "react";
import type { Locale } from "@/lib/locale";

type Intent = "pilot" | "pricing" | "demo";
type SubmitState = "idle" | "submitting" | "sent" | "error";

const plans = [
  {
    name: "Pilot",
    eyebrow: "Evaluate the workflow",
    price: "Scoped pilot",
    body: "Start with real RFQs and validate extraction, product resolution and review with one team.",
    features: [
      "PDF / XLSX / CSV intake",
      "Product resolution + confidence",
      "Customer product memory",
      "No ERP integration required",
    ],
    intent: "pilot" as Intent,
    cta: "Request a pilot",
  },
  {
    name: "Team",
    eyebrow: "For recurring RFQ work",
    price: "Volume-based",
    body: "Move repeated RFQ handling into a shared, reviewable workflow as usage becomes regular.",
    features: [
      "Everything in Pilot",
      "Shared team workflow",
      "Customer-specific memory",
      "Quote history and approvals",
    ],
    intent: "pricing" as Intent,
    cta: "Request pricing",
  },
  {
    name: "Scale",
    eyebrow: "For broader rollout",
    price: "Custom scope",
    body: "Plan higher-volume use, multiple workflows and integration work around your existing systems.",
    features: [
      "Higher RFQ volume",
      "Rollout planning",
      "Integration scoping",
      "Custom onboarding",
    ],
    intent: "demo" as Intent,
    cta: "Talk through rollout",
  },
];

export function PricingLeadCapture({ locale }: { locale: Locale }) {
  const fi = locale === "fi";
  const localizedPlans = plans.map((plan) => {
    if (!fi) return plan;
    const translations = {
      pilot: {
        name: "Pilotti", eyebrow: "Arvioi työnkulku", price: "Rajattu pilotti",
        body: "Aloita oikeilla tarjouspyynnöillä ja validoi poiminta, tuotteiden ratkaisu ja tarkistus yhden tiimin kanssa.",
        features: ["PDF / XLSX / CSV -syöte", "Tuotteiden ratkaisu + varmuus", "Asiakaskohtainen tuotemuisti", "ERP-integraatiota ei tarvita"],
        cta: "Pyydä pilottia",
      },
      pricing: {
        name: "Tiimi", eyebrow: "Toistuvaan tarjouspyyntötyöhön", price: "Volyymiperusteinen",
        body: "Siirrä toistuva tarjouspyyntöjen käsittely yhteiseen, tarkistettavaan työnkulkuun käytön kasvaessa.",
        features: ["Kaikki Pilotissa", "Yhteinen tiimityönkulku", "Asiakaskohtainen muisti", "Tarjoushistoria ja hyväksynnät"],
        cta: "Pyydä hinnoittelu",
      },
      demo: {
        name: "Skaala", eyebrow: "Laajempaan käyttöönottoon", price: "Mukautettu laajuus",
        body: "Suunnittele suuremmat volyymit, useat työnkulut ja integraatiot nykyisten järjestelmiesi ympärille.",
        features: ["Suurempi RFQ-volyymi", "Käyttöönoton suunnittelu", "Integraatioiden määrittely", "Mukautettu onboarding"],
        cta: "Keskustele käyttöönotosta",
      },
    }[plan.intent];
    return { ...plan, ...translations };
  });
  const formRef = useRef<HTMLDivElement>(null);
  const [intent, setIntent] = useState<Intent>("demo");
  const [submitState, setSubmitState] = useState<SubmitState>("idle");
  const [error, setError] = useState("");

  function chooseIntent(nextIntent: Intent) {
    setIntent(nextIntent);
    setSubmitState("idle");
    setError("");
    requestAnimationFrame(() => {
      formRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    });
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitState("submitting");
    setError("");

    const form = event.currentTarget;
    const data = new FormData(form);

    const response = await fetch("/api/leads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: data.get("name"),
        workEmail: data.get("workEmail"),
        company: data.get("company"),
        role: data.get("role"),
        intent,
        rfqVolume: data.get("rfqVolume"),
        message: data.get("message"),
        website: data.get("website"),
      }),
    });

    const result = (await response.json().catch(() => ({}))) as { error?: string };

    if (!response.ok) {
      setSubmitState("error");
      setError(result.error || (fi ? "Pyyntöä ei voitu tallentaa. Yritä uudelleen." : "We could not save your request. Please try again."));
      return;
    }

    form.reset();
    setSubmitState("sent");
  }

  return (
    <section className="marketing-shell v2-section pricing-lead" id="pricing">
      <div className="v2-section-copy">
        <div className="v2-section-label">{fi ? "Hinnoittelu ja käyttöönotto" : "Pricing & rollout"}</div>
        <h2>{fi ? "Aloita yhdellä työnkululla. Skaalaa, kun hyöty on todistettu." : "Start with one workflow. Scale when it proves useful."}</h2>
        <p>
          Pricing is scoped around RFQ volume and rollout needs. You can evaluate
          Nodra with real customer requests before committing to integration work.
        </p>
      </div>

      <div className="pricing-lead-grid">
        {localizedPlans.map((plan) => (
          <article className="pricing-lead-card" key={plan.name}>
            <div>
              <span className="pricing-lead-eyebrow">{plan.eyebrow}</span>
              <h3>{plan.name}</h3>
              <strong>{plan.price}</strong>
              <p>{plan.body}</p>
            </div>

            <ul>
              {plan.features.map((feature) => (
                <li key={feature}>{feature}</li>
              ))}
            </ul>

            <button type="button" onClick={() => chooseIntent(plan.intent)}>
              {plan.cta} <span aria-hidden="true">→</span>
            </button>
          </article>
        ))}
      </div>

      <div className="lead-capture-v2" id="demo" ref={formRef}>
        <div className="lead-capture-copy">
          <div className="v2-section-label">{fi ? "Pyydä keskustelua" : "Request a conversation"}</div>
          <h3>{fi ? "Kerro, miltä tarjouspyyntötyönkulkunne näyttää." : "Tell us what your RFQ workflow looks like."}</h3>
          <p>
            Share the basics. The request is saved to Nodra and can be followed up
            based on whether you want a pilot, pricing or a demo.
          </p>

          <div className="lead-capture-proof">
            <span>One form</span><i />
            <span>No account required</span><i />
            <span>No ERP setup required</span>
          </div>
        </div>

        <form className="lead-capture-form" onSubmit={submit}>
          <div className="lead-form-row">
            <label>
              <span>{fi ? "Nimi" : "Name"}</span>
              <input name="name" autoComplete="name" required maxLength={120} />
            </label>
            <label>
              <span>{fi ? "Työsähköposti" : "Work email"}</span>
              <input name="workEmail" type="email" autoComplete="email" required maxLength={320} />
            </label>
          </div>

          <div className="lead-form-row">
            <label>
              <span>{fi ? "Yritys" : "Company"}</span>
              <input name="company" autoComplete="organization" required maxLength={160} />
            </label>
            <label>
              <span>Role <em>optional</em></span>
              <input name="role" autoComplete="organization-title" maxLength={120} />
            </label>
          </div>

          <div className="lead-form-row">
            <label>
              <span>{fi ? "Olen kiinnostunut" : "I'm interested in"}</span>
              <select value={intent} onChange={(event) => setIntent(event.target.value as Intent)}>
                <option value="pilot">{fi ? "Pilotti" : "Pilot"}</option>
                <option value="pricing">{fi ? "Hinnoittelu" : "Pricing"}</option>
                <option value="demo">{fi ? "Demo / käyttöönotto" : "Demo / rollout discussion"}</option>
              </select>
            </label>
            <label>
              <span>RFQs per month <em>optional</em></span>
              <select name="rfqVolume" defaultValue="">
                <option value="">{fi ? "Valitse määrä" : "Select range"}</option>
                <option value="1-10">1–10</option>
                <option value="11-50">11–50</option>
                <option value="51-200">51–200</option>
                <option value="200+">200+</option>
              </select>
            </label>
          </div>

          <label>
            <span>What would you like to improve? <em>optional</em></span>
            <textarea
              name="message"
              rows={4}
              maxLength={2000}
              placeholder="For example: product-code matching, repetitive ERP searches, quote review..."
            />
          </label>

          <label className="lead-honeypot" aria-hidden="true">
            Website
            <input name="website" tabIndex={-1} autoComplete="off" />
          </label>

          <div className="lead-form-submit">
            <button type="submit" disabled={submitState === "submitting"}>
              {submitState === "submitting" ? (fi ? "Lähetetään…" : "Sending…") : (fi ? "Lähetä pyyntö" : "Send request")}
              {submitState !== "submitting" && <span aria-hidden="true">→</span>}
            </button>
            <p>{fi ? "Käytämme näitä tietoja vain pyyntöösi vastaamiseen." : "We use these details only to respond to your request."}</p>
          </div>

          {submitState === "sent" && (
            <div className="lead-form-message success" role="status">
              Request received. Your details are saved for follow-up.
            </div>
          )}

          {submitState === "error" && (
            <div className="lead-form-message error" role="alert">
              {error}
            </div>
          )}
        </form>
      </div>
    </section>
  );
}
