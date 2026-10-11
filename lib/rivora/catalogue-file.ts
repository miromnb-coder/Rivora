import { parse } from "csv-parse/sync";
import ExcelJS from "exceljs";
import { inflateRawSync } from "node:zlib";
import { createHash } from "node:crypto";
import type { CatalogueImportRow } from "./imports.ts";

import {
  catalogueSkuKey,
  parseCatalogueNumber,
} from "./catalogue-validation.ts";
import {
  validateCatalogueMapping,
  CATALOGUE_FIELDS,
  type CatalogueMapping,
  type CatalogueField,
  type CatalogueIssue,
  type CatalogueTable,
} from "./catalogue-fields.ts";
export {
  suggestCatalogueMapping,
  validateCatalogueMapping,
} from "./catalogue-fields.ts";
export type { CatalogueMapping } from "./catalogue-fields.ts";

// Inspect AND bounded-inflate every ZIP entry before ExcelJS allocates a workbook.
// Reject ZIP64, encrypted archives and overlapping/mismatched local headers.
export function validateCatalogueZip(buffer: Buffer) {
  let end = -1;
  for (
    let i = buffer.length - 22;
    i >= Math.max(0, buffer.length - 65557);
    i--
  ) {
    if (
      buffer.readUInt32LE(i) === 0x06054b50 &&
      i + 22 + buffer.readUInt16LE(i + 20) === buffer.length
    ) {
      end = i;
      break;
    }
  }
  if (end < 0)
    throw new Error("XLSX-tiedoston pakkausrakenne on virheellinen.");
  const count = buffer.readUInt16LE(end + 10),
    start = buffer.readUInt32LE(end + 16);
  if (
    count > 1000 ||
    count === 0 ||
    buffer.readUInt16LE(end + 4) ||
    buffer.readUInt16LE(end + 6) ||
    buffer.readUInt16LE(end + 8) !== count ||
    start + buffer.readUInt32LE(end + 12) !== end
  )
    throw new Error("XLSX-pakkaus ylittää sallitut rajat.");
  let offset = start,
    total = 0,
    previousEnd = 0,
    worksheetCount = 0;
  const entries: { local: number; dataEnd: number }[] = [];
  const names = new Set<string>();
  for (let i = 0; i < count; i++) {
    if (offset + 46 > end || buffer.readUInt32LE(offset) !== 0x02014b50)
      throw new Error("Virheellinen XLSX-pakkaus.");
    const flags = buffer.readUInt16LE(offset + 8),
      method = buffer.readUInt16LE(offset + 10);
    const packed = buffer.readUInt32LE(offset + 20),
      size = buffer.readUInt32LE(offset + 24);
    const nameSize = buffer.readUInt16LE(offset + 28),
      extra = buffer.readUInt16LE(offset + 30),
      comment = buffer.readUInt16LE(offset + 32);
    const local = buffer.readUInt32LE(offset + 42);
    const name = buffer
      .subarray(offset + 46, offset + 46 + nameSize)
      .toString("utf8");
    if (
      flags & 1 ||
      ![0, 8].includes(method) ||
      size > 32 * 1024 * 1024 ||
      size > Math.max(1024 * 1024, packed * 100) ||
      names.has(name) ||
      local + 30 > start ||
      buffer.readUInt32LE(local) !== 0x04034b50 ||
      buffer.readUInt16LE(local + 6) !== flags ||
      buffer.readUInt16LE(local + 8) !== method ||
      buffer
        .subarray(local + 30, local + 30 + buffer.readUInt16LE(local + 26))
        .toString("utf8") !== name
    )
      throw new Error("XLSX-pakkaus on liian suuri tai turvaton.");
    const dataStart =
      local +
      30 +
      buffer.readUInt16LE(local + 26) +
      buffer.readUInt16LE(local + 28);
    if (dataStart + packed > start)
      throw new Error("Virheellinen XLSX-pakkaus.");
    const data = buffer.subarray(dataStart, dataStart + packed);
    const actual =
      method === 8
        ? inflateRawSync(data, { maxOutputLength: 32 * 1024 * 1024 })
        : data;
    total += actual.length;
    if (actual.length !== size || total > 48 * 1024 * 1024)
      throw new Error("XLSX:n purettu koko ylittää 48 MB rajan.");
    if (/<!DOCTYPE|<!ENTITY/i.test(actual.toString("utf8")))
      throw new Error("XLSX sisältää kielletyn XML-rakenteen.");
    if (/^xl\/worksheets\/[^/]+\.xml$/.test(name)) {
      if (++worksheetCount > 1)
        throw new Error(
          "Valitse tuontiin yksi laskentataulukko ja tallenna se erilliseen XLSX-tiedostoon.",
        );
      const xml = actual.toString("utf8");
      let rowCount = 0,
        cellCount = 0,
        maxRow = 0,
        maxColumn = 0;
      for (const match of xml.matchAll(
        /<(?:\w+:)?row\b[^>]*\br=["'](\d+)["']/g,
      )) {
        rowCount++;
        maxRow = Math.max(maxRow, Number(match[1]));
        if (Number(match[1]) > 25001 || rowCount > 25001)
          throw new Error("XLSX ylittää 25 000 tuotteen rajan.");
      }
      for (const match of xml.matchAll(
        /<(?:\w+:)?c\b[^>]*\br=["']([A-Z]+)(\d+)["']/g,
      )) {
        cellCount++;
        let column = 0;
        for (const letter of match[1])
          column = column * 26 + letter.charCodeAt(0) - 64;
        maxColumn = Math.max(maxColumn, column);
        if (column > 100 || Number(match[2]) > 25001 || cellCount > 250_100)
          throw new Error("XLSX ylittää sarake- tai rivirajan.");
      }
      if (maxRow * maxColumn > 250_100)
        throw new Error(
          "XLSX ylittää 250 000 solun käsittelyrajan. Poista tarpeettomat sarakkeet.",
        );
    }
    names.add(name);
    entries.push({ local, dataEnd: dataStart + packed });
    offset += 46 + nameSize + extra + comment;
  }
  for (const entry of entries.sort((a, b) => a.local - b.local)) {
    if (entry.local < previousEnd)
      throw new Error("Päällekkäinen XLSX-pakkausrakenne.");
    previousEnd = entry.dataEnd;
  }
  if (offset !== end || !names.has("xl/workbook.xml"))
    throw new Error("Tiedosto ei ole kelvollinen XLSX.");
}

export async function readCatalogueFile(
  file: File,
  requestedDelimiter = "auto",
): Promise<CatalogueTable> {
  if (!file || !file.size) throw new Error("Valitse CSV- tai XLSX-tiedosto.");
  if (file.size > 10 * 1024 * 1024)
    throw new Error("Tiedosto ylittää 10 MB kokorajan.");
  const format = file.name.toLowerCase().endsWith(".csv")
    ? "csv"
    : file.name.toLowerCase().endsWith(".xlsx")
      ? "xlsx"
      : null;
  if (!format) throw new Error("Tuetut muodot ovat CSV ja XLSX.");
  if (!["auto", ",", ";", "\t", "|"].includes(requestedDelimiter))
    throw new Error("Virheellinen CSV-erotin.");
  const buffer = Buffer.from(await file.arrayBuffer());
  let matrix: string[][] = [],
    rowNumbers: number[] = [],
    delimiter: string | null = null;
  if (format === "csv") {
    let content: string;
    try {
      content = new TextDecoder("utf-8", { fatal: true }).decode(buffer);
    } catch {
      throw new Error("Tallenna CSV UTF-8-merkistöllä.");
    }
    const decode = (candidate: string) =>
      parse(content, {
        delimiter: candidate,
        bom: true,
        skip_empty_lines: true,
        trim: false,
        max_record_size: 500_000,
        to: 25_002,
        info: true,
      }) as unknown as { record: string[]; info: { lines: number } }[];
    if (requestedDelimiter === "auto") {
      const candidates = [",", ";", "\t", "|"].flatMap((candidate) => {
        try {
          const result = decode(candidate);
          return result[0]?.record.length > 1 ? [{ candidate, result }] : [];
        } catch {
          return [];
        }
      });
      if (candidates.length !== 1)
        throw new Error(
          "CSV-erotinta ei voitu tunnistaa yksiselitteisesti. Valitse erotin ja tarkista rivien rakenne.",
        );
      delimiter = candidates[0].candidate;
      matrix = candidates[0].result.map((r) => r.record);
      rowNumbers = candidates[0].result.map((r) => r.info.lines);
    } else {
      delimiter = requestedDelimiter;
      try {
        const result = decode(delimiter);
        matrix = result.map((r) => r.record);
        rowNumbers = result.map((r) => r.info.lines);
      } catch {
        throw new Error(
          "CSV-rivien sarakemäärät tai lainausmerkit ovat virheellisiä. Tarkista erotin ja lähdetiedosto.",
        );
      }
    }
  } else {
    validateCatalogueZip(buffer);
    const workbook = new ExcelJS.Workbook();
    try {
      await workbook.xlsx.load(
        buffer as unknown as Parameters<typeof workbook.xlsx.load>[0],
      );
    } catch {
      throw new Error(
        "XLSX-tiedostoa ei voitu lukea. Tallenna tiedosto uudelleen Excelistä.",
      );
    }
    if (workbook.worksheets.length !== 1)
      throw new Error(
        "Valitse tuontiin yksi laskentataulukko. Tallenna se erilliseen XLSX-tiedostoon.",
      );
    const sheet = workbook.worksheets[0];
    const rowCount = sheet.rowCount,
      columnCount = sheet.columnCount;
    if (
      rowCount > 25_001 ||
      columnCount > 100 ||
      rowCount * columnCount > 250_100
    )
      throw new Error("XLSX ylittää 25 000 tuotteen tai 100 sarakkeen rajan.");
    for (let r = 1; r <= rowCount; r++) {
      const values: string[] = [];
      for (let c = 1; c <= columnCount; c++) {
        const cell = sheet.getCell(r, c);
        if (
          cell.type === ExcelJS.ValueType.Formula ||
          cell.type === ExcelJS.ValueType.Error
        )
          throw new Error(
            `Rivi ${r}: korvaa kaavat ja Excel-virheet arvoilla ennen tuontia.`,
          );
        values.push(cell.text);
      }
      if (r === 1 || values.some((v) => v.trim())) {
        matrix.push(values);
        rowNumbers.push(r);
      }
    }
  }
  const normalize = (value: string) =>
    value.toLowerCase().replace(/[^a-z0-9åäö]/g, "");
  const headers = (matrix.shift() ?? []).map((h) => h.trim());
  rowNumbers.shift();
  if (
    !headers.length ||
    headers.length > 100 ||
    headers.some((h) => !h || h.length > 200) ||
    new Set(headers.map(normalize)).size !== headers.length
  )
    throw new Error(
      "Otsikoiden on oltava yksilöllisiä ja täytettyjä (enintään 100 saraketta).",
    );
  if (!matrix.length || matrix.length > 25_000)
    throw new Error("Katalogissa tulee olla 1–25 000 tuotetta.");
  if (matrix.length * headers.length > 250_000)
    throw new Error(
      "Katalogi ylittää 250 000 solun käsittelyrajan. Poista tarpeettomat sarakkeet.",
    );
  if (
    matrix.some(
      (row) =>
        row.length !== headers.length || row.some((v) => v.length > 5000),
    )
  )
    throw new Error("Tiedoston sarakerakenne tai solun pituus ylittää rajat.");
  // Shared XLSX strings can expand into a very large logical catalogue even
  // when the ZIP and cell count are small. Bound JSON before downstream RPCs.
  let logicalBytes = Buffer.byteLength(JSON.stringify(headers));
  for (const row of matrix) {
    logicalBytes += Buffer.byteLength(JSON.stringify(row));
    if (logicalBytes > 10 * 1024 * 1024)
      throw new Error(
        "Katalogin purettu tietosisältö ylittää 10 MB rajan. Poista tarpeettomat sarakkeet tai jaa tiedosto osiin.",
      );
  }
  return {
    headers,
    rows: matrix,
    rowNumbers,
    format,
    delimiter,
    hash: createHash("sha256").update(buffer).digest("hex"),
  };
}

export function mapCatalogueTable(
  table: CatalogueTable,
  mapping: CatalogueMapping,
  authoritativeSkuKeys?: string[],
): { rows: CatalogueImportRow[]; issues: CatalogueIssue[] } {
  validateCatalogueMapping(table.headers, mapping);
  const rows: CatalogueImportRow[] = [],
    issues: CatalogueIssue[] = [],
    seen = new Map<string, number>();
  for (const [index, source] of table.rows.entries()) {
    const row = table.rowNumbers[index];
    const value = (field: CatalogueField) =>
      mapping[field]
        ? source[table.headers.indexOf(mapping[field]!)].trim()
        : "";
    const issue = (field: CatalogueField, reason: string, correction: string) =>
      issues.push({
        row,
        column: mapping[field] ?? CATALOGUE_FIELDS[field].label,
        value: mapping[field]
          ? source[table.headers.indexOf(mapping[field]!)]
          : "",
        reason,
        correction,
      });
    const sku = value("sku"),
      name = value("name"),
      key = authoritativeSkuKeys?.[index] ?? catalogueSkuKey(sku);
    if (!sku)
      issue("sku", "SKU puuttuu.", "Täytä tuotteen yksilöllinen tunniste.");
    if (!name) issue("name", "Tuotenimi puuttuu.", "Täytä tuotenimi.");
    if (seen.has(key))
      issue(
        "sku",
        `SKU on jo rivillä ${seen.get(key)} (kirjainkoko ei erota tunnisteita).`,
        "Poista duplikaatti tai korjaa SKU.",
      );
    else if (sku) seen.set(key, row);
    const number = (field: "unitPrice" | "stockQuantity") => {
      try {
        return parseCatalogueNumber(value(field));
      } catch (error) {
        issue(
          field,
          error instanceof Error ? error.message : "Virheellinen luku.",
          "Korjaa lähdetiedosto. Esim. 1234,56; tyhjä = puuttuva, 0 = nolla.",
        );
        return null;
      }
    };
    rows.push({
      sku,
      name,
      manufacturer: value("manufacturer") || null,
      manufacturerPartNumber: value("manufacturerPartNumber") || null,
      unit: value("unit") || "pcs",
      unitPrice: number("unitPrice"),
      stockQuantity: number("stockQuantity"),
      stockQuantityProvided: Boolean(mapping.stockQuantity),
    });
  }
  return { rows, issues };
}
