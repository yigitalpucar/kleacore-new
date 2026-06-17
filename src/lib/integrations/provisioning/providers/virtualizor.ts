import type { IntegrationResult } from "../../settings";
import type { ServerAction, ServiceWithProduct, VpsVdsConfig } from "../types";
import type { ProvisioningProvider } from "./types";
import {
  createVirtualizorClient,
  VirtualizorApiError,
} from "./virtualizor-client";

const provider = "virtualizor";

function toIntegrationError(error: unknown): IntegrationResult<{ reference?: string }> {
  const message =
    error instanceof VirtualizorApiError
      ? error.message
      : error instanceof Error
        ? error.message
        : "VIRTUALIZOR_ERROR";

  return { ok: false, provider, error: message };
}

function generatePassword(length = 16) {
  const chars = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789";
  return Array.from({ length }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}

function resolveHostname(service: ServiceWithProduct) {
  if (service.domain?.trim()) {
    return service.domain.trim().toLowerCase();
  }

  const base = (service.label || service.username || service.id)
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "")
    .slice(0, 24);

  return `${base || "vps"}.kleacore.local`;
}

function resolvePlanId(service: ServiceWithProduct) {
  return service.product?.sku?.trim() || "1";
}

function resolveVpsId(service: ServiceWithProduct) {
  return service.serverName?.trim() || "";
}

const serverActionMap: Record<ServerAction, "start" | "stop" | "restart"> = {
  start: "start",
  stop: "stop",
  restart: "restart",
};

export function createVirtualizorProvider(config: VpsVdsConfig): ProvisioningProvider {
  const client = createVirtualizorClient(config);

  return {
    name: provider,
    createService: async (service) => {
      try {
        const response = await client.createVps({
          plid: resolvePlanId(service),
          hostname: resolveHostname(service),
          rootpass: generatePassword(),
          user_email: service.customer?.email || "noreply@kleacore.com",
          virt: "kvm",
        });

        const vpsid =
          response.vpsid?.toString() ||
          (typeof response.done === "object" && response.done
            ? String((response.done as { vpsid?: string | number }).vpsid ?? "")
            : "");

        const reference = vpsid || resolveHostname(service);
        return {
          ok: true,
          provider,
          reference,
          data: { reference },
        };
      } catch (error) {
        return toIntegrationError(error);
      }
    },
    suspendService: async (service) => {
      try {
        const vpsid = resolveVpsId(service);
        if (!vpsid) {
          return { ok: false, provider, error: "VPS_ID_MISSING" };
        }

        await client.manageVps(vpsid, "suspend");
        return { ok: true, provider, reference: vpsid };
      } catch (error) {
        return toIntegrationError(error);
      }
    },
    unsuspendService: async (service) => {
      try {
        const vpsid = resolveVpsId(service);
        if (!vpsid) {
          return { ok: false, provider, error: "VPS_ID_MISSING" };
        }

        await client.manageVps(vpsid, "unsuspend");
        return { ok: true, provider, reference: vpsid };
      } catch (error) {
        return toIntegrationError(error);
      }
    },
    terminateService: async (service) => {
      try {
        const vpsid = resolveVpsId(service);
        if (!vpsid) {
          return { ok: false, provider, error: "VPS_ID_MISSING" };
        }

        await client.deleteVps(vpsid);
        return { ok: true, provider, reference: vpsid };
      } catch (error) {
        return toIntegrationError(error);
      }
    },
    changeServicePlan: async () => ({
      ok: false,
      skipped: true,
      provider,
      error: "SERVER_ACTION_NOT_SUPPORTED",
    }),
    runServerAction: async (service, action) => {
      try {
        const vpsid = resolveVpsId(service);
        if (!vpsid) {
          return { ok: false, provider, error: "VPS_ID_MISSING" };
        }

        await client.manageVps(vpsid, serverActionMap[action]);
        return { ok: true, provider, reference: vpsid };
      } catch (error) {
        return toIntegrationError(error);
      }
    },
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