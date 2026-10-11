import type { Locale } from "@/lib/locale";

// Single approved source for the Help Center and Support AI. Keep fi/en IDs aligned.
export type HelpArticle = {
  id: string;
  title: string;
  summary: string;
  body: string[];
};

export const helpArticles: Record<Locale, HelpArticle[]> = {
  fi: [
    {
      id: "new-rfq",
      title: "Uuden tarjouspyynnön lisääminen",
      summary: "Näin tuot asiakkaan RFQ:n Averomiraan.",
      body: [
        "Avaa Työpöydältä Uusi tarjouspyyntö. Valitse asiakas ja lisää tarjouspyynnön tiedosto.",
        "Averomira jäsentää tarjouspyynnön riveiksi ja vie sen tarkistukseen ennen kuin kaupallinen työ jatkuu.",
        "Tarkista aina poimitut määrät, tunnisteet ja epävarmat rivit ennen hyväksymistä.",
      ],
    },
    {
      id: "rfq-review",
      title: "RFQ Review ja tuoteosumat",
      summary: "Mitä tehdä, kun rivi vaatii tarkistuksen.",
      body: [
        "RFQ Review näyttää asiakkaan pyytämän rivin, ehdotetun tuotteen ja osuman perusteen.",
        "Epävarma tai muistista tullut osuma ei ohita ihmisen tarkistusta. Vahvista oikea tuote ennen tarjouksen jatkamista.",
        "Jos oikeaa tuotetta ei löydy katalogista, tarkista ensin tuotetiedot tai lisää tuote katalogiin yrityksesi prosessin mukaisesti.",
      ],
    },
    {
      id: "catalogue",
      title: "Tuotekatalogi",
      summary: "Tuotteiden lisääminen ja tuotetietojen ylläpito.",
      body: [
        "Tuotteet-näkymässä ylläpidetään Averomiran käyttämää tuotekatalogia.",
        "Pidä SKU, nimi ja mahdollinen valmistajan tuotenumero ajan tasalla, jotta tuoteosumat toimivat mahdollisimman luotettavasti.",
        "Katalogimuutokset eivät saa korvata jo hyväksytyn tarjouksen kaupallisia tietoja jälkikäteen.",
      ],
    },
    {
      id: "quotes",
      title: "Tarjouksen tarkistus ja lähetys",
      summary: "Mitä tarkistaa ennen asiakkaalle lähettämistä.",
      body: [
        "Tarkista tuotteet, määrät, hinnat, alennukset, voimassaoloaika ja vastaanottaja ennen hyväksymistä.",
        "Averomira estää keskeneräisen hinnoittelun viemisen hyväksyttyyn tarjoukseen.",
        "Hyväksymisen jälkeen kaupalliset tiedot lukitaan prosessin eheyden säilyttämiseksi.",
      ],
    },
    {
      id: "purchase-order",
      title: "Ostotilauksen tarkistaminen",
      summary: "Näin käsittelet asiakkaan PO:n ja tarjouspoikkeamat.",
      body: [
        "Averomira vertaa ostotilausta tarjoukseen ja nostaa päätöstä vaativat erot näkyviin.",
        "Tarkista erityisesti tuote, määrä, hinta, valuutta ja mahdollinen tarjousviite.",
        "Poikkeama kannattaa ratkaista ennen ERP-valmiin tilauksen muodostamista.",
      ],
    },
    {
      id: "business-central",
      title: "Microsoft Business Central",
      summary: "Yhteys, vastineet ja ERP-valmis tilaus.",
      body: [
        "Business Central -integraatio tarvitsee oikean ympäristön, käyttöoikeudet sekä asiakkaiden ja tuotteiden vastineet.",
        "Jos työjonossa näkyy Täydennä Business Central -vastineet, avaa tehtävä ja täydennä puuttuvat ERP-vastineet ennen etenemistä.",
        "Averomira ei arvaa puuttuvia vastineita hiljaisesti.",
      ],
    },
    {
      id: "smart-memory",
      title: "Älykäs muisti",
      summary: "Miten vahvistettuja tuotevastineita käytetään uudelleen.",
      body: [
        "Älykäs muisti voi hyödyntää aiemmin vahvistettuja asiakaskohtaisia tuotevastineita.",
        "Vain vahvistettua muistia saa käyttää uudelleen. Muistista tullut ehdotus pysyy silti käyttäjän tarkistettavana.",
        "Muistin tietoja voi tarkastella Asetukset-valikon Älykäs muisti -kohdasta.",
      ],
    },
    {
      id: "rfq-why-review",
      title: "Miksi tuoterivi jäi tarkistettavaksi?",
      summary: "Miten Averomira päättää, mikä vaatii ihmisen vahvistuksen.",
      body: [
        "Rivi jää tarkistettavaksi, kun Averomira ei voi vahvistaa tuotetta turvallisesti ilman ihmisen päätöstä tai kun prosessin käytäntö vaatii erillisen vahvistuksen.",
        "Tarkka SKU-osuma tai muistettu vastine voi nostaa oikean tuotteen vahvaksi ehdokkaaksi, mutta se ei ohita RFQ Review -vahvistusta.",
        "Tarkista asiakkaan tunniste, kuvaus, määrä ja ehdotetun tuotteen tiedot. Vahvista vasta, kun ehdotus vastaa asiakkaan pyyntöä.",
      ],
    },
    {
      id: "business-central-client-id",
      title: "Mistä löydän Business Centralin Client ID:n?",
      summary: "Application (client) ID löytyy Microsoft Entra -sovellusrekisteröinnistä.",
      body: [
        "Avaa Microsoft Entra -hallinnassa se App registration, jota Averomiran Business Central -yhteys käyttää.",
        "Avaa sovelluksen Overview / Yleiskatsaus. Kopioi Application (client) ID -arvo Averomiran Business Central -asetuksiin.",
        "Client ID ei ole sama asia kuin Client Secret. Älä lähetä Client Secretiä tukipyyntöön tai kuvakaappaukseen.",
      ],
    },
    {
      id: "business-central-mapping",
      title: "Miksi Business Central -vastine puuttuu?",
      summary: "Asiakas tai tuote tarvitsee vahvistetun ERP-vastineen ennen vientiä.",
      body: [
        "Averomira tarvitsee Business Centralissa käytettävän asiakasnumeron ja item-numeron ennen ERP-valmiin tilauksen vientiä.",
        "Jos vastine puuttuu tai sitä ei ole vielä vahvistettu, työjono näyttää tehtävän Täydennä Business Central -vastineet.",
        "Täytä tai tarkista vastine Business Central -vastineet -näkymässä. Averomira ei korvaa puuttuvaa ERP-tunnistetta arvaamalla.",
      ],
    },
    {
      id: "po-exceptions",
      title: "Mitä ostotilauksen poikkeama tarkoittaa?",
      summary: "Näin tulkitset PO:n ja hyväksytyn tarjouksen erot.",
      body: [
        "PO-tarkistus vertaa asiakkaan ostotilausta hyväksyttyyn tarjoukseen ja nostaa esiin kohdat, joissa tiedot eivät vastaa toisiaan.",
        "Poikkeama voi liittyä esimerkiksi tuotteeseen, määrään, hintaan, valuuttaan tai tarjousviitteeseen.",
        "Tarkista poikkeaman lähdetiedot ja tee päätös ennen hyväksyntää. ERP-valmis tilaus muodostetaan vasta tarkistetusta reconciliationista.",
      ],
    },
    {
      id: "quote-locking",
      title: "Miksi tarjouksen tiedot ovat lukittu?",
      summary: "Hyväksyntä lukitsee kaupalliset tiedot prosessin eheyden vuoksi.",
      body: [
        "Kun tarjous hyväksytään, Averomira lukitsee keskeiset kaupalliset tiedot, jotta hyväksytty sisältö ei muutu huomaamatta.",
        "Jos tarjous on vielä Ready-tilassa ja tarvitsee muutoksia, palauta se luonnokseksi ennen hyväksyntää.",
        "Jo lähetetyn tarjouksen muuttamisen sijaan käsittele tarvittava muutos yrityksesi hyväksytyn prosessin mukaisesti.",
      ],
    },
  ],
  en: [
    {
      id: "new-rfq",
      title: "Add a new RFQ",
      summary: "Bring a customer RFQ into Averomira.",
      body: [
        "From the dashboard, choose New RFQ, select the customer and add the RFQ file.",
        "Averomira structures the request into line items and routes it to review before commercial work continues.",
        "Always review extracted quantities, identifiers and uncertain lines before approval.",
      ],
    },
    {
      id: "rfq-review",
      title: "RFQ Review and product matches",
      summary: "What to do when a line needs review.",
      body: [
        "RFQ Review shows the requested line, the suggested product and why it was suggested.",
        "An uncertain or remembered match never bypasses human review. Confirm the correct product before continuing.",
        "If the right item is missing, review or update the product catalogue according to your company process.",
      ],
    },
    {
      id: "catalogue",
      title: "Product catalogue",
      summary: "Add and maintain product data.",
      body: [
        "The Products view contains the catalogue Averomira uses for matching.",
        "Keep SKU, product name and manufacturer part number current to improve matching quality.",
        "Catalogue changes must not silently rewrite commercial data on an already approved quote.",
      ],
    },
    {
      id: "quotes",
      title: "Review and send a quote",
      summary: "What to verify before sending a quote.",
      body: [
        "Review products, quantities, prices, discounts, validity and recipient before approval.",
        "Averomira prevents incomplete pricing from moving into an approved quote.",
        "After approval, core commercial fields are locked to preserve process integrity.",
      ],
    },
    {
      id: "purchase-order",
      title: "Review a purchase order",
      summary: "Handle customer POs and quote differences.",
      body: [
        "Averomira compares the purchase order with the quote and surfaces differences that require a decision.",
        "Review product, quantity, price, currency and quote reference in particular.",
        "Resolve material differences before preparing the ERP-ready order.",
      ],
    },
    {
      id: "business-central",
      title: "Microsoft Business Central",
      summary: "Connection, mappings and ERP-ready orders.",
      body: [
        "Business Central requires the correct environment, permissions and customer/product mappings.",
        "If the work queue shows Complete Business Central mappings, open the task and complete the missing ERP mappings.",
        "Averomira does not silently guess missing mappings.",
      ],
    },
    {
      id: "smart-memory",
      title: "Smart memory",
      summary: "How confirmed product mappings are reused.",
      body: [
        "Smart memory can reuse customer-specific product mappings that were confirmed earlier.",
        "Only verified memory can be reused, and a remembered suggestion still remains reviewable by the user.",
        "Memory entries can be reviewed under Settings > Smart memory.",
      ],
    },
    {
      id: "rfq-why-review",
      title: "Why does this product line need review?",
      summary: "How Averomira decides what needs human confirmation.",
      body: [
        "A line stays in review when Averomira cannot safely confirm the product without a human decision or when the workflow policy requires explicit confirmation.",
        "An exact SKU match or remembered mapping can make a product a strong candidate, but it does not bypass RFQ Review confirmation.",
        "Check the customer identifier, description, quantity and suggested product details. Confirm only when the suggestion matches the customer's request.",
      ],
    },
    {
      id: "business-central-client-id",
      title: "Where do I find the Business Central Client ID?",
      summary: "The Application (client) ID is in the Microsoft Entra app registration.",
      body: [
        "Open the App registration in Microsoft Entra that your Averomira Business Central connection uses.",
        "Open the app's Overview page and copy the Application (client) ID into the Business Central settings in Averomira.",
        "The Client ID is not the Client Secret. Do not include a Client Secret in a support request or screenshot.",
      ],
    },
    {
      id: "business-central-mapping",
      title: "Why is a Business Central mapping missing?",
      summary: "A customer or product needs a verified ERP mapping before export.",
      body: [
        "Averomira needs the Business Central customer number and item number used by the ERP before an ERP-ready order can be exported.",
        "If a mapping is missing or not yet verified, the work queue shows a Complete Business Central mappings task.",
        "Complete or verify the mapping in the Business Central mappings view. Averomira does not guess missing ERP identifiers.",
      ],
    },
    {
      id: "po-exceptions",
      title: "What does a purchase-order exception mean?",
      summary: "How to interpret differences between the PO and approved quote.",
      body: [
        "PO review compares the customer's purchase order with the approved quote and surfaces fields that do not match.",
        "An exception can involve the product, quantity, price, currency or quote reference.",
        "Review the source values and make the decision before approval. The ERP-ready order is created only from a reviewed reconciliation.",
      ],
    },
    {
      id: "quote-locking",
      title: "Why are quote fields locked?",
      summary: "Approval locks commercial data to preserve process integrity.",
      body: [
        "When a quote is approved, Averomira locks core commercial fields so approved content cannot change silently.",
        "If a quote is still Ready and needs changes, return it to draft before approval.",
        "For an already sent quote, handle the required change through your company's approved commercial process instead of silently rewriting the sent quote.",
      ],
    },
  ],
};

