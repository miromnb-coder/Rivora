"use client";

import type { Locale } from "@/lib/locale";
import type { HelpArticle } from "@/lib/rivora/support-knowledge";

const PROMPTS: Record<string, [string, string]> = {
  "new-rfq": ["Miten käsittelen uuden tarjouspyynnön?", "How do I process a new RFQ?"],
  "rfq-review": ["Miksi tuoteosuma vaatii tarkistuksen?", "Why does a product match need review?"],
  "rfq-why-review": ["Miksi tämä rivi vaatii tarkistuksen?", "Why does this line need review?"],
  "po-exceptions": ["Miksi ostotilaus vaatii tarkistusta?", "Why does this purchase order need review?"],
  "purchase-order": ["Miten tarkistan ostotilauksen?", "How do I review a purchase order?"],
  "business-central": ["Miten Business Central -integraatio toimii?", "How does the Business Central integration work?"],
  "business-central-mapping": ["Miten korjaan puuttuvan ERP-vastineen?", "How do I fix a missing ERP mapping?"],
  "business-central-client-id": ["Mikä on Business Central Client ID?", "What is a Business Central Client ID?"],
  "quotes": ["Miten muodostan tarjouksen?", "How do I create a quote?"],
  "quote-locking": ["Miksi tarjouksen tiedot on lukittu?", "Why are the quote details locked?"],
  "smart-memory": ["Miten älykäs muisti toimii?", "How does Smart Memory work?"],
  "catalogue": ["Miten lisään tuotteita katalogiin?", "How do I add products to the catalogue?"],
};

export function SupportQuickPrompts({ locale, contextTitle, articles, onPick }: {
  locale: Locale;
  contextTitle?: string;
  articles: readonly Pick<HelpArticle, "id" | "title">[];
  onPick: (question: string) => void;
}) {
  const fi = locale === "fi";
  return (
    <div className="support-s5-welcome">
      <div className="support-s5-welcome-title">
        <span className="support-s5-sparkle" aria-hidden="true">
          <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor"
            strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="m12 2 1.9 6.1L20 10l-6.1 1.9L12 18l-1.9-6.1L4 10l6.1-1.9L12 2Z" />
            <path d="m19 17 .6 1.4L21 19l-1.4.6L19 21l-.6-1.4L17 19l1.4-.6L19 17Z" />
          </svg>
        </span>
        <div>
          <strong>{fi ? "Miten voin auttaa?" : "How can I help?"}</strong>
          <p>{fi
            ? "Voin auttaa tarjouspyyntöjen, tuotteiden, tilausten ja asetusten kanssa."
            : "I can help with RFQs, products, orders and settings."}</p>
        </div>
      </div>
      {contextTitle ? (
        <div className="support-s5-context">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <rect x="3" y="4" width="18" height="14" rx="2" />
            <path d="M9 21h6M12 18v3" />
          </svg>
          <span>{fi ? "Nykyinen näkymä:" : "Current area:"} <strong>{contextTitle}</strong></span>
        </div>
      ) : null}
      <span className="support-s5-prompts-label">{fi ? "EHDOTUKSET" : "SUGGESTED QUESTIONS"}</span>
      <div className="support-s5-prompts">
        {articles.map((article) => {
          const question = PROMPTS[article.id]?.[fi ? 0 : 1] ?? article.title;
          return (
            <button key={article.id} type="button" onClick={() => onPick(question)}>
              <span>{question}</span>
              <span className="support-s5-prompt-arrow" aria-hidden="true">↗</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
