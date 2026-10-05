import { businessCentralAdapter } from "./business-central-adapter";
import type { ErpAdapter, ErpProvider } from "./types";

const adapters: Partial<Record<ErpProvider, ErpAdapter>> = {
  business_central: businessCentralAdapter,
};

export function getErpAdapter(provider: ErpProvider | string | null | undefined) {
  if (!provider) return null;
  return adapters[provider as ErpProvider] ?? null;
}

export function requireErpAdapter(
  provider: ErpProvider | string | null | undefined,
): ErpAdapter {
  const adapter = getErpAdapter(provider);
  if (!adapter) {
    throw new Error("No native ERP adapter is available for the selected workspace ERP.");
  }
  return adapter;
}

export type {
  ErpAdapter,
  ErpConfigurationStatus,
  ErpCreateResult,
  ErpEntityType,
  ErpMappingLookupInput,
  ErpMappingRecord,
  ErpMappingSuggestion,
  ErpProvider,
  ErpSalesOrderInput,
  ErpSalesOrderLine,
  ErpValidatedMapping,
} from "./types";
