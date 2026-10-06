import {
  getStoredErpConnection,
  getStoredErpConnectionSecret,
} from "./connections.ts";

export type BusinessCentralConfigStatus = {
  configured: boolean;
  workspaceMatches: boolean;
  missing: string[];
  environment: string | null;
  companyId: string | null;
  source: "workspace" | "legacy_env" | null;
  connectionStatus: "configured" | "verified" | "error" | "disconnected" | "legacy" | null;
  verifiedAt: string | null;
  verifiedCompanyName: string | null;
  lastError: string | null;
  tenantId: string | null;
  clientId: string | null;
};

export type BusinessCentralSalesOrderLine = {
  lineNumber: number;
  externalItemNumber: string;
  description: string;
  quantity: number;
  unit: string;
  unitPrice: number;
};

export type BusinessCentralSalesOrderInput = {
  workspaceId: string;
  customerNumber: string;
  customerPoNumber: string;
  orderDate: string;
  currency: string;
  lines: BusinessCentralSalesOrderLine[];
};

export type BusinessCentralCreateResult =
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

type BusinessCentralConfig = {
  workspaceId: string;
  tenantId: string;
  clientId: string;
  clientSecret: string;
  environment: string;
  companyId: string;
};

type ODataCollection<T> = { value?: T[] };

type BcCompany = {
  id: string;
  name?: string;
  displayName?: string;
};

type BcCustomer = {
  id: string;
  number: string;
  displayName?: string;
  blocked?: string;
};

type BcItem = {
  id: string;
  number: string;
  displayName?: string;
  blocked?: boolean;
  baseUnitOfMeasureCode?: string;
};

type BcSalesOrder = {
  id: string;
  number?: string;
  status?: string;
  externalDocumentNumber?: string;
  customerNumber?: string;
};

const SCOPE = "https://api.businesscentral.dynamics.com/.default";

function value(name: string) {
  return process.env[name]?.trim() || "";
}

function textConfig(
  configuration: Record<string, unknown>,
  key: string,
) {
  const raw = configuration[key];
  return typeof raw === "string" ? raw.trim() : "";
}

function legacyConfig(workspaceId: string): BusinessCentralConfig | null {
  const config: BusinessCentralConfig = {
    workspaceId: value("BUSINESS_CENTRAL_WORKSPACE_ID"),
    tenantId: value("BUSINESS_CENTRAL_TENANT_ID"),
    clientId: value("BUSINESS_CENTRAL_CLIENT_ID"),
    clientSecret: value("BUSINESS_CENTRAL_CLIENT_SECRET"),
    environment: value("BUSINESS_CENTRAL_ENVIRONMENT"),
    companyId: value("BUSINESS_CENTRAL_COMPANY_ID"),
  };

  if (config.workspaceId !== workspaceId) return null;
  return config;
}

export async function getBusinessCentralConfigurationStatus(
  workspaceId: string,
): Promise<BusinessCentralConfigStatus> {
  const stored = await getStoredErpConnection(workspaceId, "business_central");

  if (stored) {
    const tenantId = textConfig(stored.configuration, "tenantId");
    const clientId = textConfig(stored.configuration, "clientId");
    const environment = textConfig(stored.configuration, "environment");
    const companyId = textConfig(stored.configuration, "companyId");
    const missing = [
      !tenantId ? "tenantId" : null,
      !clientId ? "clientId" : null,
      !environment ? "environment" : null,
      !companyId ? "companyId" : null,
      !stored.hasSecret ? "clientSecret" : null,
    ].filter(Boolean) as string[];

    return {
      configured:
        stored.status === "verified" &&
        missing.length === 0,
      workspaceMatches: true,
      missing,
      environment: environment || null,
      companyId: companyId || null,
      source: "workspace",
      connectionStatus: stored.status,
      verifiedAt: stored.verifiedAt,
      verifiedCompanyName: stored.verifiedCompanyName,
      lastError: stored.lastError,
      tenantId: tenantId || null,
      clientId: clientId || null,
    };
  }

  const legacy = legacyConfig(workspaceId);
  if (legacy) {
    const missing = Object.entries(legacy)
      .filter(([, entry]) => !entry)
      .map(([key]) => key);

    return {
      configured: missing.length === 0,
      workspaceMatches: true,
      missing,
      environment: legacy.environment || null,
      companyId: legacy.companyId || null,
      source: "legacy_env",
      connectionStatus: "legacy",
      verifiedAt: null,
      verifiedCompanyName: null,
      lastError: null,
      tenantId: legacy.tenantId || null,
      clientId: legacy.clientId || null,
    };
  }

  return {
    configured: false,
    workspaceMatches: false,
    missing: ["workspaceId", "tenantId", "clientId", "clientSecret", "environment", "companyId"],
    environment: null,
    companyId: null,
    source: null,
    connectionStatus: null,
    verifiedAt: null,
    verifiedCompanyName: null,
    lastError: null,
    tenantId: null,
    clientId: null,
  };
}

