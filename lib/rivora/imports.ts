import { parse } from "csv-parse/sync";
import ExcelJS from "exceljs";

type RawRow = Record<string, string>;

const MAX_GENERIC_ROWS = 50_000;
const MAX_COLUMNS = 100;
const MAX_CELL_CHARS = 5_000;
const MAX_CATALOGUE_ROWS = 25_000;
const MAX_RFQ_ROWS = 1_000;
const MAX_PURCHASE_ORDER_ROWS = 2_000;

export type CatalogueImportRow = {
  sku: string;
  name: string;
  manufacturer: string | null;
  manufacturerPartNumber: string | null;
  unit: string;
  unitPrice: number | null;
  stockQuantity: number | null;
  stockQuantityProvided: boolean;
};

export type RfqImportRow = {
  customerSku: string | null;
  description: string;
  quantity: number;
  unit: string;
};

export type PurchaseOrderImportRow = {
  customerSku: string | null;
  description: string;
  manufacturer: string | null;
  manufacturerPartNumber: string | null;
  quantity: number;
  unit: string;
  unitPrice: number | null;
  discountPercent: number;
  lineTotal: number | null;
};
export const PURCHASE_ORDER_FIELD_MEMORY_TARGETS = [
  "customer_sku",
  "description",
  "manufacturer",
  "manufacturer_part_number",
  "quantity",
  "unit",
  "unit_price",
  "net_unit_price",
  "discount_percent",
  "line_total",
] as const;

export type PurchaseOrderFieldMemoryTarget =
  (typeof PURCHASE_ORDER_FIELD_MEMORY_TARGETS)[number];

export type PurchaseOrderFieldMemory = {
  memoryId: string;
  sourceHeader: string;
  targetField: PurchaseOrderFieldMemoryTarget;
};

export type PurchaseOrderFieldMemoryUse = {
  memoryId: string;
  sourceHeader: string;
  targetField: PurchaseOrderFieldMemoryTarget;
};


function normalizeHeader(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9åäö]+/g, "");
}

function pick(row: RawRow, aliases: string[]) {
  const entries = Object.entries(row);
  for (const alias of aliases) {
    const target = normalizeHeader(alias);
    const hit = entries.find(([key]) => normalizeHeader(key) === target);
    if (hit && hit[1]?.trim()) return hit[1].trim();
  }
  return "";
}

function hasHeader(row: RawRow, aliases: string[]) {
  const targets = new Set(aliases.map(normalizeHeader));
  return Object.keys(row).some((key) => targets.has(normalizeHeader(key)));
}

function parseNumber(value: string): number | null {
  const raw = value.trim().replace(/\s/g, "");
  if (!raw) return null;

  let normalized = raw;
  const comma = raw.lastIndexOf(",");
  const dot = raw.lastIndexOf(".");

  if (comma >= 0 && dot >= 0) {
    normalized =
      comma > dot
        ? raw.replace(/\./g, "").replace(",", ".")
        : raw.replace(/,/g, "");
  } else if (comma >= 0) {
    normalized = raw.replace(",", ".");
  }

  const number = Number(normalized.replace(/[^0-9.+-]/g, ""));
  return Number.isFinite(number) ? number : null;
}

async function parseXlsx(buffer: Buffer): Promise<RawRow[]> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as unknown as Parameters<typeof workbook.xlsx.load>[0]);
  const sheet = workbook.worksheets[0];
  if (!sheet) return [];

  const headers: string[] = [];
  sheet.getRow(1).eachCell({ includeEmpty: true }, (cell, column) => {
    headers[column - 1] = cell.text.trim();
  });

  const rows: RawRow[] = [];
  for (let rowNumber = 2; rowNumber <= sheet.rowCount; rowNumber += 1) {
    const row = sheet.getRow(rowNumber);
    const record: RawRow = {};
    let hasValue = false;

    headers.forEach((header, index) => {
      if (!header) return;
      const value = row.getCell(index + 1).text.trim();
      if (value) hasValue = true;
      record[header] = value;
    });

    if (hasValue) rows.push(record);
  }

  return rows;
}

