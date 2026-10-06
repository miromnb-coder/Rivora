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
  const structuredData = [
    {
      "@context": "https://schema.org",
      "@type": "Organization",
      "@id": "https://averomira.com/#organization",
      name: "Averomira",
      url: "https://averomira.com",
      logo: "https://averomira.com/favicon.svg",
      description:
        "Averomira helps industrial sales teams move customer orders from RFQ to reviewed quote, purchase order reconciliation and ERP-ready sales order.",
    },
    {
      "@context": "https://schema.org",
      "@type": "WebSite",
      "@id": "https://averomira.com/#website",
      url: "https://averomira.com",
      name: "Averomira",
      publisher: {
        "@id": "https://averomira.com/#organization",
      },
    },
  ];

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(structuredData).replace(/</g, "\\u003c"),
        }}
      />
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
    </>
  );
}
