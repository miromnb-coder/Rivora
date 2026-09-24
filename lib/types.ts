export type Product = {
  id: string;
  sku: string;
  manufacturer: string;
  name: string;
  unit: string;
  unitPrice: number;
  stock: number;
};

export type MatchCandidate = {
  productId: string;
  confidence: number;
  method: "customer_memory" | "exact_sku" | "catalogue" | "ai_suggestion";
};

export type RfqLine = {
  id: string;
  lineNumber: number;
  customerSku: string;
  description: string;
  quantity: number;
  unit: string;
  candidates: MatchCandidate[];
  selectedProductId: string | null;
};

export type Rfq = {
  id: string;
  reference: string;
  customer: string;
  receivedAt: string;
  source: "PDF" | "Excel" | "Email";
  lines: RfqLine[];
};
