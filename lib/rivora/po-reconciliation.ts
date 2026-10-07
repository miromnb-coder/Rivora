export const PO_RECONCILIATION_VERSION = "deterministic-v2-memory";

export type ReconciliationExceptionCode =
  | "product_identity_review"
  | "quantity_mismatch"
  | "unit_mismatch"
  | "unit_price_mismatch"
  | "line_total_mismatch"
  | "extra_po_line"
  | "missing_quote_line";

export type ReconciliationMatchMethod =
  | "customer_sku_exact"
  | "sku_exact"
  | "mpn_exact"
  | "description_exact"
  | "description_similarity"
  | "unmatched_po"
  | "missing_quote";

export type PurchaseOrderLineInput = {
  id: string;
  lineNumber: number;
  customerSku: string | null;
  manufacturerPartNumber: string | null;
  description: string;
  quantity: number;
  unit: string | null;
  unitPrice: number | null;
  lineTotal: number | null;
};

export type QuoteLineInput = {
  id: string;
  lineNumber: number;
  sku: string | null;
  productSku: string | null;
  manufacturerPartNumber: string | null;
  description: string;
  sourceCustomerSku: string | null;
  sourceDescription: string | null;
  quantity: number;
  unit: string | null;
  unitPrice: number;
  discountPercent: number;
  lineTotal: number;
};

export type UnitMemoryAlias = {
  memoryId: string;
  sourceUnit: string;
  targetUnit: string;
};

export type ReconciliationMemoryContext = {
  unit_memory?: {
    memory_id: string;
    source_unit: string;
    target_unit: string;
  };
};

export type ReconciliationLineResult = {
  poLineId: string | null;
  quoteLineId: string | null;
  lineKind: "paired" | "extra_po" | "missing_quote";
  matchMethod: ReconciliationMatchMethod;
  matchScore: number;
  exceptionCodes: ReconciliationExceptionCode[];
  reviewStatus: "not_required" | "open";
  poSnapshot: PurchaseOrderLineInput | null;
  quoteSnapshot: QuoteLineInput | null;
  memoryContext: ReconciliationMemoryContext;
};

export type PurchaseOrderReconciliationResult = {
  algorithmVersion: string;
  lines: ReconciliationLineResult[];
  summary: {
    purchaseOrderLines: number;
    quoteLines: number;
    pairedLines: number;
    exactIdentifierMatches: number;
    cleanMatches: number;
    exceptionLines: number;
    extraPurchaseOrderLines: number;
    missingQuoteLines: number;
    memoryAssistedLines: number;
  };
};

function normalizeIdentifier(value: string | null | undefined) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9åäö]+/g, "");
}

function normalizeDescription(value: string | null | undefined) {
  return String(value ?? "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9åäö]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function tokenSet(value: string | null | undefined) {
  return new Set(
    normalizeDescription(value)
      .split(" ")
      .filter((token) => token.length >= 2)
  );
}

function jaccardSimilarity(left: string | null | undefined, right: string | null | undefined) {
  const a = tokenSet(left);
  const b = tokenSet(right);
  if (!a.size || !b.size) return 0;

  let intersection = 0;
  for (const token of a) {
    if (b.has(token)) intersection += 1;
  }
  const union = new Set([...a, ...b]).size;
  return union ? intersection / union : 0;
}

function normalizeUnit(value: string | null | undefined) {
  const unit = String(value ?? "").trim().toLowerCase().replace(/[.]/g, "");
  if (!unit) return "";
  if (["pcs", "pc", "piece", "pieces", "ea", "each", "kpl", "stk"].includes(unit)) return "pcs";
  if (["kg", "kilogram", "kilograms"].includes(unit)) return "kg";
  if (["g", "gram", "grams"].includes(unit)) return "g";
  if (["m", "meter", "metre", "meters", "metres"].includes(unit)) return "m";
  if (["mm", "millimeter", "millimetre", "millimeters", "millimetres"].includes(unit)) return "mm";
  if (["l", "liter", "litre", "liters", "litres"].includes(unit)) return "l";
  return unit;
}

function normalizeUnitMemoryKey(value: string | null | undefined) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[\s.]+/g, "");
}

function resolvePoUnit(
  value: string | null | undefined,
  unitAliases: ReadonlyMap<string, UnitMemoryAlias>,
) {
  const original = String(value ?? "").trim();
  const normalized = normalizeUnit(original);
  const alias = unitAliases.get(normalizeUnitMemoryKey(original));
  if (!alias) return { normalized, alias: null as UnitMemoryAlias | null };

  const target = normalizeUnit(alias.targetUnit);
  if (!target || target === normalized) {
    return { normalized, alias: null as UnitMemoryAlias | null };
  }

  return { normalized: target, alias };
}

