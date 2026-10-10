export const CATALOGUE_FIELDS = {
  sku: {
    label: "SKU / tuotenumero",
    aliases: [
      "sku",
      "product no",
      "product number",
      "product code",
      "item code",
      "item number",
      "tuotenumero",
      "nimike",
    ],
  },
  name: {
    label: "Tuotenimi",
    aliases: [
      "name",
      "product name",
      "description",
      "item description",
      "tuotenimi",
      "kuvaus",
    ],
  },
  unitPrice: {
    label: "Yksikköhinta",
    aliases: ["price", "unit price", "sales price", "hinta", "yksikköhinta"],
  },
  stockQuantity: {
    label: "Varastosaldo",
    aliases: [
      "stock",
      "stock quantity",
      "stock qty",
      "stock_qty",
      "available",
      "inventory",
      "saldo",
      "varasto",
      "varastomäärä",
    ],
  },
  unit: { label: "Yksikkö", aliases: ["unit", "uom", "yksikkö"] },
  manufacturer: {
    label: "Valmistaja",
    aliases: ["manufacturer", "brand", "valmistaja"],
  },
  manufacturerPartNumber: {
    label: "Valmistajan tuotenumero",
    aliases: [
      "manufacturer part number",
      "mpn",
      "manufacturer sku",
      "valmistajan tuotenumero",
    ],
  },
} as const;
export type CatalogueField = keyof typeof CATALOGUE_FIELDS;
export type CatalogueMapping = Partial<Record<CatalogueField, string>>;
export type CatalogueIssue = {
  row: number;
  column: string;
  value: string;
  reason: string;
  correction: string;
};
export type CatalogueTable = {
  headers: string[];
  rows: string[][];
  rowNumbers: number[];
  delimiter: string | null;
  format: "csv" | "xlsx";
  hash: string;
};
const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9åäö]/g, "");

export function suggestCatalogueMapping(headers: string[]): CatalogueMapping {
  const result: CatalogueMapping = {};
  const used = new Set<string>();
  for (const [field, config] of Object.entries(CATALOGUE_FIELDS)) {
    const hits = headers.filter((header) =>
      config.aliases.some((alias) => normalize(alias) === normalize(header)),
    );
    if (hits.length === 1 && !used.has(hits[0])) {
      result[field as CatalogueField] = hits[0];
      used.add(hits[0]);
    }
  }
  return result;
}

export function validateCatalogueMapping(
  headers: string[],
  mapping: CatalogueMapping,
) {
  if (!mapping || typeof mapping !== "object" || Array.isArray(mapping))
    throw new Error("Valitse sarakekartta.");
  const selected = new Set<string>();
  for (const [field, header] of Object.entries(mapping)) {
    if (
      !Object.hasOwn(CATALOGUE_FIELDS, field) ||
      typeof header !== "string" ||
      !headers.includes(header)
    )
      throw new Error(
        "Sarakekartta sisältää tuntemattoman kentän tai sarakkeen.",
      );
    if (selected.has(header))
      throw new Error(
        `Sarake ${header} on valittu useaan kenttään. Valitse vain yksi vastaavuus.`,
      );
    selected.add(header);
  }
  if (!mapping.sku || !mapping.name)
    throw new Error("Valitse pakolliset SKU- ja tuotenimisarakkeet.");
}
