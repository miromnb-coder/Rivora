import { PDFDocument } from "pdf-lib";

type QuoteDocumentLine = {
  line_number: number;
  sku_snapshot: string | null;
  description_snapshot: string | null;
  quantity: number | string;
  unit: string | null;
  unit_price: number | string;
  discount_percent: number | string | null;
  line_total: number | string;
};

export type QuoteDocumentData = {
  quoteId: string;
  quoteNumber: string;
  status: string;
  currency: string;
  createdAt: string;
  validUntil: string | null;
  customerReference: string | null;
  notes: string | null;
  taxRate: number;
  recipientName: string | null;
  recipientEmail: string | null;
  customerName: string;
  rfqReference: string | null;
  sellerName: string;
  sellerBusinessId: string | null;
  sellerAddress: string;
  sellerEmail: string | null;
  sellerPhone: string | null;
  logoBytes: Uint8Array | null;
  logoMime: string | null;
  lines: QuoteDocumentLine[];
};

function singleRelation<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

export async function loadQuoteDocumentData(
  supabase: any,
  quoteId: string
): Promise<QuoteDocumentData | null> {
  const { data: quote } = await supabase
    .from("quotes")
    .select("id, organization_id, quote_number, status, currency, created_at, valid_until, customer_reference, notes, tax_rate, recipient_name, recipient_email, customers(name), rfqs(reference), organizations(name,business_id,address_line1,address_line2,postal_code,city,country,email,phone,logo_path)")
    .eq("id", quoteId)
    .maybeSingle();

  if (!quote) return null;

  const { data: lines } = await supabase
    .from("quote_lines")
    .select("line_number, sku_snapshot, description_snapshot, quantity, unit, unit_price, discount_percent, line_total")
    .eq("quote_id", quoteId)
    .order("line_number");

  const customer = singleRelation<{ name?: string }>(quote.customers);
  const rfq = singleRelation<{ reference?: string }>(quote.rfqs);
  const organization = singleRelation<{
    name?: string;
    business_id?: string | null;
    address_line1?: string | null;
    address_line2?: string | null;
    postal_code?: string | null;
    city?: string | null;
    country?: string | null;
    email?: string | null;
    phone?: string | null;
    logo_path?: string | null;
  }>(quote.organizations);

  let logoBytes: Uint8Array | null = null;
  let logoMime: string | null = null;
  if (organization?.logo_path) {
    const { data: logo } = await supabase.storage
      .from("workspace-assets")
      .download(organization.logo_path);
    if (logo) {
      logoBytes = new Uint8Array(await logo.arrayBuffer());
      logoMime = logo.type || (organization.logo_path.toLowerCase().endsWith(".png") ? "image/png" : "image/jpeg");
    }
  }

  return {
    quoteId: quote.id,
    quoteNumber: quote.quote_number || "Quote",
    status: quote.status,
    currency: quote.currency || "EUR",
    createdAt: quote.created_at,
    validUntil: quote.valid_until,
    customerReference: quote.customer_reference,
    notes: quote.notes,
    taxRate: Number(quote.tax_rate ?? 0),
    recipientName: quote.recipient_name,
    recipientEmail: quote.recipient_email,
    customerName: customer?.name || "Customer",
    rfqReference: rfq?.reference || null,
    sellerName: organization?.name || "Averomira",
    sellerBusinessId: organization?.business_id || null,
    sellerAddress: [
      organization?.address_line1,
      organization?.address_line2,
      [organization?.postal_code, organization?.city].filter(Boolean).join(" "),
      organization?.country,
    ].filter(Boolean).join(", "),
    sellerEmail: organization?.email || null,
    sellerPhone: organization?.phone || null,
    logoBytes,
    logoMime,
    lines: lines ?? [],
  };
}

const CP1252: Record<number, number> = {
  0x20ac: 0x80,
  0x201a: 0x82,
  0x0192: 0x83,
  0x201e: 0x84,
  0x2026: 0x85,
  0x2020: 0x86,
  0x2021: 0x87,
  0x02c6: 0x88,
  0x2030: 0x89,
  0x0160: 0x8a,
  0x2039: 0x8b,
  0x0152: 0x8c,
  0x017d: 0x8e,
  0x2018: 0x91,
  0x2019: 0x92,
  0x201c: 0x93,
  0x201d: 0x94,
  0x2022: 0x95,
  0x2013: 0x96,
  0x2014: 0x97,
  0x02dc: 0x98,
  0x2122: 0x99,
  0x0161: 0x9a,
  0x203a: 0x9b,
  0x0153: 0x9c,
  0x017e: 0x9e,
  0x0178: 0x9f,
};