async function resolveStoredConfig(
  workspaceId: string,
  allowUnverified: boolean,
): Promise<BusinessCentralConfig | null> {
  const stored = await getStoredErpConnection(workspaceId, "business_central");
  if (!stored) return null;
  if (stored.status === "disconnected") {
    throw new Error("Business Central connection is disconnected for this workspace.");
  }
  if (!allowUnverified && stored.status !== "verified") {
    throw new Error("Business Central connection must be verified before use.");
  }

  const tenantId = textConfig(stored.configuration, "tenantId");
  const clientId = textConfig(stored.configuration, "clientId");
  const environment = textConfig(stored.configuration, "environment");
  const companyId = textConfig(stored.configuration, "companyId");
  const clientSecret = await getStoredErpConnectionSecret(workspaceId, "business_central");

  const missing = [
    !tenantId ? "tenantId" : null,
    !clientId ? "clientId" : null,
    !clientSecret ? "clientSecret" : null,
    !environment ? "environment" : null,
    !companyId ? "companyId" : null,
  ].filter(Boolean);

  if (missing.length) {
    throw new Error(`Business Central workspace connection is incomplete. Missing: ${missing.join(", ")}`);
  }

  return {
    workspaceId,
    tenantId,
    clientId,
    clientSecret: clientSecret!,
    environment,
    companyId,
  };
}

async function requireConfig(
  workspaceId: string,
  allowUnverified = false,
): Promise<BusinessCentralConfig> {
  const stored = await resolveStoredConfig(workspaceId, allowUnverified);
  if (stored) return stored;

  const config = legacyConfig(workspaceId);
  if (!config) {
    throw new Error("Business Central is not configured for this workspace.");
  }

  const missing = Object.entries(config)
    .filter(([, entry]) => !entry)
    .map(([key]) => key);

  if (missing.length) {
    throw new Error(
      `Business Central is not configured. Missing: ${missing
        .map((key) => `BUSINESS_CENTRAL_${key.replace(/[A-Z]/g, (letter) => `_${letter}`).toUpperCase()}`)
        .join(", ")}`,
    );
  }

  return config;
}

function odataString(value: string) {
  return value.replaceAll("'", "''");
}

function unitFamily(value: string | null | undefined) {
  const unit = String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[.s_-]+/g, "");

  if (!unit) return "";
  if (["pcs", "pc", "piece", "pieces", "ea", "each", "kpl", "stk"].includes(unit)) {
    return "pcs";
  }
  if (["kg", "kilogram", "kilograms"].includes(unit)) return "kg";
  if (["g", "gram", "grams"].includes(unit)) return "g";
  if (["m", "meter", "metre", "meters", "metres"].includes(unit)) return "m";
  if (["mm", "millimeter", "millimetre", "millimeters", "millimetres"].includes(unit)) {
    return "mm";
  }
  if (["l", "ltr", "liter", "litre", "liters", "litres"].includes(unit)) return "l";
  return unit;
}

export function businessCentralUnitsCompatible(localUnit: string, bcUnitCode: string) {
  const left = unitFamily(localUnit);
  const right = unitFamily(bcUnitCode);
  return Boolean(left && right && left === right);
}

export function businessCentralCustomerIsBlocked(blocked: string | null | undefined) {
  const normalized = String(blocked ?? "").trim();
  if (!normalized) return false;

  // Business Central can serialize the blank enum member as the XML-escaped
  // space token "_x0020_". That value means "not blocked", not a real block.
  if (/^(?:_x0020_)+$/i.test(normalized)) return false;

  return true;
}

function baseUrl(config: BusinessCentralConfig) {
  const tenant = encodeURIComponent(config.tenantId);
  const environment = encodeURIComponent(config.environment);
  const company = encodeURIComponent(config.companyId);
  return `https://api.businesscentral.dynamics.com/v2.0/${tenant}/${environment}/api/v2.0/companies(${company})`;
}

