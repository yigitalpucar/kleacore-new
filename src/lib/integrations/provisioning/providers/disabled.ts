import { disabledResult } from "../../helpers";
import type { ProvisioningProvider } from "./types";

const NOT_CONFIGURED = "PROVISIONING_NOT_CONFIGURED";

export function createDisabledProvisioningProvider(provider = "disabled"): ProvisioningProvider {
  return {
    name: provider,
    createService: async () => disabledResult(provider, NOT_CONFIGURED),
    suspendService: async () => disabledResult(provider, NOT_CONFIGURED),
    unsuspendService: async () => disabledResult(provider, NOT_CONFIGURED),
    terminateService: async () => disabledResult(provider, NOT_CONFIGURED),
    changeServicePlan: async () => disabledResult(provider, NOT_CONFIGURED),
    runServerAction: async () => disabledResult(provider, NOT_CONFIGURED),
    healthCheck: async () => disabledResult(provider, NOT_CONFIGURED),
  };
}