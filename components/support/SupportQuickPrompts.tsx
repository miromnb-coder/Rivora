"use client";
import type { Locale } from "@/lib/locale";
import type { HelpArticle } from "@/lib/rivora/support-knowledge";

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
        <span className="support-s5-sparkle" aria-hidden="true">✳</span>
        <div>
          <strong>{fi ? "Miten voin auttaa?" : "How can I help?"}</strong>
          <p>{fi ? "Voin opastaa tarjouspyynnöissä, tilauksissa ja asetuksissa." : "I can guide you through RFQs, orders and settings."}</p>
        </div>
      </div>
      {contextTitle ? <p className="support-s5-context">{fi ? "Nykyinen näkymä:" : "Current area:"} <strong>{contextTitle}</strong></p> : null}
      <span className="support-s5-prompts-label">{fi ? "KOKEILE KYSYÄ" : "SUGGESTED QUESTIONS"}</span>
      <div className="support-s5-prompts">
        {articles.map((article) => (
          <button key={article.id} type="button" onClick={() => onPick(article.title)}>
            <span>{article.title}</span><span aria-hidden="true">↗</span>
          </button>
        ))}
      </div>
    </div>
  );
}
