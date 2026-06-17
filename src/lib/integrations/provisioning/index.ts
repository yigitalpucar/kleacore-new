import {
  getCpanelWhmConfig,
  getVpsVdsConfig,
  isCpanelWhmConfigured,
  isVpsVdsConfigured,
} from "./config";
import {
  getProductCategorySlug,
  isCpanelCategory,
  isVpsVdsCategory,
} from "./categories";
import { createDisabledProvisioningProvider } from "./providers/disabled";
import { createHttpProvisioningProvider } from "./providers/http";
import { createCpanelWhmProvider } from "./providers/cpanel-whm";
import { createCpanelWhmClient } from "./providers/cpanel-whm-client";
import { createVirtualizorProvider } from "./providers/virtualizor";
import type { ProvisioningProvider } from "./providers/types";
import type { ServerAction, ServiceWithProduct } from "./types";

const HTTP_PROVIDERS = new Set(["http", "generic-http"]);

async function createCpanelProvider(): Promise<ProvisioningProvider> {
  const config = await getCpanelWhmConfig();
  if (!isCpanelWhmConfigured(config)) {
    return createDisabledProvisioningProvider("cpanel-whm");
  }
  return createCpanelWhmProvider(config);
}

async function createVpsVdsProvider(): Promise<ProvisioningProvider> {
  const config = await getVpsVdsConfig();
  if (!isVpsVdsConfigured(config)) {
    return createDisabledProvisioningProvider(config.provider || "vps-vds");
  }

  if (config.provider === "virtualizor") {
    return createVirtualizorProvider(config);
  }

  if (HTTP_PROVIDERS.has(config.provider)) {
    return createHttpProvisioningProvider({
      enabled: config.enabled,
      provider: config.provider,
      apiUrl: config.apiUrl,
      apiKey: config.apiKey,
    });
  }

  return createDisabledProvisioningProvider(config.provider);
}

export async function getProvisioningProviderForService(
  service: ServiceWithProduct
): Promise<ProvisioningProvider> {
  const categorySlug = getProductCategorySlug(service.product);

  if (isCpanelCategory(categorySlug)) {
    return createCpanelProvider();
  }

  if (isVpsVdsCategory(categorySlug)) {
    return createVpsVdsProvider();
  }

  return createDisabledProvisioningProvider("unsupported-category");
}

/** @deprecated Use getCpanelWhmProvider / getVpsVdsProvider */
export async function getProvisioningProvider(): Promise<ProvisioningProvider> {
  return createVpsVdsProvider();
}

export async function getCpanelWhmProvider(): Promise<ProvisioningProvider> {
  return createCpanelProvider();
}

export async function getCpanelWhmClient() {
  const config = await getCpanelWhmConfig();
  if (!isCpanelWhmConfigured(config)) {
    return null;
  }
  return createCpanelWhmClient(config);
}

export async function getVpsVdsProvider(): Promise<ProvisioningProvider> {
  return createVpsVdsProvider();
}

export async function createRemoteService(service: ServiceWithProduct) {
  const provider = await getProvisioningProviderForService(service);
  return provider.createService(service);
}

export async function suspendRemoteService(service: ServiceWithProduct, reason?: string) {
  const provider = await getProvisioningProviderForService(service);
  return provider.suspendService(service, reason);
}

export async function unsuspendRemoteService(service: ServiceWithProduct) {
  const provider = await getProvisioningProviderForService(service);
  return provider.unsuspendService(service);
}

export async function terminateRemoteService(service: ServiceWithProduct) {
  const provider = await getProvisioningProviderForService(service);
  return provider.terminateService(service);
}

export async function runRemoteServerAction(service: ServiceWithProduct, action: ServerAction) {
  const provider = await getProvisioningProviderForService(service);
  return provider.runServerAction(service, action);
}

export async function changeRemoteServicePlan(service: ServiceWithProduct, newPlan: string) {
  const provider = await getProvisioningProviderForService(service);
  return provider.changeServicePlan(service, newPlan);
}

export type { ProvisioningProvider } from "./providers/types";
export type { ServerAction, ServiceWithProduct } from "./types";