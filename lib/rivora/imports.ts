import { parse } from "csv-parse/sync";
import ExcelJS from "exceljs";

type RawRow = Record<string, string>;

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
  lineTotal: number | null;
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

export async function parseTabularFile(file: File): Promise<RawRow[]> {
  if (!file || file.size === 0) throw new Error("Choose a CSV or XLSX file.");
  if (file.size > 10 * 1024 * 1024) throw new Error("File is larger than the 10 MB MVP limit.");

  const buffer = Buffer.from(await file.arrayBuffer());
  const lower = file.name.toLowerCase();

  if (lower.endsWith(".csv")) {
    return parse(buffer.toString("utf8"), {
      columns: true,
      skip_empty_lines: true,
      trim: true,
      bom: true,
      relax_column_count: true,
    }) as RawRow[];
  }

  if (lower.endsWith(".xlsx")) return parseXlsx(buffer);

  throw new Error("Averomira accepts CSV and XLSX files.");
}

export function sourceTypeFromName(name: string): "csv" | "excel" {
  return name.toLowerCase().endsWith(".csv") ? "csv" : "excel";
}

export function toCatalogueRows(rows: RawRow[]): CatalogueImportRow[] {
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


export function toPurchaseOrderRows(rows: RawRow[]): PurchaseOrderImportRow[] {
  if (!rows.length) {
    throw new Error("Purchase order file has no order rows.");
  }

  return rows.map((row, index) => {
    const customerSku =
      pick(row, ["customer sku", "sku", "item code", "part number", "product code", "tuotenumero", "nimike"]) || null;
    const description =
      pick(row, ["description", "product name", "item description", "kuvaus", "tuotenimi"]) || "";
    const manufacturer = pick(row, ["manufacturer", "brand", "valmistaja"]) || null;
    const manufacturerPartNumber =
      pick(row, ["manufacturer part number", "mpn", "manufacturer sku", "valmistajan tuotenumero"]) || null;
    const quantity = parseNumber(pick(row, ["quantity", "qty", "amount", "ordered quantity", "määrä", "kpl"]));
    const unit = pick(row, ["unit", "uom", "yksikkö"]) || "pcs";
    const unitPrice = parseNumber(
      pick(row, ["unit price", "price", "net price", "hinta", "yksikköhinta"])
    );
    const lineTotal = parseNumber(
      pick(row, ["line total", "total", "row total", "sum", "rivisumma"])
    );

    if (!customerSku && !manufacturerPartNumber && !description) {
      throw new Error(
        `Purchase order row ${index + 2} is missing a product identifier and description.`
      );
    }
    if (quantity == null || quantity <= 0) {
      throw new Error(
        `Purchase order row ${index + 2} has a missing or invalid quantity.`
      );
    }
    if (unitPrice != null && unitPrice < 0) {
      throw new Error(`Purchase order row ${index + 2} has a negative unit price.`);
    }
    if (lineTotal != null && lineTotal < 0) {
      throw new Error(`Purchase order row ${index + 2} has a negative line total.`);
    }

    return {
      customerSku,
      description,
      manufacturer,
      manufacturerPartNumber,
      quantity,
      unit,
      unitPrice,
      lineTotal,
    };
  });
}