function textHex(value: string) {
  const bytes: number[] = [];
  for (const char of value.normalize("NFC")) {
    const code = char.codePointAt(0) ?? 63;
    if (code >= 32 && code <= 255) bytes.push(code);
    else if (CP1252[code] != null) bytes.push(CP1252[code]);
    else bytes.push(63);
  }
  return bytes.map((byte) => byte.toString(16).padStart(2, "0")).join("").toUpperCase();
}

function pdfText(
  value: string,
  x: number,
  y: number,
  size = 10,
  font: "F1" | "F2" = "F1",
  gray = 0.12
) {
  return `BT /${font} ${size} Tf ${gray} g 1 0 0 1 ${x.toFixed(2)} ${y.toFixed(2)} Tm <${textHex(value)}> Tj ET\n`;
}

function line(x1: number, y1: number, x2: number, y2: number, gray = 0.86, width = 0.6) {
  return `${gray} G ${width} w ${x1.toFixed(2)} ${y1.toFixed(2)} m ${x2.toFixed(2)} ${y2.toFixed(2)} l S\n`;
}

function fillRect(x: number, y: number, w: number, h: number, gray: number) {
  return `${gray} g ${x.toFixed(2)} ${y.toFixed(2)} ${w.toFixed(2)} ${h.toFixed(2)} re f\n`;
}

function wrapText(value: string, maxChars: number, maxLines = 2) {
  const clean = value.replace(/\s+/g, " ").trim();
  if (!clean) return [""];
  const words = clean.split(" ");
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (next.length <= maxChars) {
      current = next;
      continue;
    }
    if (current) lines.push(current);
    current = word;
    if (lines.length >= maxLines - 1) break;
  }

  if (lines.length < maxLines && current) lines.push(current);

  const consumed = lines.join(" ").length;
  if (clean.length > consumed && lines.length) {
    const last = lines.length - 1;
    lines[last] = `${lines[last].slice(0, Math.max(0, maxChars - 3))}...`;
  }

  return lines.slice(0, maxLines);
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("en-FI", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function money(value: number, currency: string) {
  return `${formatNumber(value)} ${currency}`;
}

function dateLabel(value: string | null) {
  if (!value) return "Not set";
  const date = value.includes("T") ? new Date(value) : new Date(`${value}T12:00:00Z`);
  return new Intl.DateTimeFormat("fi-FI", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: "UTC",
  }).format(date);
}

function buildPageHeader(data: QuoteDocumentData, continuation: boolean) {
  let content = "";
  const sellerX = data.logoBytes ? 132 : 44;

  content += pdfText(data.sellerName, sellerX, 796, 18, "F2", 0.07);
  const sellerMeta = [
    data.sellerBusinessId ? `Business ID ${data.sellerBusinessId}` : "",
    data.sellerEmail || "",
    data.sellerPhone || "",
  ].filter(Boolean).join(" | ");

  if (data.sellerAddress) {
    wrapText(data.sellerAddress, 62, 2).forEach((value, index) => {
      content += pdfText(value, sellerX, 780 - index * 10, 7.3, "F1", 0.36);
    });
  }
  if (sellerMeta) content += pdfText(sellerMeta, sellerX, 758, 7.3, "F1", 0.36);

  content += pdfText("QUOTE", 471, 798, 16, "F2", 0.08);
  content += pdfText(data.quoteNumber, 471, 779, 9, "F1", 0.28);
  content += line(44, 742, 551, 742, 0.80, 0.8);

  if (continuation) {
    content += pdfText(`${data.quoteNumber} - continued`, 44, 714, 10, "F2", 0.18);
    return { content, tableY: 684 };
  }

  content += pdfText("QUOTE DETAILS", 44, 716, 7, "F2", 0.48);
  content += pdfText("Quote date", 44, 694, 7, "F2", 0.50);
  content += pdfText(dateLabel(data.createdAt), 44, 678, 10, "F1", 0.14);
  content += pdfText("Valid until", 180, 694, 7, "F2", 0.50);
  content += pdfText(dateLabel(data.validUntil), 180, 678, 10, "F1", 0.14);
  content += pdfText("Reference", 316, 694, 7, "F2", 0.50);
  content += pdfText(data.customerReference || data.rfqReference || "-", 316, 678, 10, "F1", 0.14);

  content += fillRect(44, 593, 507, 64, 0.965);
  content += pdfText("CUSTOMER", 56, 640, 7, "F2", 0.48);
  content += pdfText(data.customerName, 56, 619, 12, "F2", 0.09);
  if (data.recipientName) content += pdfText(data.recipientName, 300, 621, 8.5, "F1", 0.30);
  if (data.recipientEmail) content += pdfText(data.recipientEmail, 300, 606, 8.5, "F1", 0.30);

  if (!["approved", "sent"].includes(data.status)) {
    content += fillRect(424, 669, 127, 25, 0.93);
    content += pdfText("DRAFT - NOT APPROVED", 434, 678, 8, "F2", 0.34);
  }

  return { content, tableY: 557 };
}

