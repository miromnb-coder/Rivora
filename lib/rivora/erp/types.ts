export type ErpProvider = "business_central" | "custom" | "none";

export type ErpConfigurationStatus = {
  configured: boolean;
  workspaceMatches: boolean;
  missing: string[];
  environment: string | null;
  companyId: string | null;
};

export type ErpEntityType = "customer" | "product";

export type ErpMappingSuggestion = {
  entityType: ErpEntityType;
  localEntityId: string;
  externalId: string;
  externalNumber: string;
  displayName: string | null;
  confidence: number;
  matchMethod: string;
  metadata: Record<string, unknown>;
};

export type ErpMappingLookupInput = {
  workspaceId: string;
  customer: {
    id: string;
    name: string;
    externalId?: string | null;
  };
  products: Array<{
    id: string;
    sku: string;
    name: string;
    manufacturerPartNumber?: string | null;
    unit?: string | null;
  }>;
};

export type ErpValidatedMapping = {
  externalId: string;
  externalNumber: string;
  displayName: string | null;
  metadata: Record<string, unknown>;
};

export type ErpSalesOrderLine = {
  lineNumber: number;
  externalItemNumber: string;
  description: string;
  quantity: number;
  unit: string;
  unitPrice: number;
};

export type ErpSalesOrderInput = {
  workspaceId: string;
  customerNumber: string;
  customerPoNumber: string;
  orderDate: string;
  currency: string;
  lines: ErpSalesOrderLine[];
};

export type ErpCreateResult =
  | {
      status: "created";
      externalOrderId: string;
      externalOrderNumber: string | null;
      summary: Record<string, unknown>;
    }
  | {
      status: "existing";
      externalOrderId: string;
      externalOrderNumber: string | null;
      summary: Record<string, unknown>;
    }
  | {
      status: "partial";
      externalOrderId: string;
      externalOrderNumber: string | null;
      error: string;
      summary: Record<string, unknown>;
    };

export type ErpMappingRecord = {
  externalId?: string | null;
  externalNumber?: string | null;
  metadata?: Record<string, unknown> | null;
} | null | undefined;

export interface ErpAdapter {
  provider: Exclude<ErpProvider, "custom" | "none">;
  displayName: string;

  getConfigurationStatus(workspaceId: string): ErpConfigurationStatus;

  isMappingVerified(mapping: ErpMappingRecord): boolean;

  suggestMappings(input: ErpMappingLookupInput): Promise<ErpMappingSuggestion[]>;

  validateManualMapping(input: {
    workspaceId: string;
    entityType: ErpEntityType;
    externalNumber: string;
    localUnit?: string | null;
  }): Promise<ErpValidatedMapping>;

  sanitizeSalesOrderRequest(input: ErpSalesOrderInput): Record<string, unknown>;

  createSalesOrder(input: ErpSalesOrderInput): Promise<ErpCreateResult>;
}