function unitComparison(
  poUnit: string | null | undefined,
  quoteUnit: string | null | undefined,
  unitAliases: ReadonlyMap<string, UnitMemoryAlias>,
) {
  const po = resolvePoUnit(poUnit, unitAliases);
  const quote = normalizeUnit(quoteUnit);
  const alias =
    po.alias && po.normalized && quote && po.normalized === quote
      ? po.alias
      : null;

  return {
    poUnit: po.normalized,
    quoteUnit: quote,
    alias,
  };
}

function nearlyEqual(left: number, right: number, tolerance: number) {
  return Math.abs(left - right) <= tolerance;
}

function quoteNetUnitPrice(line: QuoteLineInput) {
  if (line.quantity > 0 && Number.isFinite(line.lineTotal)) {
    return line.lineTotal / line.quantity;
  }
  return line.unitPrice * (1 - line.discountPercent / 100);
}

function purchaseOrderNetUnitPrice(line: PurchaseOrderLineInput) {
  if (
    line.lineTotal != null &&
    line.quantity > 0 &&
    Number.isFinite(line.lineTotal)
  ) {
    return line.lineTotal / line.quantity;
  }
  return line.unitPrice;
}

type Candidate = {
  poIndex: number;
  quoteIndex: number;
  score: number;
  method: ReconciliationMatchMethod;
  fuzzy: boolean;
};

function buildCandidate(
  po: PurchaseOrderLineInput,
  quote: QuoteLineInput,
  poIndex: number,
  quoteIndex: number,
  unitAliases: ReadonlyMap<string, UnitMemoryAlias>,
): Candidate | null {
  const poSku = normalizeIdentifier(po.customerSku);
  const poMpn = normalizeIdentifier(po.manufacturerPartNumber);
  const quoteCustomerSku = normalizeIdentifier(quote.sourceCustomerSku);
  const quoteSku = normalizeIdentifier(quote.sku);
  const quoteProductSku = normalizeIdentifier(quote.productSku);
  const quoteMpn = normalizeIdentifier(quote.manufacturerPartNumber);

  let score = 0;
  let method: ReconciliationMatchMethod | null = null;
  let fuzzy = false;

  if (poSku && quoteCustomerSku && poSku === quoteCustomerSku) {
    score = 100;
    method = "customer_sku_exact";
  } else if (
    poSku &&
    ((quoteSku && poSku === quoteSku) || (quoteProductSku && poSku === quoteProductSku))
  ) {
    score = 98;
    method = "sku_exact";
  } else if (
    (poMpn && quoteMpn && poMpn === quoteMpn) ||
    (poSku && quoteMpn && poSku === quoteMpn)
  ) {
    score = 96;
    method = "mpn_exact";
  } else {
    const poDescription = normalizeDescription(po.description);
    const quoteDescription = normalizeDescription(quote.description || quote.sourceDescription);

    if (poDescription && quoteDescription && poDescription === quoteDescription) {
      score = 90;
      method = "description_exact";
    } else {
      const similarity = Math.max(
        jaccardSimilarity(po.description, quote.description),
        jaccardSimilarity(po.description, quote.sourceDescription)
      );
      if (similarity >= 0.8) {
        score = 80 + similarity * 10;
        method = "description_similarity";
        fuzzy = true;
      }
    }
  }

  if (!method) return null;

  if (nearlyEqual(po.quantity, quote.quantity, 0.0001)) score += 1;
  const units = unitComparison(po.unit, quote.unit, unitAliases);
  if (units.poUnit && units.poUnit === units.quoteUnit) score += 0.5;
  if (po.lineNumber === quote.lineNumber) score += 0.1;

  return { poIndex, quoteIndex, score, method, fuzzy };
}

function comparePair(
  po: PurchaseOrderLineInput,
  quote: QuoteLineInput,
  candidate: Candidate,
  unitAliases: ReadonlyMap<string, UnitMemoryAlias>,
): ReconciliationExceptionCode[] {
  const exceptions: ReconciliationExceptionCode[] = [];

  if (candidate.fuzzy) exceptions.push("product_identity_review");

  if (!nearlyEqual(po.quantity, quote.quantity, 0.0001)) {
    exceptions.push("quantity_mismatch");
  }

  const units = unitComparison(po.unit, quote.unit, unitAliases);
  if (units.poUnit && units.quoteUnit && units.poUnit !== units.quoteUnit) {
    exceptions.push("unit_mismatch");
  }

  const poNetUnitPrice = purchaseOrderNetUnitPrice(po);
  if (poNetUnitPrice != null) {
    const expected = quoteNetUnitPrice(quote);
    if (!nearlyEqual(poNetUnitPrice, expected, 0.01)) {
      exceptions.push("unit_price_mismatch");
    }
  }

  if (po.lineTotal != null && !nearlyEqual(po.lineTotal, quote.lineTotal, 0.02)) {
    exceptions.push("line_total_mismatch");
  }

  return exceptions;
}

