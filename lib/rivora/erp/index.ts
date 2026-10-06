import { businessCentralAdapter } from "./business-central-adapter.ts";
import { getErpProviderCapability } from "./providers.ts";
import type {
  ErpAdapter,
  ErpProvider,
  NativeErpProvider,
} from "./types.ts";

const adapters: Partial<Record<NativeErpProvider, ErpAdapter>> = {
  business_central: businessCentralAdapter,
};

export function getErpAdapter(provider: ErpProvider | null | undefined) {
  const capability = getErpProviderCapability(provider);
  if (!capability.hasNativeAdapter || capability.availability !== "native") {
    return null;
  }
  return adapters[capability.key as NativeErpProvider] ?? null;
}

export function requireErpAdapter(
  provider: ErpProvider | null | undefined,
): ErpAdapter {
  const adapter = getErpAdapter(provider);
  if (!adapter) {
    throw new Error("No native ERP adapter is available for the selected workspace ERP.");
  }
  return adapter;
}

export {
  ERP_WORKSPACE_SELECTIONS,
  getErpProviderCapability,
  isSelectableErpProvider,
} from "./providers.ts";

export type {
  ErpAdapter,
  ErpConfigurationStatus,
  ErpCreateResult,
  ErpEntityType,
  ErpMappingLookupInput,
  ErpMappingRecord,
  ErpMappingSuggestion,
  ErpProvider,
  ErpProviderAvailability,
  ErpProviderCapability,
  ErpSalesOrderInput,
  ErpSalesOrderLine,
  ErpValidatedMapping,
  ErpWorkspaceSelection,
  NativeErpProvider,
} from "./types.ts";
