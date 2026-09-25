import Link from "next/link";
import { RivoraMark } from "./RivoraMark";

export function MarketingFooter() {
  return (
    <footer className="marketing-shell footer-v2-wrap">
      <div className="footer-v2">
        <div className="footer-v2-top">
          <div className="footer-v2-brand">
            <RivoraMark className="text-[#132018]" />
            <p>
              Rivora helps industrial sales teams turn incoming RFQs into structured,
              reviewable quotes.
            </p>
          </div>

          <div className="footer-v2-links">
            <div>
              <span>Product</span>
              <a href="#product">Overview</a>
              <a href="#how-it-works">How it works</a>
              <a href="#memory">Customer memory</a>
              <a href="#confidence">Confidence</a>
            </div>

            <div>
              <span>Workflow</span>
              <a href="#ai-extraction">Traceability</a>
              <a href="#before-after">Before / after</a>
              <Link href="/app/upload">Process an RFQ</Link>
              <Link href="/login">Sign in</Link>
            </div>

            <div>
              <span>Company</span>
              <a href="mailto:hello@rivora.fi">Contact</a>
              <a href="#pricing">Get started</a>
            </div>
          </div>
        </div>

        <div className="footer-v2-bottom">
          <span>© 2026 Rivora</span>
          <div>
            <span>Privacy</span>
            <span>Terms</span>
          </div>
          <span>Built for industrial sales teams.</span>
        </div>
      </div>
    </footer>
  );
}
