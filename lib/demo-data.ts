import type { Product, Rfq } from "@/lib/types";

export const products: Product[] = [
  { id: "p1", sku: "GRU-98561418", manufacturer: "Grundfos", name: "ALPHA2 25-60 circulation pump", unit: "pcs", unitPrice: 287.4, stock: 42 },
  { id: "p2", sku: "SKF-6205-2RSH", manufacturer: "SKF", name: "Deep groove ball bearing 6205-2RSH", unit: "pcs", unitPrice: 18.9, stock: 156 },
  { id: "p3", sku: "SKF-6205-ZZ", manufacturer: "SKF", name: "Deep groove ball bearing 6205-ZZ", unit: "pcs", unitPrice: 17.2, stock: 61 },
  { id: "p4", sku: "DAN-013G0013", manufacturer: "Danfoss", name: "RA-N valve body 1/2\"", unit: "pcs", unitPrice: 31.7, stock: 8 },
  { id: "p5", sku: "UPO-1070546", manufacturer: "Uponor", name: "S-Press PLUS elbow 25 mm", unit: "pcs", unitPrice: 12.35, stock: 230 },
];

export const demoRfq: Rfq = {
  id: "rfq-1048",
  reference: "RFQ-2026-1048",
  customer: "Nordic Process Service Oy",
  receivedAt: "24 Sep 2026, 14:32",
  source: "PDF",
  lines: [
    { id: "l1", lineNumber: 1, customerSku: "PUMP-37A", description: "circulation pump", quantity: 10, unit: "pcs", candidates: [{ productId: "p1", confidence: 99, method: "customer_memory" }], selectedProductId: "p1" },
    { id: "l2", lineNumber: 2, customerSku: "6205 sealed", description: "bearing 6205 sealed both sides", quantity: 25, unit: "pcs", candidates: [{ productId: "p2", confidence: 78, method: "catalogue" }, { productId: "p3", confidence: 57, method: "ai_suggestion" }], selectedProductId: "p2" },
    { id: "l3", lineNumber: 3, customerSku: "VALVE-X12", description: "radiator valve 1/2 inch", quantity: 12, unit: "pcs", candidates: [{ productId: "p4", confidence: 96, method: "customer_memory" }], selectedProductId: "p4" },
    { id: "l4", lineNumber: 4, customerSku: "ELBOW 25", description: "press elbow 25 mm", quantity: 40, unit: "pcs", candidates: [{ productId: "p5", confidence: 86, method: "catalogue" }], selectedProductId: "p5" },
    { id: "l5", lineNumber: 5, customerSku: "OLD-991-A", description: "replacement pump same as last shutdown", quantity: 2, unit: "pcs", candidates: [], selectedProductId: null },
  ],
};

export const inbox = [
  { id: "rfq-1048", reference: "RFQ-2026-1048", customer: "Nordic Process Service Oy", source: "PDF", received: "8 min ago", lines: 5, status: "Needs review", confidence: 84 },
  { id: "rfq-1047", reference: "RFQ-44182", customer: "Tampere Automation Oy", source: "Excel", received: "31 min ago", lines: 18, status: "Ready", confidence: 96 },
  { id: "rfq-1046", reference: "Request 24/09", customer: "Polar Maintenance AB", source: "Email", received: "1 h ago", lines: 9, status: "Needs review", confidence: 73 },
  { id: "rfq-1045", reference: "Tender 8831", customer: "West Coast Industry Oy", source: "PDF", received: "3 h ago", lines: 34, status: "Ready", confidence: 94 },
];

export const memories = [
  { customer: "Nordic Process Service Oy", alias: "PUMP-37A", product: "GRU-98561418", description: "Grundfos ALPHA2 25-60", source: "Verified", uses: 18 },
  { customer: "Nordic Process Service Oy", alias: "VALVE-X12", product: "DAN-013G0013", description: "Danfoss RA-N valve body 1/2\"", source: "Verified", uses: 11 },
  { customer: "Tampere Automation Oy", alias: "BRG-6205-S", product: "SKF-6205-2RSH", description: "SKF 6205-2RSH", source: "Imported", uses: 7 },
  { customer: "West Coast Industry Oy", alias: "UPO-EL25", product: "UPO-1070546", description: "Uponor S-Press PLUS elbow 25", source: "Verified", uses: 12 },
];
