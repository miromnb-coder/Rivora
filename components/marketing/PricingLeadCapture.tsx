"use client";

import { FormEvent, useRef, useState } from "react";
import type { Locale } from "@/lib/locale";

type SubmitState = "idle" | "submitting" | "sent" | "error";

export function PricingLeadCapture({ locale }: { locale: Locale }) {
  const fi = locale === "fi";
  const formRef = useRef<HTMLDivElement>(null);
  const [submitState, setSubmitState] = useState<SubmitState>("idle");
  const [error, setError] = useState("");

  function scrollToPilotForm() {
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
        intent: "pilot",
        rfqVolume: data.get("rfqVolume"),
        message: data.get("message"),
        website: data.get("website"),
      }),
    });

    const result = (await response.json().catch(() => ({}))) as { error?: string };

    if (!response.ok) {
      setSubmitState("error");
      setError(
        result.error ||
          (fi
            ? "Pyyntöä ei voitu tallentaa. Yritä uudelleen."
            : "We could not save your request. Please try again."),
      );
      return;
    }

    form.reset();
    setSubmitState("sent");
  }

  const features = fi
    ? [
        "Koko RFQ → tarjous -työnkulku",
        "PDF / XLSX / CSV -syöte",
        "Tuotteiden ratkaisu + ihmisen vahvistus",
        "Customer Memory",
        "Quote Builder + PDF + sähköpostilähetys",
        "Onboarding ja suora tuki sisältyvät",
        "Ei setup-maksua",
        "Ei käyttäjäkohtaista hinnoittelua pilotin aikana",
      ]
    : [
        "Complete RFQ → quote workflow",
        "PDF / XLSX / CSV intake",
        "Product resolution + human confirmation",
        "Customer Memory",
        "Quote Builder + PDF + email delivery",
        "Onboarding and direct support included",
        "No setup fee",
        "No per-user pricing during the pilot",
      ];

  return (
    <section className="marketing-shell v2-section pricing-lead" id="pricing">
      <div className="v2-section-copy">
        <div className="v2-section-label">
          {fi ? "Yksi selkeä sopimus" : "One simple plan"}
        </div>
        <h2>
          {fi
            ? "Aloita Nodra Pilotilla."
            : "Start with the Nodra Pilot."}
        </h2>
        <p>
          {fi
            ? "Yksi sopimus, koko nykyinen Nodra ja selkeä kolmen kuukauden pilotti. Ei pakettivertailua, setup-maksua tai käyttäjäkohtaista hinnoittelua pilotin aikana."
            : "One agreement, the full Nodra product and a clear three-month pilot. No package comparison, setup fee or per-user pricing during the pilot."}
        </p>
      </div>

      <div className="pricing-lead-grid pricing-lead-grid-single">
        <article className="pricing-lead-card pricing-lead-card-single">
          <div className="pricing-pilot-main">
            <span className="pricing-lead-eyebrow">
              {fi ? "3 kuukauden minimijakso" : "3-month minimum"}
            </span>
            <h3>Nodra Pilot</h3>
            <div className="pricing-pilot-price">
              <strong>990 €</strong>
              <span>{fi ? "/ kk + ALV" : "/ month + VAT"}</span>
            </div>
            <p>
              {fi
                ? "Ensimmäisen kolmen kuukauden kokonaisarvo on 2 970 € + ALV. Pilotin jälkeen sopimus voi jatkua 990 €/kk samalla laajuudella."
                : "The first three months total €2,970 + VAT. After the pilot, the agreement can continue at €990/month with the same scope."}
            </p>
          </div>

          <div className="pricing-pilot-details">
            <ul>
              {features.map((feature) => (
                <li key={feature}>{feature}</li>
              ))}
            </ul>

            <button type="button" onClick={scrollToPilotForm}>
              {fi ? "Aloita pilotti" : "Start the pilot"}{" "}
              <span aria-hidden="true">→</span>
            </button>
          </div>
        </article>
      </div>

      <div className="lead-capture-v2" id="demo" ref={formRef}>
        <div className="lead-capture-copy">
          <div className="v2-section-label">
            {fi ? "Aloita Nodra Pilot" : "Start the Nodra Pilot"}
          </div>
          <h3>
            {fi
              ? "Kerro lyhyesti nykyisestä tarjouspyyntötyönkulustanne."
              : "Tell us briefly about your current RFQ workflow."}
          </h3>
          <p>
            {fi
              ? "Käymme yhdessä läpi nykyisen prosessin ja sovitaan, miten ensimmäiset oikeat tarjouspyynnöt viedään Nodran läpi pilotin aikana."
              : "We will review your current process together and agree how the first real RFQs will be run through Nodra during the pilot."}
          </p>

          <div className="lead-capture-proof">
            <span>{fi ? "990 €/kk + ALV" : "€990/month + VAT"}</span>
            <i />
            <span>{fi ? "3 kk minimijakso" : "3-month minimum"}</span>
            <i />
            <span>{fi ? "Onboarding sisältyy" : "Onboarding included"}</span>
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
              <input
                name="workEmail"
                type="email"
                autoComplete="email"
                required
                maxLength={320}
              />
            </label>
          </div>

          <div className="lead-form-row">
            <label>
              <span>{fi ? "Yritys" : "Company"}</span>
              <input
                name="company"
                autoComplete="organization"
                required
                maxLength={160}
              />
            </label>
            <label>
              <span>
                {fi ? "Rooli" : "Role"}{" "}
                <em>{fi ? "valinnainen" : "optional"}</em>
              </span>
              <input
                name="role"
                autoComplete="organization-title"
                maxLength={120}
              />
            </label>
          </div>

          <label>
            <span>
              {fi ? "Tarjouspyyntöjä kuukaudessa" : "RFQs per month"}{" "}
              <em>{fi ? "valinnainen" : "optional"}</em>
            </span>
            <select name="rfqVolume" defaultValue="">
              <option value="">{fi ? "Valitse määrä" : "Select range"}</option>
              <option value="1-10">1–10</option>
              <option value="11-50">11–50</option>
              <option value="51-200">51–200</option>
              <option value="200+">200+</option>
            </select>
          </label>

          <label>
            <span>
              {fi
                ? "Mitä haluaisit parantaa nykyisessä prosessissa?"
                : "What would you like to improve in the current process?"}{" "}
              <em>{fi ? "valinnainen" : "optional"}</em>
            </span>
            <textarea
              name="message"
              rows={4}
              maxLength={2000}
              placeholder={
                fi
                  ? "Esimerkiksi: tuotekoodien mätsäys, toistuvat ERP-haut, tarjousten tarkistus..."
                  : "For example: product-code matching, repetitive ERP searches, quote review..."
              }
            />
          </label>

          <label className="lead-honeypot" aria-hidden="true">
            Website
            <input name="website" tabIndex={-1} autoComplete="off" />
          </label>

          <div className="lead-form-submit">
            <button type="submit" disabled={submitState === "submitting"}>
              {submitState === "submitting"
                ? fi
                  ? "Lähetetään…"
                  : "Sending…"
                : fi
                  ? "Pyydä Nodra Pilot"
                  : "Request Nodra Pilot"}
              {submitState !== "submitting" && (
                <span aria-hidden="true">→</span>
              )}
            </button>
            <p>
              {fi
                ? "Käytämme näitä tietoja vain pyyntöösi vastaamiseen."
                : "We use these details only to respond to your request."}
            </p>
          </div>

          {submitState === "sent" && (
            <div className="lead-form-message success" role="status">
              {fi
                ? "Pyyntö vastaanotettu. Olemme yhteydessä pilotin käynnistämisestä."
                : "Request received. We will follow up about starting the pilot."}
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
