import Link from "next/link";
import { RivoraMark } from "./RivoraMark";
import type { Locale } from "@/lib/locale";

export function MarketingFooter({ locale }: { locale: Locale }) {
  const fi = locale === "fi";
  return (
    <footer className="marketing-shell footer-v2-wrap">
      <div className="footer-v2">
        <div className="footer-v2-top">
          <div className="footer-v2-brand">
            <RivoraMark className="text-[#132018]" />
            <p>{fi ? "Nodra auttaa teollisia myyntitiimejä muuttamaan saapuvat tarjouspyynnöt rakenteisiksi, tarkistettaviksi tarjouksiksi." : "Nodra helps industrial sales teams turn incoming RFQs into structured, reviewable quotes."}</p>
          </div>
          <div className="footer-v2-links">
            <div>
              <span>{fi ? "Tuote" : "Product"}</span>
              <a href="#product">{fi ? "Yleiskuva" : "Overview"}</a>
              <a href="#how-it-works">{fi ? "Näin se toimii" : "How it works"}</a>
              <a href="#memory">{fi ? "Asiakaskohtainen muisti" : "Customer memory"}</a>
              <a href="#confidence">{fi ? "Varmuus" : "Confidence"}</a>
            </div>
            <div>
              <span>{fi ? "Työnkulku" : "Workflow"}</span>
              <a href="#ai-extraction">{fi ? "Jäljitettävyys" : "Traceability"}</a>
              <a href="#before-after">{fi ? "Ennen / jälkeen" : "Before / after"}</a>
              <Link href="/app/upload">{fi ? "Lataa tarjouspyyntö" : "Upload an RFQ"}</Link>
              <Link href="/login">{fi ? "Kirjaudu" : "Sign in"}</Link>
            </div>
            <div>
              <span>{fi ? "Yritys" : "Company"}</span>
              <a href="#pricing">{fi ? "Yhteys" : "Contact"}</a>
              <a href="#pricing">{fi ? "Lataa tarjouspyyntö" : "Upload an RFQ"}</a>
            </div>
          </div>
        </div>
        <div className="footer-v2-bottom">
          <span>© 2026 Nodra</span>
          <div><span>{fi ? "Tietosuoja" : "Privacy"}</span><span>{fi ? "Ehdot" : "Terms"}</span></div>
          <span>{fi ? "Rakennettu teollisille myyntitiimeille." : "Built for industrial sales teams."}</span>
        </div>
      </div>
    </footer>
  );
}