function validateTabularShape(rows: RawRow[]) {
  if (rows.length > MAX_GENERIC_ROWS) {
    throw new Error(`File has too many rows. Maximum is ${MAX_GENERIC_ROWS.toLocaleString("en-US")}.`);
  }

  for (const [index, row] of rows.entries()) {
    const entries = Object.entries(row);
    if (entries.length > MAX_COLUMNS) {
      throw new Error(`Row ${index + 2} has too many columns. Maximum is ${MAX_COLUMNS}.`);
    }
    if (entries.some(([, value]) => String(value).length > MAX_CELL_CHARS)) {
      throw new Error(`Row ${index + 2} contains a cell that is too long.`);
    }
  }

  return rows;
}

export async function parseTabularFile(file: File): Promise<RawRow[]> {
  if (!file || file.size === 0) throw new Error("Choose a CSV or XLSX file.");
  if (file.size > 10 * 1024 * 1024) throw new Error("File is larger than the 10 MB Averomira limit.");

  const buffer = Buffer.from(await file.arrayBuffer());
  const lower = file.name.toLowerCase();

  if (lower.endsWith(".csv")) {
    const rows = parse(buffer.toString("utf8"), {
      columns: true,
      skip_empty_lines: true,
      trim: true,
      bom: true,
      relax_column_count: true,
    }) as RawRow[];
    return validateTabularShape(rows);
  }

  if (lower.endsWith(".xlsx")) {
    return validateTabularShape(await parseXlsx(buffer));
  }

  throw new Error("Averomira accepts CSV and XLSX files.");
}

export function sourceTypeFromName(name: string): "csv" | "excel" {
  return name.toLowerCase().endsWith(".csv") ? "csv" : "excel";
}

export function toCatalogueRows(rows: RawRow[]): CatalogueImportRow[] {
  if (rows.length > MAX_CATALOGUE_ROWS) {
    throw new Error(`Catalogue has too many rows. Maximum is ${MAX_CATALOGUE_ROWS.toLocaleString("en-US")}.`);
  }
  if (!rows.length) {
    throw new Error("Catalogue file has no product rows.");
  }

  return rows.map((row, index) => {
    const sku = pick(row, ["sku", "product code", "item code", "item number", "tuotenumero", "nimike"]);
    const name = pick(row, ["name", "product name", "description", "tuotenimi", "kuvaus"]);
    if (!sku || !name) {
      throw new Error(`Catalogue row ${index + 2} is missing SKU or product name.`);
    }

    const unitPrice = parseNumber(pick(row, ["price", "unit price", "sales price", "hinta"]));
    if (unitPrice != null && unitPrice < 0) {
      throw new Error(`Catalogue row ${index + 2} has a negative unit price.`);
    }

    const stockAliases = [
      "stock",
      "stock quantity",
      "stock qty",
      "stock_qty",
      "available",
      "inventory",
      "saldo",
      "varasto",
      "varastomäärä",
    ];
    const stockQuantityProvided = hasHeader(row, stockAliases);
    const stockQuantity = parseNumber(pick(row, stockAliases));
    if (stockQuantity != null && stockQuantity < 0) {
      throw new Error(`Catalogue row ${index + 2} has a negative stock quantity.`);
    }

    return {
      sku,
      name,
      manufacturer: pick(row, ["manufacturer", "brand", "valmistaja"]) || null,
      manufacturerPartNumber:
        pick(row, ["manufacturer part number", "mpn", "manufacturer sku", "valmistajan tuotenumero"]) || null,
      unit: pick(row, ["unit", "uom", "yksikkö"]) || "pcs",
      unitPrice,
      stockQuantity,
      stockQuantityProvided,
    };
  });
}

