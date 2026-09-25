import { MarketingNav } from "@/components/marketing/MarketingNav";
import { MarketingFooter } from "@/components/marketing/MarketingFooter";
import { MinimalShaderHero } from "@/components/marketing/MinimalShaderHero";
import {
  HowItWorksV2,
  ProductResolutionV2,
  CustomerMemoryV2,
  ConfidenceSystemV2,
} from "@/components/marketing/HomepageV2Sections";
import {
  AiExtraction,
  FinalCta,
} from "@/components/marketing/MarketingSections";

export default function Home() {
  return (
    <main className="marketing-page minimal-direction">
      <div className="marketing-shell">
        <MarketingNav />
      </div>
      <MinimalShaderHero />
      <HowItWorksV2 />
      <ProductResolutionV2 />
      <CustomerMemoryV2 />
      <ConfidenceSystemV2 />
      <AiExtraction />
      <FinalCta />
      <MarketingFooter />
    </main>
  );
}
