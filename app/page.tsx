import { MarketingNav } from "@/components/marketing/MarketingNav";
import { MarketingFooter } from "@/components/marketing/MarketingFooter";
import { MinimalShaderHero } from "@/components/marketing/MinimalShaderHero";
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

export default function Home() {
  return (
    <main className="marketing-page minimal-direction">
      <div className="marketing-shell">
        <MarketingNav />
      </div>
      <MinimalShaderHero />
      <ProofStripV2 />
      <HowItWorksV2 />
      <ProductResolutionV2 />
      <CustomerMemoryV2 />
      <ConfidenceSystemV2 />
      <AiExtractionV2 />
      <BeforeAfterV2 />
      <FinalCtaV2 />
      <MarketingFooter />
    </main>
  );
}