export function toRfqRows(rows: RawRow[]): RfqImportRow[] {
  if (rows.length > MAX_RFQ_ROWS) {
    throw new Error(`RFQ has too many rows. Maximum is ${MAX_RFQ_ROWS.toLocaleString("en-US")}.`);
  }
  if (!rows.length) {
    throw new Error("RFQ file has no request rows.");
  }

  return rows.map((row, index) => {
    const customerSku =
      pick(row, ["customer sku", "sku", "item code", "part number", "product code", "tuotenumero", "nimike"]) || null;
    const description =
      pick(row, ["description", "product name", "item description", "kuvaus", "tuotenimi"]) || "";
    const quantity = parseNumber(pick(row, ["quantity", "qty", "amount", "määrä", "kpl"]));
    const unit = pick(row, ["unit", "uom", "yksikkö"]) || "pcs";

    if (!customerSku && !description) {
      throw new Error(`RFQ row ${index + 2} is missing both SKU and description.`);
    }
    if (quantity == null || quantity <= 0) {
      throw new Error(`RFQ row ${index + 2} has a missing or invalid quantity.`);
    }

    return { customerSku, description, quantity, unit };
  });
}


function purchaseOrderFieldPicker(
  row: RawRow,
  field: PurchaseOrderFieldMemoryTarget,
  aliases: string[],
  memoryByHeader: Map<string, PurchaseOrderFieldMemory>,
  usedMemories: Map<string, PurchaseOrderFieldMemoryUse>,
) {
  const entries = Object.entries(row);

  for (const [header, rawValue] of entries) {
    const memory = memoryByHeader.get(normalizeHeader(header));
    const value = String(rawValue ?? "").trim();
    if (!memory || memory.targetField !== field || !value) continue;

    usedMemories.set(memory.memoryId, {
      memoryId: memory.memoryId,
      sourceHeader: header,
      targetField: memory.targetField,
    });
    return value;
  }

  // Preserve the existing built-in alias priority. The aliases array is
  // intentionally ordered from most specific to more generic names
  // ("unit price" before "price", for example). Customer memory still owns a
  // header completely, so a generic built-in alias cannot reinterpret it.
  for (const alias of aliases) {
    const target = normalizeHeader(alias);
    const hit = entries.find(([header, rawValue]) => {
      const normalizedHeader = normalizeHeader(header);
      if (normalizedHeader !== target) return false;
      if (memoryByHeader.has(normalizedHeader)) return false;
      return Boolean(String(rawValue ?? "").trim());
    });

    if (hit) return String(hit[1] ?? "").trim();
  }

  return "";
}

