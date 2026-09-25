import { MarketingNav } from "@/components/marketing/MarketingNav";
import { MarketingFooter } from "@/components/marketing/MarketingFooter";
import { MinimalShaderHero } from "@/components/marketing/MinimalShaderHero";
import {
  ProductResolutionV2,
  CustomerMemoryV2,
} from "@/components/marketing/HomepageV2Sections";
import {
  HowItWorks,
  ConfidenceSystem,
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
      <HowItWorks />
      <ProductResolutionV2 />
      <CustomerMemoryV2 />
      <ConfidenceSystem />
      <AiExtraction />
      <FinalCta />
      <MarketingFooter />
    </main>
  );
}
