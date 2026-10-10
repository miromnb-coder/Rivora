// Synthetic parser resource profile, no credentials or customer files.
import ExcelJS from "exceljs";
import {
  readCatalogueFile,
  mapCatalogueTable,
} from "../lib/rivora/catalogue-file.ts";
import { suggestCatalogueMapping } from "../lib/rivora/catalogue-fields.ts";
const format = process.argv[2] ?? "csv";
const rows = Array.from({ length: 25000 }, (_, i) => [
  `SKU-${i}`,
  `Synthetic valve ${i}`,
  "1234,56",
  String(i % 100),
  "pcs",
]);
const headers = [
  "Product No.",
  "Item Description",
  "Unit Price",
  "Stock",
  "Unit",
];
let file: File;
if (format === "xlsx") {
  const workbook = new ExcelJS.Workbook();
  workbook.addWorksheet("Catalogue").addRows([headers, ...rows]);
  file = new File(
    [(await workbook.xlsx.writeBuffer()) as unknown as ArrayBuffer],
    "synthetic.xlsx",
  );
} else
  file = new File(
    [[headers, ...rows].map((r) => r.join(";")).join("\n")],
    "synthetic.csv",
  );
if (global.gc) global.gc();
const before = process.memoryUsage();
const started = performance.now();
const table = await readCatalogueFile(file);
const result = mapCatalogueTable(table, suggestCatalogueMapping(table.headers));
if (result.rows.length !== 25000 || result.issues.length)
  throw new Error("Synthetic profile failed validation");
console.log(
  JSON.stringify({
    format,
    fileBytes: file.size,
    rows: result.rows.length,
    durationMs: Math.round(performance.now() - started),
    rssBeforeMiB: Math.round(before.rss / 1024 / 1024),
    rssAfterMiB: Math.round(process.memoryUsage().rss / 1024 / 1024),
    processPeakRssMiB: Math.round(process.resourceUsage().maxRSS / 1024),
    node: process.version,
  }),
);
