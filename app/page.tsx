import { AtelierHomepage } from "@/components/marketing/AtelierHomepage";
import { getLocale } from "@/lib/locale";
import "./atelier.css";

export default async function Home() {
  const locale = await getLocale();
  const organizationStructuredData = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "Averomira",
    url: "https://averomira.com",
    logo: "https://averomira.com/icon.svg",
    description: "Averomira helps industrial sales teams move customer orders from RFQ to reviewed quote, purchase order reconciliation and ERP-ready sales order.",
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationStructuredData).replace(/</g, "\\u003c") }}
      />
      <AtelierHomepage locale={locale} />
    </>
  );
}
