import {
  businessCentralMappingIsVerified,
  createBusinessCentralSalesOrder,
  getBusinessCentralConfigurationStatus,
  sanitizedBusinessCentralRequest,
  suggestBusinessCentralMappings,
  validateBusinessCentralManualMapping,
} from "./business-central";
import type { ErpAdapter } from "./types";

export const businessCentralAdapter: ErpAdapter = {
  provider: "business_central",
  displayName: "Microsoft Business Central",

  getConfigurationStatus(workspaceId) {
    return getBusinessCentralConfigurationStatus(workspaceId);
  },

  isMappingVerified(mapping) {
    return businessCentralMappingIsVerified(mapping);
  },

  suggestMappings(input) {
    return suggestBusinessCentralMappings(input);
  },

  validateManualMapping(input) {
    return validateBusinessCentralManualMapping(input);
  },

  sanitizeSalesOrderRequest(input) {
    return sanitizedBusinessCentralRequest(input);
  },

  createSalesOrder(input) {
    return createBusinessCentralSalesOrder(input);
  },
};
