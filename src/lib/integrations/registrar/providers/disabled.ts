import { disabledResult as integrationDisabledResult } from "../../helpers";
import type { IntegrationResult } from "../../settings";
import type { DomainAvailabilityData } from "../types";
import type { RegistrarProvider } from "./types";

const NOT_CONFIGURED = "REGISTRAR_NOT_CONFIGURED";

export function createDisabledRegistrarProvider(provider = "disabled"): RegistrarProvider {
  return {
    name: provider,
    registerDomain: async () => integrationDisabledResult(provider, NOT_CONFIGURED),
    renewDomain: async () => integrationDisabledResult(provider, NOT_CONFIGURED),
    updateNameservers: async () => integrationDisabledResult(provider, NOT_CONFIGURED),
    updateDnsRecords: async () => integrationDisabledResult(provider, NOT_CONFIGURED),
    transferDomain: async () => integrationDisabledResult(provider, NOT_CONFIGURED),
    checkDomainAvailability: async (domain) =>
      skippedWithData<DomainAvailabilityData>(provider, NOT_CONFIGURED, {
        domain,
        available: false,
      }),
    healthCheck: async () => integrationDisabledResult(provider, NOT_CONFIGURED),
  };
}

function skippedWithData<T>(
  provider: string,
  error: string,
  data: T
): IntegrationResult<T> {
  return {
    ...integrationDisabledResult<T>(provider, error),
    data,
  };
}