async function accessToken(config: BusinessCentralConfig) {
  const response = await fetch(
    `https://login.microsoftonline.com/${encodeURIComponent(config.tenantId)}/oauth2/v2.0/token`,
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: config.clientId,
        client_secret: config.clientSecret,
        scope: SCOPE,
        grant_type: "client_credentials",
      }),
      cache: "no-store",
    },
  );

  const payload = (await response.json().catch(() => ({}))) as {
    access_token?: string;
    error_description?: string;
    error?: string;
  };

  if (!response.ok || !payload.access_token) {
    throw new Error(
      `Business Central authentication failed: ${payload.error_description || payload.error || response.status}`,
    );
  }

  return payload.access_token;
}

async function requestJson<T>({
  token,
  url,
  method = "GET",
  body,
}: {
  token: string;
  url: string;
  method?: "GET" | "POST";
  body?: unknown;
}): Promise<T> {
  const response = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store",
  });

  const payload = (await response.json().catch(() => ({}))) as Record<string, any>;

  if (!response.ok) {
    const detail =
      payload?.error?.message ||
      payload?.error_description ||
      payload?.message ||
      `HTTP ${response.status}`;
    throw new Error(`Business Central API error: ${String(detail).slice(0, 1200)}`);
  }

  return payload as T;
}

export type BusinessCentralVerificationResult = {
  companyId: string;
  companyName: string;
  environment: string;
};

export async function verifyBusinessCentralConnection(
  workspaceId: string,
): Promise<BusinessCentralVerificationResult> {
  const config = await requireConfig(workspaceId, true);
  const token = await accessToken(config);
  const root = baseUrl(config);

  const company = await requestJson<BcCompany>({
    token,
    url: `${root}?${new URLSearchParams({ "$select": "id,name,displayName" }).toString()}`,
  });

  if (!company?.id || String(company.id).toLowerCase() !== config.companyId.toLowerCase()) {
    throw new Error("Business Central company ID did not match the configured company.");
  }

  // Verify the application can read the two entity collections required by
  // Averomira mapping before marking the workspace connection as verified.
  await Promise.all([
    requestJson<ODataCollection<BcCustomer>>({
      token,
      url: `${root}/customers?${new URLSearchParams({
        "$select": "id,number",
        "$top": "1",
      }).toString()}`,
    }),
    requestJson<ODataCollection<BcItem>>({
      token,
      url: `${root}/items?${new URLSearchParams({
        "$select": "id,number",
        "$top": "1",
      }).toString()}`,
    }),
  ]);

  return {
    companyId: config.companyId,
    companyName: company.displayName || company.name || config.companyId,
    environment: config.environment,
  };
}

function collectionUrl(base: string, collection: string, filter: string, select: string) {
  const query = new URLSearchParams({
    "$filter": filter,
    "$select": select,
    "$top": "2",
  });
  return `${base}/${collection}?${query.toString()}`;
}

export function businessCentralSalesOrderHeader(input: BusinessCentralSalesOrderInput) {
  return {
    orderDate: input.orderDate,
    customerNumber: input.customerNumber,
    currencyCode: input.currency.toUpperCase(),
    externalDocumentNumber: input.customerPoNumber,
  };
}

export function businessCentralSalesOrderLinePayload(
  line: BusinessCentralSalesOrderLine,
  item: { id: string; number: string },
) {
  return {
    itemId: item.id,
    lineType: "Item",
    lineObjectNumber: item.number,
    description: line.description.slice(0, 100),
    quantity: line.quantity,
    unitPrice: line.unitPrice,
  };
}

export function sanitizedBusinessCentralRequest(input: BusinessCentralSalesOrderInput) {
  return {
    provider: "business_central",
    customerNumber: input.customerNumber,
    customerPoNumber: input.customerPoNumber,
    orderDate: input.orderDate,
    currency: input.currency,
    lineCount: input.lines.length,
    lines: input.lines.map((line) => ({
      lineNumber: line.lineNumber,
      externalItemNumber: line.externalItemNumber,
      quantity: line.quantity,
      unit: line.unit,
      unitPrice: line.unitPrice,
    })),
  };
}


