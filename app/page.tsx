import { MarketingNav } from "@/components/marketing/MarketingNav";
import { MarketingFooter } from "@/components/marketing/MarketingFooter";
import {
  HeroSection,
  LightDarkTransition,
  HowItWorks,
  ProblemSolution,
  CustomerMemory,
  ConfidenceSystem,
  AiExtraction,
  FinalCta,
} from "@/components/marketing/MarketingSections";

export default function Home() {
  return (
    <main className="marketing-page">
      <div className="marketing-shell">
        <MarketingNav />
      </div>
      <HeroSection />
      <LightDarkTransition />
      <HowItWorks />
      <ProblemSolution />
      <CustomerMemory />
      <ConfidenceSystem />
      <AiExtraction />
      <FinalCta />
      <MarketingFooter />
    </main>
  );
}
