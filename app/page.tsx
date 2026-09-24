import { MarketingNav } from "@/components/marketing/MarketingNav";
import { MarketingFooter } from "@/components/marketing/MarketingFooter";
import { MinimalShaderHero } from "@/components/marketing/MinimalShaderHero";
import {
  HowItWorks,
  CustomerMemory,
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
      <CustomerMemory />
      <ConfidenceSystem />
      <AiExtraction />
      <FinalCta />
      <MarketingFooter />
    </main>
  );
}
