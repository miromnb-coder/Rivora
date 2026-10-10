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
        "Ei käyttäjäkohtaista hinnoittelua",
      ]
    : [
        "Complete RFQ → quote workflow",
        "PDF / XLSX / CSV intake",
        "Product resolution + human confirmation",
        "Customer Memory",
        "Quote Builder + PDF + email delivery",
        "Onboarding and direct support included",
        "No setup fee",
        "No per-user pricing",
      ];

  return (
    <section className="marketing-shell v2-section pricing-lead" id="pricing">
      <div className="v2-section-copy">
        <div className="v2-section-label">
          {fi ? "Yksi selkeä sopimus" : "One simple plan"}
        </div>
        <h2>
          {fi
            ? "Averomira selkeällä kuukausihinnalla."
            : "Averomira with straightforward monthly pricing."}
        </h2>
        <p>
          {fi
            ? "Yksi selkeä kuukausitilaus. Nykyiset ydintoiminnot sekä sovittu käyttöönotto ja tuki kuuluvat kokonaisuuteen."
            : "One clear monthly subscription. Current core features, agreed onboarding and support are included."}
        </p>

        <div className="pricing-fit">
          <span>{fi ? "Averomira sopii parhaiten, kun" : "Averomira is a strong fit when"}</span>
          <div className="pricing-fit-grid">
            <p>{fi ? "Tarjouspyyntöjä tulee toistuvasti PDF-, XLSX- tai CSV-muodossa." : "RFQs arrive repeatedly as PDF, XLSX or CSV files."}</p>
            <p>{fi ? "Tuoterivit pitää yhdistää omaan katalogiin ennen tarjousta." : "Line items need to be resolved against your own catalogue before quoting."}</p>
            <p>{fi ? "Tarjouksen jälkeen PO ja ERP-siirto vaativat vielä manuaalista tarkistusta." : "Customer POs and ERP handoff still require manual review after quoting."}</p>
          </div>
        </div>
      </div>

      <div className="pricing-lead-grid pricing-lead-grid-single">
        <article className="pricing-lead-card pricing-lead-card-single">
          <div className="pricing-pilot-main">
            <span className="pricing-lead-eyebrow">
              {fi ? "Kuukausittainen tilaus" : "Monthly subscription"}
            </span>
            <h3>Averomira</h3>
            <div className="pricing-pilot-price">
              <strong>790 €</strong>
              <span>{fi ? "/ kk" : "/ month"}</span>
            </div>
            <p>
              {fi
                ? "790 €/kk + alv. Uudet asiakaskohtaiset ERP-integraatiot arvioidaan ja hinnoitellaan erikseen."
                : "€790/month excluding VAT. New customer-specific ERP integrations are assessed and priced separately."}
            </p>
          </div>

          <div className="pricing-pilot-details">
            <ul>
              {features.map((feature) => (
                <li key={feature}>{feature}</li>
              ))}
            </ul>

            <button type="button" onClick={scrollToPilotForm}>
              {fi ? "Keskustele käyttöönotosta" : "Discuss onboarding"}{" "}
              <span aria-hidden="true">→</span>
            </button>
          </div>
        </article>
      </div>

      <div className="lead-capture-v2" id="demo" ref={formRef}>
        <div className="lead-capture-copy">
          <div className="v2-section-label">
            {fi ? "Kysy Averomirasta" : "Ask about Averomira"}
          </div>
          <h3>
            {fi
              ? "Kerro lyhyesti nykyisestä tarjouspyyntö­työnkulustanne."
              : "Tell us briefly about your current RFQ workflow."}
          </h3>
          <p>
            {fi
              ? "Käymme läpi nykyisen prosessinne ja sovimme käyttöönoton laajuudesta sekä mahdollisista ERP-yhteyksistä."
              : "We will review your current process and agree on onboarding and any ERP integration requirements."}
          </p>

          <div className="lead-capture-proof">
            <span>{fi ? "790 €/kk + alv" : "€790/month + VAT"}</span>
            <i />
            <span>{fi ? "Selkeä kuukausihinnoittelu" : "Simple monthly pricing"}</span>
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
                  ? "Ota yhteyttä"
                  : "Get in touch"}
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
                ? "Pyyntö vastaanotettu. Olemme yhteydessä Averomiran käyttöönotosta."
                : "Request received. We will follow up about Averomira onboarding."}
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
