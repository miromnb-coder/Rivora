import type { Locale } from "@/lib/locale";

export type SupportRouteContext = {
  title: string;
  description: string;
  articleIds: string[];
};

function copy(
  locale: Locale,
  fi: Omit<SupportRouteContext, "articleIds">,
  en: Omit<SupportRouteContext, "articleIds">,
  articleIds: string[],
): SupportRouteContext {
  return {
    ...(locale === "fi" ? fi : en),
    articleIds,
  };
}

export function supportContextForPath(
  pathname: string,
  locale: Locale,
): SupportRouteContext | null {
  if (/^\/app\/rfq\/[^/]+/.test(pathname)) {
    return copy(
      locale,
      {
        title: "Tarjouspyynnön tarkistus",
        description: "Ohjeet tuoteosumiin, tarkistukseen ja muistettuihin vastineisiin.",
      },
      {
        title: "RFQ review",
        description: "Help for product matches, review decisions and remembered mappings.",
      },
      ["rfq-why-review", "rfq-review", "smart-memory"],
    );
  }

  if (/^\/app\/settings\/business-central(?:\/|$)/.test(pathname)) {
    return copy(
      locale,
      {
        title: "Business Central -vastineet",
        description: "Ohjeet yhteyteen, tunnuksiin ja puuttuviin ERP-vastineisiin.",
      },
      {
        title: "Business Central mappings",
        description: "Help for connection details, credentials and missing ERP mappings.",
      },
      [
        "business-central-mapping",
        "business-central-client-id",
        "business-central",
      ],
    );
  }

  if (/^\/app\/purchase-orders\/[^/]+/.test(pathname)) {
    return copy(
      locale,
      {
        title: "Ostotilauksen tarkistus",
        description: "Ohjeet PO:n, tarjouksen ja poikkeamien vertailuun.",
      },
      {
        title: "Purchase order review",
        description: "Help for comparing the PO, quote and reconciliation exceptions.",
      },
      ["po-exceptions", "purchase-order", "business-central-mapping"],
    );
  }

  if (/^\/app\/quotes\/[^/]+/.test(pathname)) {
    return copy(
      locale,
      {
        title: "Tarjouksen käsittely",
        description: "Ohjeet hinnoitteluun, hyväksyntään ja lukittuihin tietoihin.",
      },
      {
        title: "Quote workflow",
        description: "Help for pricing, approval and locked commercial data.",
      },
      ["quote-locking", "quotes", "purchase-order"],
    );
  }

  if (/^\/app\/products(?:\/|$)/.test(pathname)) {
    return copy(
      locale,
      {
        title: "Tuotekatalogi",
        description: "Ohjeet katalogin ylläpitoon ja tuoteosumien laatuun.",
      },
      {
        title: "Product catalogue",
        description: "Help for maintaining catalogue data and improving product matching.",
      },
      ["catalogue", "rfq-why-review", "smart-memory"],
    );
  }

  if (/^\/app\/memory(?:\/|$)/.test(pathname)) {
    return copy(
      locale,
      {
        title: "Älykäs muisti",
        description: "Ohjeet vahvistettujen tuotevastineiden käyttöön ja hallintaan.",
      },
      {
        title: "Smart memory",
        description: "Help for verified product mappings and memory management.",
      },
      ["smart-memory", "rfq-review"],
    );
  }

  if (/^\/app\/upload(?:\/|$)/.test(pathname)) {
    return copy(
      locale,
      {
        title: "Tiedoston tuonti",
        description: "Ohjeet tarjouspyynnön ja tuotekatalogin tiedostojen tuontiin.",
      },
      {
        title: "File import",
        description: "Help for importing RFQ and product catalogue files.",
      },
      ["new-rfq", "catalogue"],
    );
  }

  if (/^\/app\/settings(?:\/|$)/.test(pathname)) {
    return copy(
      locale,
      {
        title: "Asetukset",
        description: "Ohjeet Averomiran asetuksiin ja integraatioihin.",
      },
      {
        title: "Settings",
        description: "Help for Averomira settings and integrations.",
      },
      ["business-central", "smart-memory"],
    );
  }

  if (pathname === "/app") {
    return copy(
      locale,
      {
        title: "Työpöytä",
        description: "Aloita tarjouspyynnöstä tai avaa työjonon seuraava tehtävä.",
      },
      {
        title: "Dashboard",
        description: "Start from a new RFQ or open the next task in your work queue.",
      },
      ["new-rfq", "rfq-review", "purchase-order"],
    );
  }

  return null;
}
