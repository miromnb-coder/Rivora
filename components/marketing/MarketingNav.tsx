import Link from "next/link";
import { RivoraMark } from "./RivoraMark";

export function MarketingNav() {
  return (
    <header className="marketing-nav nav-v2">
      <Link href="/" aria-label="Rivora home" className="nav-v2-brand">
        <RivoraMark />
      </Link>

      <nav className="nav-v2-links" aria-label="Main navigation">
        <a href="#product">Product</a>
        <a href="#how-it-works">How it works</a>
        <a href="#confidence">Confidence</a>
        <a href="#ai-extraction">Traceability</a>
      </nav>

      <div className="nav-v2-actions">
        <Link href="/login" className="nav-v2-signin">
          Sign in
        </Link>
        <Link href="/app/upload" className="nav-v2-cta">
          Try Rivora <span aria-hidden="true">→</span>
        </Link>
      </div>
    </header>
  );
}
