import assert from "node:assert/strict";
import test from "node:test";
import ExcelJS from "exceljs";
import {
  parseCatalogueNumber,
  catalogueSkuKey,
} from "../lib/rivora/catalogue-validation.ts";
import {
  readCatalogueFile,
  mapCatalogueTable,
  validateCatalogueZip,
} from "../lib/rivora/catalogue-file.ts";
import {
  suggestCatalogueMapping,
  validateCatalogueMapping,
} from "../lib/rivora/catalogue-fields.ts";
import {
  toCatalogueRows,
  toRfqRows,
  toPurchaseOrderRows,
} from "../lib/rivora/imports.ts";
import { suggestCatalogueAiMapping } from "../lib/rivora/catalogue-ai.ts";
import {
  catalogueIssueSample,
  catalogueReportPage,
} from "../lib/rivora/catalogue-report.ts";

test("row errors stay below HTTP limits without changing original values", () => {
  const issues = Array.from({ length: 500 }, (_, i) => ({
    row: i + 2,
    column: "Price",
    value: "\u0000".repeat(5000),
    reason: "Invalid",
    correction: "Fix",
  }));
  const sample = catalogueIssueSample(issues);
  assert.ok(sample.length > 0 && sample.length < issues.length);
  assert.ok(Buffer.byteLength(JSON.stringify(sample)) <= 2 * 1024 * 1024);
  assert.equal(sample[0].value, issues[0].value);
});

test("paged error report preserves every Unicode value and blocks spreadsheet formulas", () => {
  const issues = Array.from({ length: 450 }, (_, i) => ({
    row: i + 2,
    column: "Price",
    value: '="' + "€".repeat(2000),
    reason: "Invalid",
    correction: "Fix",
  }));
  let offset = 0,
    csv = "",
    pages = 0;
  while (true) {
    const page = catalogueReportPage(issues, offset);
    assert.ok(Buffer.byteLength(page.csv) <= 2 * 1024 * 1024);
    csv += page.csv;
    pages++;
    if (page.nextOffset === null) break;
    assert.ok(page.nextOffset > offset);
    offset = page.nextOffset;
  }
  assert.equal(pages, 2);
  assert.equal(csv.split("Rivi;Sarake").length, 2);
  assert.equal(csv.split("€").length - 1, 450 * 2000);
  assert.ok(csv.includes('"451";"Price";"\'=""'));
});

test("error report rejects invalid offsets", () => {
  for (const offset of [-1, 1, 0.5, NaN])
    assert.throws(() => catalogueReportPage([], offset));
  assert.equal(catalogueReportPage([], 0).nextOffset, null);
});

test("repeated XLSX shared strings cannot inflate downstream JSON without a bound", async () => {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Catalogue");
  sheet.addRow(["SKU", "Name"]);
  for (let i = 0; i < 2200; i++) sheet.addRow([`S-${i}`, "x".repeat(5000)]);
  const buffer = await workbook.xlsx.writeBuffer({ useSharedStrings: true });
  await assert.rejects(
    readCatalogueFile(
      new File([buffer as unknown as BlobPart], "synthetic.xlsx"),
    ),
    /purettu tietosisältö/,
  );
});

