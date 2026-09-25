import { MarketingNav } from "@/components/marketing/MarketingNav";
import { MarketingFooter } from "@/components/marketing/MarketingFooter";
import { MinimalShaderHero } from "@/components/marketing/MinimalShaderHero";
import { PricingLeadCapture } from "@/components/marketing/PricingLeadCapture";
import { getLocale } from "@/lib/locale";
import {
  ProofStripV2,
  HowItWorksV2,
  ProductResolutionV2,
  CustomerMemoryV2,
  ConfidenceSystemV2,
  AiExtractionV2,
  BeforeAfterV2,
  FinalCtaV2,
} from "@/components/marketing/HomepageV2Sections";

export default async function Home() {
  const locale = await getLocale();

  return (
    <main className="marketing-page minimal-direction">
      <div className="marketing-shell">
        <MarketingNav locale={locale} />
      </div>
      <MinimalShaderHero locale={locale} />
      <ProofStripV2 locale={locale} />
      <HowItWorksV2 locale={locale} />
      <ProductResolutionV2 locale={locale} />
      <CustomerMemoryV2 locale={locale} />
      <ConfidenceSystemV2 locale={locale} />
      <AiExtractionV2 locale={locale} />
      <BeforeAfterV2 locale={locale} />
      <PricingLeadCapture locale={locale} />
      <FinalCtaV2 locale={locale} />
      <MarketingFooter locale={locale} />
    </main>
  );
}