export type BusinessCentralMappingSuggestion = {
  entityType: "customer" | "product";
  localEntityId: string;
  externalId: string;
  externalNumber: string;
  displayName: string | null;
  confidence: number;
  matchMethod:
    | "customer_external_id_exact"
    | "customer_name_exact"
    | "product_sku_exact"
    | "product_mpn_exact"
    | "product_name_exact";
  metadata: Record<string, unknown>;
};

export type BusinessCentralMappingLookupInput = {
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


export type BusinessCentralValidatedMapping = {
  externalId: string;
  externalNumber: string;
  displayName: string | null;
  metadata: Record<string, unknown>;
};

export function businessCentralMappingIsVerified(mapping: {
  externalId?: string | null;
  externalNumber?: string | null;
  external_id?: string | null;
  external_number?: string | null;
  metadata?: Record<string, unknown> | null;
} | null | undefined) {
  const externalId = mapping?.externalId ?? mapping?.external_id;
  const externalNumber = mapping?.externalNumber ?? mapping?.external_number;

  if (!externalId || !externalNumber) return false;
  return mapping?.metadata?.autoMatched === true || mapping?.metadata?.bcValidated === true;
}

export async function validateBusinessCentralManualMapping({
  workspaceId,
  entityType,
  externalNumber,
  localUnit,
}: {
  workspaceId: string;
  entityType: "customer" | "product";
  externalNumber: string;
  localUnit?: string | null;
}): Promise<BusinessCentralValidatedMapping> {
  const normalized = externalNumber.trim();
  if (!normalized) {
    throw new Error("Business Central number is required.");
  }
  if (normalized.length > 20) {
    throw new Error("Business Central customer and item numbers can be at most 20 characters.");
  }

  const config = await requireConfig(workspaceId);
  const token = await accessToken(config);
  const root = baseUrl(config);

  if (entityType === "customer") {
    const result = await requestJson<ODataCollection<BcCustomer>>({
      token,
      url: collectionUrl(
        root,
        "customers",
        `number eq '${odataString(normalized)}'`,
        "id,number,displayName,blocked",
      ),
    });
    const customer = result.value?.find((candidate) => candidate.number === normalized);
    if (!customer) {
      throw new Error(`Business Central customer ${normalized} was not found.`);
    }
    if (businessCentralCustomerIsBlocked(customer.blocked)) {
      throw new Error(`Business Central customer ${normalized} is blocked (${customer.blocked}).`);
    }

    return {
      externalId: customer.id,
      externalNumber: customer.number,
      displayName: customer.displayName || null,
      metadata: {
        autoMatched: false,
        bcValidated: true,
        confidence: 100,
        matchMethod: "manual_confirmation",
        businessCentralDisplayName: customer.displayName || null,
      },
    };
  }

  const result = await requestJson<ODataCollection<BcItem>>({
    token,
    url: collectionUrl(
      root,
      "items",
      `number eq '${odataString(normalized)}'`,
      "id,number,displayName,blocked,baseUnitOfMeasureCode",
    ),
  });
  const item = result.value?.find((candidate) => candidate.number === normalized);
  if (!item) {
    throw new Error(`Business Central item ${normalized} was not found.`);
  }
  if (item.blocked) {
    throw new Error(`Business Central item ${normalized} is blocked.`);
  }
  if (
    localUnit &&
    item.baseUnitOfMeasureCode &&
    !businessCentralUnitsCompatible(localUnit, item.baseUnitOfMeasureCode)
  ) {
    throw new Error(
      `Unit mismatch for Business Central item ${normalized}: Averomira uses ${localUnit}, Business Central base unit is ${item.baseUnitOfMeasureCode}.`,
    );
  }

  return {
    externalId: item.id,
    externalNumber: item.number,
    displayName: item.displayName || null,
    metadata: {
      autoMatched: false,
      bcValidated: true,
      confidence: 100,
      matchMethod: "manual_confirmation",
      businessCentralDisplayName: item.displayName || null,
      businessCentralBaseUnit: item.baseUnitOfMeasureCode || null,
    },
  };
}

async function firstCustomerMatch({
  token,
  root,
  field,
  value,
}: {
  token: string;
  root: string;
  field: "number" | "displayName";
  value: string;
}) {
  const normalized = value.trim();
  if (!normalized) return null;
  // Business Central Customer No. is Code[20]. Avoid sending an invalid
  // OData filter when a local identifier is longer; fall back to name matching.
  if (field === "number" && normalized.length > 20) return null;
  const result = await requestJson<ODataCollection<BcCustomer>>({
    token,
    url: collectionUrl(
      root,
      "customers",
      `${field} eq '${odataString(normalized)}'`,
      "id,number,displayName,blocked",
    ),
  });
  const candidates = (result.value ?? []).filter(
    (customer) => !businessCentralCustomerIsBlocked(customer.blocked),
  );
  return candidates.length === 1 ? candidates[0] : null;
}

async function firstItemMatch({
  token,
  root,
  field,
  value,
  localUnit,
}: {
  token: string;
  root: string;
  field: "number" | "displayName";
  value: string;
  localUnit?: string | null;
}) {
  const normalized = value.trim();
  if (!normalized) return null;
  // Business Central Item No. is Code[20]. Long local SKUs / MPNs are valid
  // in Averomira, but they must not be sent as an invalid No. filter.
  // In that case continue to the next safe matching strategy (MPN/name).
  if (field === "number" && normalized.length > 20) return null;
  const result = await requestJson<ODataCollection<BcItem>>({
    token,
    url: collectionUrl(
      root,
      "items",
      `${field} eq '${odataString(normalized)}'`,
      "id,number,displayName,blocked,baseUnitOfMeasureCode",
    ),
  });
  const candidates = (result.value ?? []).filter((item) => {
    if (item.blocked) return false;
    if (!localUnit || !item.baseUnitOfMeasureCode) return true;
    return businessCentralUnitsCompatible(localUnit, item.baseUnitOfMeasureCode);
  });
  return candidates.length === 1 ? candidates[0] : null;
}

export async function suggestBusinessCentralMappings(
  input: BusinessCentralMappingLookupInput,
): Promise<BusinessCentralMappingSuggestion[]> {
  const config = await requireConfig(input.workspaceId);
  const token = await accessToken(config);
  const root = baseUrl(config);
  const suggestions: BusinessCentralMappingSuggestion[] = [];

  let customer: BcCustomer | null = null;
  let customerMethod: BusinessCentralMappingSuggestion["matchMethod"] | null = null;
  let customerConfidence = 0;

  if (input.customer.externalId?.trim()) {
    customer = await firstCustomerMatch({
      token,
      root,
      field: "number",
      value: input.customer.externalId,
    });
    if (customer) {
      customerMethod = "customer_external_id_exact";
      customerConfidence = 100;
    }
  }

  if (!customer && input.customer.name.trim()) {
    customer = await firstCustomerMatch({
      token,
      root,
      field: "displayName",
      value: input.customer.name,
    });
    if (customer) {
      customerMethod = "customer_name_exact";
      customerConfidence = 96;
    }
  }

  if (customer && customerMethod) {
    suggestions.push({
      entityType: "customer",
      localEntityId: input.customer.id,
      externalId: customer.id,
      externalNumber: customer.number,
      displayName: customer.displayName || null,
      confidence: customerConfidence,
      matchMethod: customerMethod,
      metadata: {
        autoMatched: true,
        confidence: customerConfidence,
        matchMethod: customerMethod,
        businessCentralDisplayName: customer.displayName || null,
      },
    });
  }

  for (const product of input.products) {
    let item: BcItem | null = null;
    let matchMethod: BusinessCentralMappingSuggestion["matchMethod"] | null = null;
    let confidence = 0;

    if (product.sku.trim()) {
      item = await firstItemMatch({
        token,
        root,
        field: "number",
        value: product.sku,
        localUnit: product.unit,
      });
      if (item) {
        matchMethod = "product_sku_exact";
        confidence = 100;
      }
    }

    if (!item && product.manufacturerPartNumber?.trim()) {
      item = await firstItemMatch({
        token,
        root,
        field: "number",
        value: product.manufacturerPartNumber,
        localUnit: product.unit,
      });
      if (item) {
        matchMethod = "product_mpn_exact";
        confidence = 98;
      }
    }

    if (!item && product.name.trim()) {
      item = await firstItemMatch({
        token,
        root,
        field: "displayName",
        value: product.name,
        localUnit: product.unit,
      });
      if (item) {
        matchMethod = "product_name_exact";
        confidence = 96;
      }
    }

    if (!item || !matchMethod) continue;

    suggestions.push({
      entityType: "product",
      localEntityId: product.id,
      externalId: item.id,
      externalNumber: item.number,
      displayName: item.displayName || null,
      confidence,
      matchMethod,
      metadata: {
        autoMatched: true,
        confidence,
        matchMethod,
        businessCentralDisplayName: item.displayName || null,
        businessCentralBaseUnit: item.baseUnitOfMeasureCode || null,
      },
    });
  }

  return suggestions;
}

export async function createBusinessCentralSalesOrder(
  input: BusinessCentralSalesOrderInput,
): Promise<BusinessCentralCreateResult> {
  if (!input.lines.length) throw new Error("Sales order draft has no lines.");
  if (!input.customerNumber.trim()) throw new Error("Business Central customer number is required.");

  const config = await requireConfig(input.workspaceId);
  const token = await accessToken(config);
  const root = baseUrl(config);

  const customerFilter = `number eq '${odataString(input.customerNumber)}'`;
  const customers = await requestJson<ODataCollection<BcCustomer>>({
    token,
    url: collectionUrl(root, "customers", customerFilter, "id,number,displayName,blocked"),
  });
  const customer = customers.value?.[0];

  if (!customer) {
    throw new Error(`Business Central customer ${input.customerNumber} was not found.`);
  }
  if (businessCentralCustomerIsBlocked(customer.blocked)) {
    throw new Error(
      `Business Central customer ${input.customerNumber} is blocked (${customer.blocked}).`,
    );
  }

  const items = new Map<string, BcItem>();
  for (const line of input.lines) {
    if (items.has(line.externalItemNumber)) continue;
    const itemFilter = `number eq '${odataString(line.externalItemNumber)}'`;
    const result = await requestJson<ODataCollection<BcItem>>({
      token,
      url: collectionUrl(
        root,
        "items",
        itemFilter,
        "id,number,displayName,blocked,baseUnitOfMeasureCode",
      ),
    });
    const item = result.value?.[0];
    if (!item) {
      throw new Error(
        `Business Central item ${line.externalItemNumber} was not found.`,
      );
    }
    if (item.blocked) {
      throw new Error(`Business Central item ${line.externalItemNumber} is blocked.`);
    }
    if (
      item.baseUnitOfMeasureCode &&
      !businessCentralUnitsCompatible(line.unit, item.baseUnitOfMeasureCode)
    ) {
      throw new Error(
        `Unit mismatch for Business Central item ${line.externalItemNumber}: Averomira uses ${line.unit}, Business Central base unit is ${item.baseUnitOfMeasureCode}.`,
      );
    }
    items.set(line.externalItemNumber, item);
  }

  const duplicateFilter =
    `externalDocumentNumber eq '${odataString(input.customerPoNumber)}' and customerNumber eq '${odataString(input.customerNumber)}'`;
  const existing = await requestJson<ODataCollection<BcSalesOrder>>({
    token,
    url: collectionUrl(
      root,
      "salesOrders",
      duplicateFilter,
      "id,number,status,externalDocumentNumber,customerNumber",
    ),
  });

  const existingOrder = existing.value?.[0];
  if (existingOrder) {
    return {
      status: "existing",
      externalOrderId: existingOrder.id,
      externalOrderNumber: existingOrder.number || null,
      summary: {
        detectedBy: "externalDocumentNumber+customerNumber",
        businessCentralStatus: existingOrder.status || null,
      },
    };
  }

  const order = await requestJson<BcSalesOrder>({
    token,
    url: `${root}/salesOrders`,
    method: "POST",
    body: businessCentralSalesOrderHeader(input),
  });

  for (const line of input.lines) {
    const item = items.get(line.externalItemNumber);
    if (!item) {
      return {
        status: "partial",
        externalOrderId: order.id,
        externalOrderNumber: order.number || null,
        error: `Validated Business Central item missing from adapter cache: ${line.externalItemNumber}`,
        summary: { createdLines: 0, failedAtLine: line.lineNumber },
      };
    }

    try {
      await requestJson({
        token,
        url: `${root}/salesOrders(${encodeURIComponent(order.id)})/salesOrderLines`,
        method: "POST",
        body: businessCentralSalesOrderLinePayload(line, item),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Business Central line creation failed.";
      return {
        status: "partial",
        externalOrderId: order.id,
        externalOrderNumber: order.number || null,
        error: message,
        summary: {
          failedAtLine: line.lineNumber,
          failedItemNumber: line.externalItemNumber,
        },
      };
    }
  }

  return {
    status: "created",
    externalOrderId: order.id,
    externalOrderNumber: order.number || null,
    summary: {
      businessCentralStatus: order.status || "Draft",
      createdLines: input.lines.length,
    },
  };
}