function parsePurchaseOrderRows(
  rows: RawRow[],
  fieldMemories: PurchaseOrderFieldMemory[],
) {
  if (rows.length > MAX_PURCHASE_ORDER_ROWS) {
    throw new Error(`Purchase order has too many rows. Maximum is ${MAX_PURCHASE_ORDER_ROWS.toLocaleString("en-US")}.`);
  }
  if (!rows.length) {
    throw new Error("Purchase order file has no order rows.");
  }

  const memoryByHeader = new Map<string, PurchaseOrderFieldMemory>();
  for (const memory of fieldMemories) {
    const key = normalizeHeader(memory.sourceHeader);
    if (!key) continue;

    const existing = memoryByHeader.get(key);
    if (existing && existing.targetField !== memory.targetField) {
      throw new Error(
        `Customer PO field memory is ambiguous for header "${memory.sourceHeader}".`,
      );
    }
    memoryByHeader.set(key, memory);
  }

  const usedMemories = new Map<string, PurchaseOrderFieldMemoryUse>();

  const parsedRows = rows.map((row, index) => {
    const field = (
      target: PurchaseOrderFieldMemoryTarget,
      aliases: string[],
    ) =>
      purchaseOrderFieldPicker(
        row,
        target,
        aliases,
        memoryByHeader,
        usedMemories,
      );

    const customerSku =
      field("customer_sku", [
        "customer sku",
        "sku",
        "item code",
        "part number",
        "product code",
        "tuotenumero",
        "nimike",
      ]) || null;
    const description =
      field("description", [
        "description",
        "product name",
        "item description",
        "kuvaus",
        "tuotenimi",
      ]) || "";
    const manufacturer =
      field("manufacturer", ["manufacturer", "brand", "valmistaja"]) || null;
    const manufacturerPartNumber =
      field("manufacturer_part_number", [
        "manufacturer part number",
        "mpn",
        "manufacturer sku",
        "valmistajan tuotenumero",
      ]) || null;
    const quantity = parseNumber(
      field("quantity", [
        "quantity",
        "qty",
        "amount",
        "ordered quantity",
        "määrä",
        "kpl",
      ]),
    );
    const unit =
      field("unit", ["unit", "uom", "yksikkö"]) || "pcs";
    const explicitNetUnitPrice = parseNumber(
      field("net_unit_price", [
        "net unit price",
        "net price",
        "nettohinta",
        "netto yksikköhinta",
      ]),
    );
    const grossUnitPrice = parseNumber(
      field("unit_price", [
        "unit price",
        "price",
        "gross unit price",
        "hinta",
        "yksikköhinta",
        "bruttohinta",
      ]),
    );
    const discountPercent =
      parseNumber(
        field("discount_percent", [
          "discount percent",
          "discount %",
          "discount_percent",
          "discount",
          "alennusprosentti",
          "alennus %",
          "alennus",
        ]),
      ) ?? 0;
    const lineTotal = parseNumber(
      field("line_total", [
        "line total",
        "total",
        "row total",
        "sum",
        "rivisumma",
      ]),
    );

    if (!customerSku && !manufacturerPartNumber && !description) {
      throw new Error(
        `Purchase order row ${index + 2} is missing a product identifier and description.`,
      );
    }
    if (quantity == null || quantity <= 0) {
      throw new Error(
        `Purchase order row ${index + 2} has a missing or invalid quantity.`,
      );
    }
    if (grossUnitPrice != null && grossUnitPrice < 0) {
      throw new Error(`Purchase order row ${index + 2} has a negative unit price.`);
    }
    if (explicitNetUnitPrice != null && explicitNetUnitPrice < 0) {
      throw new Error(`Purchase order row ${index + 2} has a negative net unit price.`);
    }
    if (discountPercent < 0 || discountPercent > 100) {
      throw new Error(`Purchase order row ${index + 2} has an invalid discount percent.`);
    }
    if (lineTotal != null && lineTotal < 0) {
      throw new Error(`Purchase order row ${index + 2} has a negative line total.`);
    }

    const discountedGross =
      grossUnitPrice == null
        ? null
        : grossUnitPrice * (1 - discountPercent / 100);
    let unitPrice =
      explicitNetUnitPrice ??
      (discountedGross == null ? null : Number(discountedGross.toFixed(4)));

    if (unitPrice == null && lineTotal != null) {
      unitPrice = Number((lineTotal / quantity).toFixed(4));
    }

    if (
      lineTotal != null &&
      unitPrice != null &&
      Math.abs(quantity * unitPrice - lineTotal) > 0.02
    ) {
      throw new Error(
        `Purchase order row ${index + 2} has inconsistent unit price, discount and line total.`,
      );
    }

    return {
      customerSku,
      description,
      manufacturer,
      manufacturerPartNumber,
      quantity,
      unit,
      unitPrice,
      discountPercent,
      lineTotal,
    };
  });

  return {
    rows: parsedRows,
    usedMemories: [...usedMemories.values()],
  };
}

export function toPurchaseOrderRows(rows: RawRow[]): PurchaseOrderImportRow[] {
  return parsePurchaseOrderRows(rows, []).rows;
}

export function toPurchaseOrderRowsWithFieldMemory(
  rows: RawRow[],
  fieldMemories: PurchaseOrderFieldMemory[],
): {
  rows: PurchaseOrderImportRow[];
  usedMemories: PurchaseOrderFieldMemoryUse[];
} {
  return parsePurchaseOrderRows(rows, fieldMemories);
}

