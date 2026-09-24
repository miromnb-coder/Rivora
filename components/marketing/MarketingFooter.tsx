import Link from "next/link";
import { RivoraMark } from "./RivoraMark";

export function MarketingFooter() {
  return (
    <footer className="marketing-shell pb-8 pt-5 sm:pb-12">
      <div className="marketing-footer">
        <div className="marketing-footer-brand">
          <RivoraMark className="text-[#132018]" />
          <p>Rivora helps industrial sales teams turn incoming RFQs into structured, reviewable quotes.</p>
          <div className="mt-6 flex gap-2">
            {["in","X","▶"].map((item) => (
              <span key={item} className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#e1e5e1] bg-white text-xs font-black text-[#3e4842]">{item}</span>
            ))}
          </div>
        </div>
        <div className="marketing-footer-links">
          <div><div className="footer-heading">Product</div><a href="#product">Overview</a><a href="#how-it-works">How it works</a><a href="#memory">Product memory</a><a href="#confidence">Confidence</a></div>
          <div><div className="footer-heading">Resources</div><a href="#security">Security</a><a href="#ai-extraction">AI extraction</a><Link href="/app/upload">Process RFQ</Link><Link href="/login">Sign in</Link></div>
          <div><div className="footer-heading">Company</div><a href="mailto:hello@rivora.fi">Contact</a><a href="#pricing">Pricing</a><a href="#product">Product</a></div>
        </div>
        <div className="marketing-footer-bottom">
          <span>© 2026 Rivora. All rights reserved.</span>
          <div className="flex flex-wrap gap-x-6 gap-y-2">
            <span>Privacy Policy</span>
            <span>Terms of Service</span>
          </div>
          <span className="inline-flex items-center gap-2"><i className="h-2 w-2 rounded-full bg-[#365a49]" />Built for industrial teams.</span>
        </div>
      </div>
    </footer>
  );
}