export function reconcilePurchaseOrder(
  purchaseOrderLines: PurchaseOrderLineInput[],
  quoteLines: QuoteLineInput[],
  options: {
    unitAliases?: ReadonlyMap<string, UnitMemoryAlias>;
  } = {},
): PurchaseOrderReconciliationResult {
  const candidates: Candidate[] = [];
  const unitAliases =
    options.unitAliases ?? new Map<string, UnitMemoryAlias>();

  purchaseOrderLines.forEach((po, poIndex) => {
    quoteLines.forEach((quote, quoteIndex) => {
      const candidate = buildCandidate(
        po,
        quote,
        poIndex,
        quoteIndex,
        unitAliases,
      );
      if (candidate) candidates.push(candidate);
    });
  });

  candidates.sort((left, right) => {
    if (right.score !== left.score) return right.score - left.score;
    if (left.poIndex !== right.poIndex) return left.poIndex - right.poIndex;
    return left.quoteIndex - right.quoteIndex;
  });

  const pairedPo = new Set<number>();
  const pairedQuote = new Set<number>();
  const results: ReconciliationLineResult[] = [];

  for (const candidate of candidates) {
    if (pairedPo.has(candidate.poIndex) || pairedQuote.has(candidate.quoteIndex)) continue;

    const po = purchaseOrderLines[candidate.poIndex]!;
    const quote = quoteLines[candidate.quoteIndex]!;
    const exceptionCodes = comparePair(po, quote, candidate, unitAliases);
    const units = unitComparison(po.unit, quote.unit, unitAliases);
    const memoryContext: ReconciliationMemoryContext =
      units.alias && units.poUnit === units.quoteUnit
        ? {
            unit_memory: {
              memory_id: units.alias.memoryId,
              source_unit: String(po.unit ?? "").trim(),
              target_unit: units.alias.targetUnit,
            },
          }
        : {};

    pairedPo.add(candidate.poIndex);
    pairedQuote.add(candidate.quoteIndex);
    results.push({
      poLineId: po.id,
      quoteLineId: quote.id,
      lineKind: "paired",
      matchMethod: candidate.method,
      matchScore: Math.min(100, Number(candidate.score.toFixed(2))),
      exceptionCodes,
      reviewStatus: exceptionCodes.length ? "open" : "not_required",
      poSnapshot: po,
      quoteSnapshot: quote,
      memoryContext,
    });
  }

  purchaseOrderLines.forEach((po, index) => {
    if (pairedPo.has(index)) return;
    results.push({
      poLineId: po.id,
      quoteLineId: null,
      lineKind: "extra_po",
      matchMethod: "unmatched_po",
      matchScore: 0,
      exceptionCodes: ["extra_po_line"],
      reviewStatus: "open",
      poSnapshot: po,
      quoteSnapshot: null,
      memoryContext: {},
    });
  });

  quoteLines.forEach((quote, index) => {
    if (pairedQuote.has(index)) return;
    results.push({
      poLineId: null,
      quoteLineId: quote.id,
      lineKind: "missing_quote",
      matchMethod: "missing_quote",
      matchScore: 0,
      exceptionCodes: ["missing_quote_line"],
      reviewStatus: "open",
      poSnapshot: null,
      quoteSnapshot: quote,
      memoryContext: {},
    });
  });

  results.sort((left, right) => {
    const leftLine = left.poSnapshot?.lineNumber ?? left.quoteSnapshot?.lineNumber ?? Number.MAX_SAFE_INTEGER;
    const rightLine = right.poSnapshot?.lineNumber ?? right.quoteSnapshot?.lineNumber ?? Number.MAX_SAFE_INTEGER;
    return leftLine - rightLine;
  });

  const paired = results.filter((line) => line.lineKind === "paired");
  const exactMethods = new Set<ReconciliationMatchMethod>([
    "customer_sku_exact",
    "sku_exact",
    "mpn_exact",
  ]);

  return {
    algorithmVersion: PO_RECONCILIATION_VERSION,
    lines: results,
    summary: {
      purchaseOrderLines: purchaseOrderLines.length,
      quoteLines: quoteLines.length,
      pairedLines: paired.length,
      exactIdentifierMatches: paired.filter((line) => exactMethods.has(line.matchMethod)).length,
      cleanMatches: results.filter((line) => line.exceptionCodes.length === 0).length,
      exceptionLines: results.filter((line) => line.exceptionCodes.length > 0).length,
      extraPurchaseOrderLines: results.filter((line) => line.lineKind === "extra_po").length,
      missingQuoteLines: results.filter((line) => line.lineKind === "missing_quote").length,
      memoryAssistedLines: results.filter(
        (line) => Boolean(line.memoryContext.unit_memory),
      ).length,
    },
  };
}
