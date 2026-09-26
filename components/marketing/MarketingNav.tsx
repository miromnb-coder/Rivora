import Link from "next/link";
import { RivoraMark } from "./RivoraMark";
import type { Locale } from "@/lib/locale";

export function MarketingNav({ locale }: { locale: Locale }) {
  const fi = locale === "fi";
  return (
    <header className="marketing-nav nav-v2">
      <Link href="/" aria-label="Nodra home" className="nav-v2-brand"><RivoraMark /></Link>
      <nav className="nav-v2-links" aria-label="Main navigation">
        <a href="#product">{fi ? "Tuote" : "Product"}</a>
        <a href="#how-it-works">{fi ? "Näin se toimii" : "How it works"}</a>
        <a href="#confidence">{fi ? "Varmuus" : "Confidence"}</a>
        <a href="#ai-extraction">{fi ? "Jäljitettävyys" : "Traceability"}</a>
        <a href="#pricing">{fi ? "Hinnoittelu" : "Pricing"}</a>
      </nav>
      <div className="nav-v2-actions">
        <Link href="/login" className="nav-v2-signin">{fi ? "Kirjaudu" : "Sign in"}</Link>
        <Link href="/app/upload" prefetch className="nav-v2-cta">
          <span className="nav-v2-cta-long">{fi ? "Lataa tarjouspyyntö" : "Upload an RFQ"}</span>
          <span className="nav-v2-cta-short">{fi ? "Aloita" : "Start"}</span>
          <span aria-hidden="true">→</span>
        </Link>
      </div>
    </header>
  );
}
