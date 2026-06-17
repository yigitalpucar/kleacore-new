import { getRegistrarConfig, isGriConfigured, isGriProvider } from "./config";
import { createDisabledRegistrarProvider } from "./providers/disabled";
import { createGriRegistrarProvider } from "./providers/gri";
import { createHttpRegistrarProvider } from "./providers/http";
import type { RegistrarProvider } from "./providers/types";
import type {
  DnsRecordInput,
  DomainAvailabilityData,
  NameserverInput,
  RegisterDomainInput,
  RenewDomainInput,
  TransferInput,
} from "./types";

const HTTP_PROVIDERS = new Set(["http", "generic-http"]);

export async function getRegistrarProvider(): Promise<RegistrarProvider> {
  const config = await getRegistrarConfig();

  if (!config.enabled || config.provider === "disabled") {
    return createDisabledRegistrarProvider(config.provider);
  }

  if (isGriProvider(config)) {
    if (!isGriConfigured(config)) {
      return createDisabledRegistrarProvider("gri");
    }
    return createGriRegistrarProvider(config);
  }

  if (!config.apiUrl) {
    return createDisabledRegistrarProvider(config.provider);
  }

  if (HTTP_PROVIDERS.has(config.provider)) {
    return createHttpRegistrarProvider(config);
  }

  return createHttpRegistrarProvider(config);
}

export async function registerDomainWithRegistrar(input: RegisterDomainInput) {
  const provider = await getRegistrarProvider();
  return provider.registerDomain(input);
}

export async function renewDomainWithRegistrar(input: RenewDomainInput) {
  const provider = await getRegistrarProvider();
  return provider.renewDomain(input);
}

export async function updateRegistrarNameservers(input: NameserverInput) {
  const provider = await getRegistrarProvider();
  return provider.updateNameservers(input);
}

export async function updateRegistrarDnsRecords(input: DnsRecordInput) {
  const provider = await getRegistrarProvider();
  return provider.updateDnsRecords(input);
}

export async function transferDomainWithRegistrar(input: TransferInput) {
  const provider = await getRegistrarProvider();
  return provider.transferDomain(input);
}

export async function checkDomainAvailability(domain: string) {
  const provider = await getRegistrarProvider();
  return provider.checkDomainAvailability(domain);
}

export async function checkDomainsAvailability(domains: string[]) {
  const provider = await getRegistrarProvider();

  if (provider.checkDomainsAvailability) {
    return provider.checkDomainsAvailability(domains);
  }

  const results: DomainAvailabilityData[] = [];
  for (const domain of domains) {
    const result = await provider.checkDomainAvailability(domain);
    if (!result.ok || !result.data) {
      return result as { ok: false; error?: string; provider?: string };
    }
    results.push(result.data);
  }

  return { ok: true, provider: provider.name, data: results };
}

export async function syncRegistrarTldPricing() {
  const provider = await getRegistrarProvider();
  if (!provider.fetchTldPricing) {
    return { ok: false, error: "REGISTRAR_PRICING_NOT_SUPPORTED" };
  }
  return provider.fetchTldPricing();
}

export type {
  DnsRecordInput,
  DomainAvailabilityData,
  GriTldPricingRow,
  NameserverInput,
  RegisterDomainInput,
  RenewDomainInput,
  TransferInput,
} from "./types";
export type { RegistrarProvider } from "./providers/types";