for (const [input, expected] of [
  ["12", 12],
  ["12,34", 12.34],
  ["12.34", 12.34],
  ["0", 0],
  ["", null],
  ["  ", null],
  ["1 234,56", 1234.56],
  ["1\u00a0234,56", 1234.56],
  ["1,234.56", 1234.56],
  ["1.234,56", 1234.56],
  ["0.0001", 0.0001],
  ["1234.5678", 1234.5678],
  ["9999999999.9999", 9999999999.9999],
] as const) {
  test(`strict price accepts ${JSON.stringify(input)} as ${expected}`, () =>
    assert.equal(parseCatalogueNumber(input), expected));
}
for (const input of [
  "sovitaan",
  "abc",
  "12x34",
  "-1",
  "Infinity",
  "NaN",
  "1e3",
  "€12",
  "12%",
  "1,234",
  "1.234",
  "1,23,4",
  "1 23,45",
  "12.34567",
  "10000000000",
  "1 234.567.89",
  "+1",
]) {
  test(`strict price rejects ${JSON.stringify(input)}`, () =>
    assert.throws(() => parseCatalogueNumber(input)));
}
test("SKU lowercase identity preserves punctuation and handles Finnish letters", () => {
  assert.equal(catalogueSkuKey(" ABC-1 "), catalogueSkuKey("abc-1"));
  assert.notEqual(catalogueSkuKey("ABC-1"), catalogueSkuKey("ABC1"));
  assert.equal(catalogueSkuKey("Ä-1"), catalogueSkuKey("ä-1"));
});
test("existing catalogue entry point uses same strict validation and duplicate detection", () => {
  assert.throws(
    () => toCatalogueRows([{ SKU: "a", Name: "A", Price: "sovitaan" }]),
    /Rivi 2.*Price.*sovitaan/,
  );
  assert.throws(
    () =>
      toCatalogueRows([
        { SKU: "ABC", Name: "A" },
        { SKU: "abc", Name: "B" },
      ]),
    /rivillä 2/,
  );
});
for (const delimiter of [",", ";", "\t", "|"]) {
  test(`CSV detects ${JSON.stringify(delimiter)}, aliases and Finnish numbers`, async () => {
    const file = new File(
      [
        `Product No.${delimiter}Item Description${delimiter}Unit Price\nA${delimiter}Valve${delimiter}"1 234,56"\n`,
      ],
      "erp.csv",
    );
    const table = await readCatalogueFile(file);
    assert.equal(table.delimiter, delimiter);
    const mapping = suggestCatalogueMapping(table.headers);
    assert.equal(mapping.sku, "Product No.");
    assert.equal(mapping.name, "Item Description");
    assert.equal(mapCatalogueTable(table, mapping).rows[0].unitPrice, 1234.56);
  });
}
test("manual CSV separator and manual mapping work with unusual headers", async () => {
  const table = await readCatalogueFile(
    new File(
      ["PartRef;MyLabel;CostX;Unused\nabc;Valve;0;ignored\n"],
      "erp.csv",
    ),
    ";",
  );
  assert.deepEqual(suggestCatalogueMapping(table.headers), {});
  const result = mapCatalogueTable(table, {
    sku: "PartRef",
    name: "MyLabel",
    unitPrice: "CostX",
  });
  assert.equal(result.issues.length, 0);
  assert.equal(result.rows[0].unitPrice, 0);
});
test("missing, duplicate and unknown mapping fields cannot be accepted", () => {
  assert.throws(
    () => validateCatalogueMapping(["a", "b"], { sku: "a" }),
    /pakolliset/,
  );
  assert.throws(
    () => validateCatalogueMapping(["a", "b"], { sku: "a", name: "a" }),
    /useaan/,
  );
  assert.throws(
    () => validateCatalogueMapping(["a", "b"], { sku: "unknown", name: "b" }),
    /tuntemattoman/,
  );
});
test("CSV reports physical rows including blank lines; errors retain original text and advice", async () => {
  const table = await readCatalogueFile(
    new File(
      ["sku;name;price\n\nABC;Valve;sovitaan\nabc;Seal;12x34\n"],
      "erp.csv",
    ),
  );
  const result = mapCatalogueTable(
    table,
    suggestCatalogueMapping(table.headers),
  );
  assert.equal(result.issues[0].row, 3);
  assert.equal(result.issues[0].column, "price");
  assert.equal(result.issues[0].value, "sovitaan");
  assert.ok(result.issues[0].correction);
  assert.equal(result.issues.length, 3);
});
for (const content of [
  "sku;sku;price\na;b;1",
  "sku;name;price\na;b",
  "sku;;price\na;b;1",
  'sku;name;price\na;"unclosed;1',
]) {
  test(`CSV rejects malformed structure ${content.slice(0, 30)}`, async () =>
    assert.rejects(readCatalogueFile(new File([content], "bad.csv"))));
}
test("unsupported files, excessive size, cell and row limits are rejected", async () => {
  await assert.rejects(
    readCatalogueFile(new File(["x"], "file.pdf")),
    /CSV ja XLSX/,
  );
  await assert.rejects(
    readCatalogueFile(
      new File([new Uint8Array(10 * 1024 * 1024 + 1)], "large.csv"),
    ),
    /10 MB/,
  );
  await assert.rejects(
    readCatalogueFile(
      new File(["sku;name\na;" + "b".repeat(5001)], "cell.csv"),
    ),
    /pituus/,
  );
  await assert.rejects(
    readCatalogueFile(
      new File(["sku;name\n" + "a;b\n".repeat(25001)], "rows.csv"),
    ),
    /25 000/,
  );
  await assert.rejects(
    readCatalogueFile(
      new File([Uint8Array.from([0xff, 0xfe, 0xfd])], "encoding.csv"),
    ),
    /UTF-8/,
  );
});
async function xlsx(rows: unknown[][]) {
  const workbook = new ExcelJS.Workbook();
  workbook.addWorksheet("Catalogue").addRows(rows);
  return new File(
    [(await workbook.xlsx.writeBuffer()) as unknown as ArrayBuffer],
    "erp.xlsx",
  );
}
test("XLSX shares mapping, null and zero handling with CSV", async () => {
  const table = await readCatalogueFile(
    await xlsx([
      ["Product No.", "Item Description", "Unit Price", "Stock", "Unit"],
      ["A", "Valve", 0, 7, "pcs"],
      ["B", "Seal", null, null, "pcs"],
    ]),
  );
  const result = mapCatalogueTable(
    table,
    suggestCatalogueMapping(table.headers),
  );
  assert.equal(result.issues.length, 0);
  assert.equal(result.rows[0].unitPrice, 0);
  assert.equal(result.rows[1].unitPrice, null);
  assert.equal(result.rows[0].stockQuantity, 7);
});
test("XLSX formulas and invalid ZIPs fail closed", async () => {
  await assert.rejects(
    readCatalogueFile(
      await xlsx([
        ["sku", "name", "price"],
        ["A", "Valve", { formula: "1+1", result: 2 }],
      ]),
    ),
    /kaavat/,
  );
  assert.throws(
    () => validateCatalogueZip(Buffer.from("fake zip")),
    /pakkausrakenne/,
  );
});
test("XLSX compressed high-expansion entries are rejected before workbook load", async () => {
  const file = await xlsx([
    ["sku", "name"],
    ["A", "x".repeat(2 * 1024 * 1024)],
  ]);
  await assert.rejects(readCatalogueFile(file), /pakkaus/);
});
test("RFQ quantities and PO net prices, discounts and line totals preserve prior behavior", () => {
  assert.equal(toRfqRows([{ SKU: "A", Qty: "1 234,5" }])[0].quantity, 1234.5);
  const [po] = toPurchaseOrderRows([
    {
      SKU: "A",
      Quantity: "2",
      "Unit Price": "100",
      "Discount %": "10",
      "Line Total": "180",
    },
  ]);
  assert.equal(po.unitPrice, 90);
  assert.equal(po.discountPercent, 10);
  assert.equal(po.lineTotal, 180);
});
test("AI unavailable never disables deterministic or manual mapping", async () => {
  const previous = process.env.OPENAI_API_KEY;
  delete process.env.OPENAI_API_KEY;
  try {
    assert.ok((await suggestCatalogueAiMapping(["SKU", "Name"])).unavailable);
  } finally {
    if (previous !== undefined) process.env.OPENAI_API_KEY = previous;
  }
  assert.deepEqual(suggestCatalogueMapping(["SKU", "Name"]), {
    sku: "SKU",
    name: "Name",
  });
});
test("AI provider failure or invented headers only produce an unavailable suggestion", async () => {
  assert.ok(
    (
      await suggestCatalogueAiMapping(["SKU", "Name"], async () => {
        throw new Error("provider failed");
      })
    ).unavailable,
  );
  assert.ok(
    (
      await suggestCatalogueAiMapping(["SKU", "Name"], async () => ({
        sku: "invented",
        name: "Name",
      }))
    ).unavailable,
  );
  assert.deepEqual(
    (
      await suggestCatalogueAiMapping(["SKU", "Name"], async () => ({
        sku: "SKU",
        name: "Name",
      }))
    ).mapping,
    { sku: "SKU", name: "Name" },
  );
});
test("XLSX excessive row references and multiple worksheets are rejected in preflight", async () => {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Catalogue");
  sheet.addRow(["sku", "name"]);
  sheet.getCell("A25002").value = "outside limit";
  const buffer = Buffer.from(await workbook.xlsx.writeBuffer());
  assert.throws(() => validateCatalogueZip(buffer), /25 000/);
  workbook.addWorksheet("Other").addRow(["sku", "name"]);
  const multiBuffer = Buffer.from(await workbook.xlsx.writeBuffer());
  assert.throws(
    () => validateCatalogueZip(multiBuffer),
    /yksi laskentataulukko|25 000/,
  );
});
