import { randomInt } from "node:crypto";
import type { IntegrationResult } from "../../settings";
import type { CpanelWhmConfig, ServiceWithProduct } from "../types";
import type { ProvisioningProvider } from "./types";
import {
  CpanelWhmApiError,
  createCpanelWhmClient,
} from "./cpanel-whm-client";

const provider = "cpanel-whm";

function toIntegrationError(error: unknown): IntegrationResult<{ reference?: string }> {
  const message =
    error instanceof CpanelWhmApiError
      ? error.message
      : error instanceof Error
        ? error.message
        : "CPANEL_WHM_ERROR";

  return { ok: false, provider, error: message };
}

function generatePassword(length = 16) {
  const chars = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789!@#$%";
  // Real credential now (stored + shown to the customer): crypto RNG.
  return Array.from({ length }, () => chars[randomInt(chars.length)]).join("");
}

function resolveAccountUsername(service: ServiceWithProduct) {
  if (service.username?.trim()) {
    return service.username.trim().toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 16);
  }

  const base = (service.domain || service.label || service.id)
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
    .slice(0, 12);

  return base || `klea${service.id.slice(-6)}`;
}

function resolveDomain(service: ServiceWithProduct) {
  if (service.domain?.trim()) {
    return service.domain.trim().toLowerCase();
  }

  const host = service.product?.sku || service.label || "example.com";
  return host.includes(".") ? host.toLowerCase() : `${host}.kleacore.local`;
}

function resolvePlan(service: ServiceWithProduct, config: CpanelWhmConfig) {
  return service.product?.sku?.trim() || config.defaultPlan;
}

function skippedResult(): IntegrationResult<{ reference?: string }> {
  return { ok: false, skipped: true, provider, error: "SERVER_ACTION_NOT_SUPPORTED" };
}

export function createCpanelWhmProvider(config: CpanelWhmConfig): ProvisioningProvider {
  const client = createCpanelWhmClient(config);

  return {
    name: provider,
    createService: async (service) => {
      try {
        const username = resolveAccountUsername(service);
        const password = generatePassword();
        const response = await client.createAccount({
          username,
          domain: resolveDomain(service),
          plan: resolvePlan(service, config),
          contactemail: service.customer?.email || "noreply@kleacore.com",
          password,
        });

        return {
          ok: true,
          provider,
          reference: username,
          data: { reference: username, password },
        };
      } catch (error) {
        return toIntegrationError(error);
      }
    },
    suspendService: async (service, reason) => {
      try {
        const username = service.username || service.serverName;
        if (!username) {
          return { ok: false, provider, error: "CPANEL_USERNAME_MISSING" };
        }

        await client.suspendAccount(username, reason);
        return { ok: true, provider, reference: username };
      } catch (error) {
        return toIntegrationError(error);
      }
    },
    unsuspendService: async (service) => {
      try {
        const username = service.username || service.serverName;
        if (!username) {
          return { ok: false, provider, error: "CPANEL_USERNAME_MISSING" };
        }

        await client.unsuspendAccount(username);
        return { ok: true, provider, reference: username };
      } catch (error) {
        return toIntegrationError(error);
      }
    },
    terminateService: async (service) => {
      try {
        const username = service.username || service.serverName;
        if (!username) {
          return { ok: false, provider, error: "CPANEL_USERNAME_MISSING" };
        }

        await client.terminateAccount(username);
        return { ok: true, provider, reference: username };
      } catch (error) {
        return toIntegrationError(error);
      }
    },
    changeServicePlan: async (service, newPlan) => {
      try {
        const username = service.username || service.serverName;
        if (!username) {
          return { ok: false, provider, error: "CPANEL_USERNAME_MISSING" };
        }

        await client.changePackage(username, newPlan);
        return { ok: true, provider, reference: username };
      } catch (error) {
        return toIntegrationError(error);
      }
    },
    runServerAction: async () => skippedResult(),
    healthCheck: async () => {
      try {
        await client.testConnection();
        return { ok: true, provider, data: { status: "ok" } };
      } catch (error) {
        return {
          ...toIntegrationError(error),
          data: { status: "error" },
        };
      }
    },
  };
}