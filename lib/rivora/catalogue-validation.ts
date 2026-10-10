// Catalogue numeric(14,4) values must survive JSON and PostgreSQL without rounding.
export function parseCatalogueNumber(value: string): number | null {
  const raw = value.trim().replace(/[\u00a0\u202f]/g, " ");
  if (!raw) return null;
  if (raw.startsWith("-"))
    throw new Error("Negatiivinen arvo ei ole sallittu.");
  let normalized: string;
  if (/^\d{1,3}( \d{3})+([.,]\d{1,4})?$/.test(raw)) {
    normalized = raw.replace(/ /g, "").replace(",", ".");
  } else if (/^\d{1,3}(,\d{3})+\.\d{1,4}$/.test(raw)) {
    normalized = raw.replace(/,/g, "");
  } else if (/^\d{1,3}(\.\d{3})+,\d{1,4}$/.test(raw)) {
    normalized = raw.replace(/\./g, "").replace(",", ".");
  } else if (/^\d+([.,]\d{1,4})?$/.test(raw)) {
    // A lone separator followed by three digits could mean thousands or decimals.
    if (/^\d{1,3}[.,]\d{3}$/.test(raw)) {
      throw new Error(
        "Epäselvä erotin: käytä tuhaterottimena välilyöntiä tai lisää neljäs desimaali.",
      );
    }
    normalized = raw.replace(",", ".");
  } else {
    throw new Error(
      "Virheellinen luku. Käytä esimerkiksi 1234,56 tai 1 234,56, enintään neljä desimaalia.",
    );
  }
  const number = Number(normalized);
  if (!Number.isFinite(number) || number >= 10_000_000_000) {
    throw new Error("Arvo ylittää tietokannan rajan 9 999 999 999,9999.");
  }
  // Compare decimal coefficients, not binary floats, to detect loss in JSON encoding.
  const coefficient = (v: string) => {
    const [whole, fraction = ""] = v.split(".");
    return BigInt(whole) * BigInt(10000) + BigInt(fraction.padEnd(4, "0"));
  };
  if (
    coefficient(normalized) !== coefficient(number.toFixed(4)) ||
    coefficient(normalized) !== coefficient(String(number))
  ) {
    throw new Error(
      "Arvon tarkkuus ei säily. Pienennä arvoa tai desimaalien määrää.",
    );
  }
  return number;
}

// Pure callers use Unicode lowercase; HTTP imports obtain authoritative keys from
// PostgreSQL as well, including Unicode cases that differ between JS and DB locales.
export function catalogueSkuKey(sku: string) {
  return sku.replace(/^ +| +$/g, "").toLowerCase();
}