export function articleById(locale: Locale, id: string): HelpArticle | undefined {
  return helpArticles[locale].find((article) => article.id === id);
}

const IGNORE_WORDS = new Set([
  "miten", "miksi", "mikä", "mitä", "tämä", "tässä", "minun", "olen", "että",
  "what", "why", "how", "this", "that", "with", "from", "does", "the", "and",
]);

function words(value: string): string[] {
  const ascii = value.toLocaleLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "");
  return [...new Set(ascii.split(/[^\p{L}\p{N}]+/u).filter((word) =>
    word.length >= 3 && !IGNORE_WORDS.has(word)
  ))];
}

// Deterministic, bounded retrieval: no embeddings, external services or customer data.
export function searchSupportArticles(
  question: string,
  locale: Locale,
  contextualIds: readonly string[] = [],
  limit = 4,
): HelpArticle[] {
  const tokens = words(question.slice(0, 700));
  const recommended = new Set(contextualIds);
  const matches = helpArticles[locale].map((article) => {
    const title = words(article.title);
    const summary = words(article.summary);
    const body = words(article.body.join(" "));
    const score = tokens.reduce((total, token) => total +
      (title.some((word) => word.startsWith(token) || token.startsWith(word)) ? 5 : 0) +
      (summary.some((word) => word.startsWith(token) || token.startsWith(word)) ? 3 : 0) +
      (body.some((word) => word.startsWith(token) || token.startsWith(word)) ? 1 : 0), 0);
    return { article, score: score + (recommended.has(article.id) ? 2 : 0) };
  });
  return matches
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score || a.article.id.localeCompare(b.article.id))
    .slice(0, Math.max(1, Math.min(4, limit)))
    .map(({ article }) => article);
}

export function supportKnowledgeExcerpt(articles: readonly HelpArticle[]): string {
  if (articles.length === 0) return "No relevant approved article was found.";
  return articles.map((article) => [
    `ARTICLE ID: ${article.id}`,
    `TITLE: ${article.title}`,
    `SUMMARY: ${article.summary}`,
    ...article.body.map((paragraph) => `GUIDANCE: ${paragraph}`),
  ].join("\n")).join("\n\n").slice(0, 10000);
}
