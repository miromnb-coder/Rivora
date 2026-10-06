export type ErpProvider = string;

export type ErpWorkspaceSelection = "business_central" | "custom" | "none";
export type NativeErpProvider = "business_central";
export type ErpProviderAvailability =
  | "native"
  | "unsupported"
  | "disabled"
  | "unavailable";

export type ErpProviderCapability = {
  key: string;
  label: string;
  availability: ErpProviderAvailability;
  hasNativeAdapter: boolean;
  supportsConnection: boolean;
  supportsAutomaticExport: boolean;
};

export type ErpConfigurationStatus = {
  configured: boolean;
  workspaceMatches: boolean;
  missing: string[];
  environment: string | null;
  companyId: string | null;
  source?: "workspace" | "legacy_env" | null;
  connectionStatus?: "configured" | "verified" | "error" | "disconnected" | "legacy" | null;
  verifiedAt?: string | null;
  verifiedCompanyName?: string | null;
  lastError?: string | null;
  tenantId?: string | null;
  clientId?: string | null;
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
  external_id?: string | null;
  external_number?: string | null;
  metadata?: Record<string, unknown> | null;
} | null | undefined;

export interface ErpAdapter {
  provider: NativeErpProvider;
  displayName: string;

  getConfigurationStatus(workspaceId: string): Promise<ErpConfigurationStatus>;

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
