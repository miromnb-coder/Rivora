export type BusinessCentralConfigStatus = {
  configured: boolean;
  workspaceMatches: boolean;
  missing: string[];
  environment: string | null;
  companyId: string | null;
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

export function getBusinessCentralConfigurationStatus(
  workspaceId: string,
): BusinessCentralConfigStatus {
  const config = {
    workspaceId: value("BUSINESS_CENTRAL_WORKSPACE_ID"),
    tenantId: value("BUSINESS_CENTRAL_TENANT_ID"),
    clientId: value("BUSINESS_CENTRAL_CLIENT_ID"),
    clientSecret: value("BUSINESS_CENTRAL_CLIENT_SECRET"),
    environment: value("BUSINESS_CENTRAL_ENVIRONMENT"),
    companyId: value("BUSINESS_CENTRAL_COMPANY_ID"),
  };

  const missing = Object.entries(config)
    .filter(([, entry]) => !entry)
    .map(([key]) => key);

  return {
    configured: missing.length === 0 && config.workspaceId === workspaceId,
    workspaceMatches: Boolean(config.workspaceId) && config.workspaceId === workspaceId,
    missing,
    environment: config.environment || null,
    companyId: config.companyId || null,
  };
}

function requireConfig(workspaceId: string): BusinessCentralConfig {
  const config = {
    workspaceId: value("BUSINESS_CENTRAL_WORKSPACE_ID"),
    tenantId: value("BUSINESS_CENTRAL_TENANT_ID"),
    clientId: value("BUSINESS_CENTRAL_CLIENT_ID"),
    clientSecret: value("BUSINESS_CENTRAL_CLIENT_SECRET"),
    environment: value("BUSINESS_CENTRAL_ENVIRONMENT"),
    companyId: value("BUSINESS_CENTRAL_COMPANY_ID"),
  };

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

  if (config.workspaceId !== workspaceId) {
    throw new Error("Business Central configuration is not assigned to this workspace.");
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

export async function createBusinessCentralSalesOrder(
  input: BusinessCentralSalesOrderInput,
): Promise<BusinessCentralCreateResult> {
  if (!input.lines.length) throw new Error("Sales order draft has no lines.");
  if (!input.customerNumber.trim()) throw new Error("Business Central customer number is required.");

  const config = requireConfig(input.workspaceId);
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
  if (customer.blocked && customer.blocked.trim()) {
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
