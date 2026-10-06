import type {
  ErpProviderCapability,
  ErpWorkspaceSelection,
} from "./types.ts";

const KNOWN_PROVIDER_CAPABILITIES: Record<
  ErpWorkspaceSelection,
  ErpProviderCapability
> = {
  business_central: {
    key: "business_central",
    label: "Microsoft Business Central",
    availability: "native",
    hasNativeAdapter: true,
    supportsConnection: true,
    supportsAutomaticExport: true,
  },
  custom: {
    key: "custom",
    label: "Muu ERP",
    availability: "unsupported",
    hasNativeAdapter: false,
    supportsConnection: false,
    supportsAutomaticExport: false,
  },
  none: {
    key: "none",
    label: "Ei ERP-integraatiota",
    availability: "disabled",
    hasNativeAdapter: false,
    supportsConnection: false,
    supportsAutomaticExport: false,
  },
};

export const ERP_WORKSPACE_SELECTIONS = [
  "business_central",
  "custom",
  "none",
] as const satisfies readonly ErpWorkspaceSelection[];

export function isSelectableErpProvider(
  provider: string | null | undefined,
): provider is ErpWorkspaceSelection {
  return ERP_WORKSPACE_SELECTIONS.includes(
    String(provider || "") as ErpWorkspaceSelection,
  );
}

export function getErpProviderCapability(
  provider: string | null | undefined,
): ErpProviderCapability {
  const key = String(provider || "none").trim() || "none";

  if (isSelectableErpProvider(key)) {
    return KNOWN_PROVIDER_CAPABILITIES[key];
  }

  return {
    key,
    label: key,
    availability: "unavailable",
    hasNativeAdapter: false,
    supportsConnection: false,
    supportsAutomaticExport: false,
  };
}