function tableHeader(y: number) {
  let content = fillRect(44, y - 4, 507, 25, 0.92);
  content += pdfText("ITEM", 50, y + 4, 7, "F2", 0.30);
  content += pdfText("DESCRIPTION", 175, y + 4, 7, "F2", 0.30);
  content += pdfText("QTY", 354, y + 4, 7, "F2", 0.30);
  content += pdfText("UNIT PRICE", 398, y + 4, 7, "F2", 0.30);
  content += pdfText("DISC.", 463, y + 4, 7, "F2", 0.30);
  content += pdfText("TOTAL", 505, y + 4, 7, "F2", 0.30);
  return content;
}

function buildPdfObjects(pageStreams: string[]) {
  const pageCount = pageStreams.length;
  const objects: string[] = [];
  const kids: string[] = [];

  objects[1] = "<< /Type /Catalog /Pages 2 0 R >>";
  objects[3] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>";
  objects[4] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>";

  for (let index = 0; index < pageCount; index += 1) {
    const pageObj = 5 + index * 2;
    const contentObj = pageObj + 1;
    kids.push(`${pageObj} 0 R`);
    objects[pageObj] =
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${contentObj} 0 R >>`;
    const stream = pageStreams[index];
    const length = Buffer.byteLength(stream, "latin1");
    objects[contentObj] = `<< /Length ${length} >>\nstream\n${stream}endstream`;
  }

  objects[2] = `<< /Type /Pages /Kids [${kids.join(" ")}] /Count ${pageCount} >>`;

  let pdf = "%PDF-1.4\n%AVEROMIRA\n";
  const offsets: number[] = [0];

  for (let i = 1; i < objects.length; i += 1) {
    const body = objects[i];
    if (!body) continue;
    offsets[i] = Buffer.byteLength(pdf, "latin1");
    pdf += `${i} 0 obj\n${body}\nendobj\n`;
  }

  const xrefOffset = Buffer.byteLength(pdf, "latin1");
  const objectCount = objects.length;
  pdf += `xref\n0 ${objectCount}\n`;
  pdf += "0000000000 65535 f \n";

  for (let i = 1; i < objectCount; i += 1) {
    const offset = offsets[i] ?? 0;
    pdf += `${String(offset).padStart(10, "0")} 00000 n \n`;
  }

  pdf += `trailer\n<< /Size ${objectCount} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;
  return Buffer.from(pdf, "latin1");
}

function renderBaseQuotePdf(data: QuoteDocumentData) {
  const pages: string[] = [];
  let page = "";
  let y = 0;
  let continuation = false;

  const startPage = () => {
    const header = buildPageHeader(data, continuation);
    page = header.content + tableHeader(header.tableY);
    y = header.tableY - 28;
    continuation = true;
  };

  const finishPage = () => {
    pages.push(page);
    page = "";
  };

  startPage();

  for (const lineItem of data.lines) {
    if (y < 132) {
      finishPage();
      startPage();
    }

    const quantity = Number(lineItem.quantity);
    const unitPrice = Number(lineItem.unit_price);
    const discount = Number(lineItem.discount_percent ?? 0);
    const total = Number(lineItem.line_total);
    const skuLines = wrapText(
      lineItem.sku_snapshot || `Line ${lineItem.line_number}`,
      22,
      2,
    );
    const descriptions = wrapText(lineItem.description_snapshot || "Product", 30, 2);

    page += line(44, y + 11, 551, y + 11, 0.90, 0.45);
    skuLines.forEach((sku, index) => {
      page += pdfText(sku, 50, y - 5 - index * 11, 8.1, "F2", 0.13);
    });
    descriptions.forEach((description, index) => {
      page += pdfText(description, 175, y - 5 - index * 11, 8.1, "F1", 0.18);
    });
    page += pdfText(`${quantity} ${lineItem.unit || ""}`.trim(), 354, y - 7, 8.2, "F1", 0.18);
    page += pdfText(money(unitPrice, data.currency), 398, y - 7, 7.9, "F1", 0.18);
    page += pdfText(discount > 0 ? `${formatNumber(discount)}%` : "-", 463, y - 7, 7.9, "F1", 0.18);
    page += pdfText(money(total, data.currency), 505, y - 7, 7.9, "F2", 0.12);
    y -= 48;
  }

  const subtotal = data.lines.reduce((sum, item) => sum + Number(item.line_total), 0);
  const tax = subtotal * (data.taxRate / 100);
  const grandTotal = subtotal + tax;

  if (y < 230) {
    finishPage();
    startPage();
  }

  page += fillRect(340, y - 82, 211, 92, 0.97);
  page += line(340, y + 10, 551, y + 10, 0.78, 0.8);
  page += pdfText("Subtotal", 356, y - 11, 8.5, "F1", 0.34);
  page += pdfText(money(subtotal, data.currency), 474, y - 11, 8.8, "F2", 0.12);
  page += pdfText(`VAT ${formatNumber(data.taxRate)}%`, 356, y - 31, 8.5, "F1", 0.34);
  page += pdfText(money(tax, data.currency), 474, y - 31, 8.8, "F2", 0.12);
  page += line(356, y - 43, 535, y - 43, 0.83, 0.6);
  page += pdfText("TOTAL", 356, y - 66, 10, "F2", 0.08);
  page += pdfText(money(grandTotal, data.currency), 464, y - 66, 10.5, "F2", 0.08);

  if (data.notes) {
    const noteLines = wrapText(data.notes, 84, 5);
    const noteY = y - 105;
    page += pdfText("NOTES", 44, noteY, 7, "F2", 0.48);
    noteLines.forEach((note, index) => {
      page += pdfText(note, 44, noteY - 18 - index * 12, 8.5, "F1", 0.22);
    });
  }

  finishPage();

  const totalPages = pages.length;
  const finalized = pages.map((content, index) => {
    let footer = line(44, 46, 551, 46, 0.87, 0.45);
    const identity = [
      data.sellerName,
      data.sellerBusinessId ? `Business ID ${data.sellerBusinessId}` : "",
      data.sellerEmail || "",
    ].filter(Boolean).join(" | ");
    footer += pdfText(identity, 44, 28, 7.1, "F1", 0.48);
    footer += pdfText(`Page ${index + 1} / ${totalPages}`, 500, 28, 7.1, "F1", 0.48);
    return content + footer;
  });

  return buildPdfObjects(finalized);
}

export async function renderQuotePdf(data: QuoteDocumentData) {
  const base = renderBaseQuotePdf(data);
  if (!data.logoBytes || !data.logoMime) return base;

  try {
    const document = await PDFDocument.load(base);
    const image = data.logoMime.includes("png")
      ? await document.embedPng(data.logoBytes)
      : await document.embedJpg(data.logoBytes);
    const firstPage = document.getPages()[0];
    const natural = image.scale(1);
    const scale = Math.min(76 / natural.width, 34 / natural.height, 1);
    firstPage.drawImage(image, {
      x: 44,
      y: 776,
      width: natural.width * scale,
      height: natural.height * scale,
    });
    return Buffer.from(await document.save());
  } catch {
    return base;
  }
}
export function quotePdfFilename(quoteNumber: string) {
  const safe = quoteNumber.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "");
  return `${safe || "quote"}.pdf`;
}
