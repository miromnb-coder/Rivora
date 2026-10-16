"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Locale } from "@/lib/locale";

type Trail = { href: string; group: string; page: string };
function getTrail(path: string, fi: boolean): Trail | null {
  const t = (href: string, groupFi: string, groupEn: string, pageFi: string, pageEn: string): Trail => ({
    href, group: fi ? groupFi : groupEn, page: fi ? pageFi : pageEn,
  });
  const orders = (fiLabel: string, enLabel: string) => t("/app/orders", "Tilaukset", "Orders", fiLabel, enLabel);
  if (path.startsWith("/app/orders/case/")) {
    const stage = path.split("/")[4];
    const labels: Record<string, [string, string]> = {
      rfq: ["Tarjouspyyntö", "RFQ"], quote: ["Tarjous", "Quote"],
      po: ["Ostotilaus", "Purchase order"], sales: ["Myyntitilaus", "Sales order"],
    };
    const label = labels[stage] || ["Tilauksen tiedot", "Order details"];
    return orders(label[0], label[1]);
  }
  if (path.startsWith("/app/orders/")) return orders("Tilauksen tiedot", "Order details");
  if (path === "/app/inbox") return orders("Tarjouspyynnöt", "RFQ inbox");
  if (path === "/app/upload") return orders("Uusi tarjouspyyntö", "New RFQ");
  if (path.startsWith("/app/rfq/")) return orders("Tarjouspyynnön tarkistus", "Review RFQ");
  if (path.startsWith("/app/quotes/")) return orders("Tarjous", "Quote");
  if (path.startsWith("/app/purchase-orders/")) return orders("Ostotilaus", "Purchase order");
  if (path.startsWith("/app/sales-orders/")) return orders("Myyntitilaus", "Sales order");
  if (path.startsWith("/app/templates/")) return orders("Mallipohjat", "Templates");
  if (path === "/app/memory" || path.startsWith("/app/memory/"))
    return t("/app/settings", "Asetukset", "Settings", "Älykäs muisti", "Smart memory");
  if (path.startsWith("/app/settings/"))
    return t("/app/settings", "Asetukset", "Settings", "Lisäasetukset", "Additional settings");
  if (path.startsWith("/app/customers/"))
    return t("/app/customers", "Asiakkaat", "Customers", "Asiakkaan tiedot", "Customer details");
  if (path.startsWith("/app/products/"))
    return t("/app/products", "Tuotteet", "Products", "Tuotteen tiedot", "Product details");
  if (path.startsWith("/app/leads/"))
    return t("/app/leads", "Liidit", "Leads", "Liidin tiedot", "Lead details");
  return null;
}

export function AppLocation({ locale }: { locale: Locale }) {
  const pathname = usePathname();
  const trail = getTrail(pathname, locale === "fi");
  if (!trail) return null;
  return (
    <nav className="app-route-location" aria-label={locale === "fi" ? "Sijaintipolku" : "Breadcrumb"}>
      <Link href={trail.href}>{trail.group}</Link>
      <span aria-hidden="true" className="app-route-location-divider">/</span>
      <span aria-current="page">{trail.page}</span>
    </nav>
  );
}
