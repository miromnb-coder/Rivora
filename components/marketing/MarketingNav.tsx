import Link from "next/link";
import { RivoraMark } from "./RivoraMark";

export function MarketingNav() {
  return (
    <header className="marketing-nav">
      <Link href="/" aria-label="Rivora home" className="text-[#132018]">
        <RivoraMark />
      </Link>
      <nav className="marketing-nav-links" aria-label="Main navigation">
        <a href="#product">Product</a>
        <a href="#how-it-works">How it works</a>
        <a href="#security">Security</a>
        <a href="#pricing">Pricing</a>
      </nav>
      <div className="flex items-center gap-2.5">
        <Link href="/login" className="marketing-button secondary hidden sm:inline-flex">Sign in</Link>
        <Link href="/app/upload" className="marketing-button primary">Try Rivora <span aria-hidden="true">→</span></Link>
      </div>
    </header>
  );
}
