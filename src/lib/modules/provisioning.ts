/**
 * Provisioning entry points of the module layer, used by
 * src/lib/integrations/provisioning/index.ts (lazily imported, so the legacy
 * path never loads the module registry) and src/lib/provisioning/*.
 */
import type { Prisma } from "@prisma/client";
import type { db } from "@/lib/db";
import type { ProvisioningProvider } from "@/lib/integrations/provisioning/providers/types";
import type { ServiceWithProduct } from "@/lib/integrations/provisioning/types";
import { getServerBindingForService, resolveInstanceForProduct } from "./instances";
import { createModuleProvisioningProvider } from "./server-bridge";

type DbClient = Prisma.TransactionClient | typeof db;

/**
 * A provider whose every call fails (ok: false, never skipped — callers
 * treat skipped as "nothing to do" and would mark the job done).
 */
export function createFailingProvisioningProvider(name: string, error: string): ProvisioningProvider {
  const fail = async () => ({ ok: false, provider: name, error });
  return {
    name,
    createService: fail,
    suspendService: fail,
    unsuspendService: fail,
    terminateService: fail,
    changeServicePlan: fail,
    runServerAction: fail,
    healthCheck: async () => ({ ok: false, provider: name, error, data: { status: "error" } }),
  };
}

/** Provider for a service bound to a module instance (service.moduleInstanceId set). */
export async function getModuleProvisioningProvider(service: ServiceWithProduct): Promise<ProvisioningProvider> {
  try {
    const binding = await getServerBindingForService(service);
    if (!binding) return createFailingProvisioningProvider("module", "MODULE_INSTANCE_NOT_SET");
    return createModuleProvisioningProvider(binding);
  } catch (error) {
    return createFailingProvisioningProvider("module", error instanceof Error ? error.message : "MODULE_RESOLVE_FAILED");
  }
}

export type ProductProvisioningPlan =
  /** Product has no binding: legacy category resolution (Settings WHM/VPS or MANUAL). */
  | { mode: "legacy" }
  /** Bound and an active instance is available: provision there. */
  | { mode: "module"; instanceId: string }
  /** Bound but no active/non-full instance: admin task (MANUAL). */
  | { mode: "manual"; reason: string };

/** How a new service of this product gets provisioned. */
export async function planProductProvisioning(
  product: { moduleInstanceId?: string | null },
  client?: DbClient
): Promise<ProductProvisioningPlan> {
  if (!product.moduleInstanceId) return { mode: "legacy" };
  const instance = await resolveInstanceForProduct(product, client);
  return instance
    ? { mode: "module", instanceId: instance.id }
    : { mode: "manual", reason: "MODULE_INSTANCE_UNAVAILABLE" };
}

/**
 * A PROVISION job for this service was given up (last retry failed, or the
 * failure is permanent). For a module-bound service that never got a remote
 * id: let the module undo its reservations (Proxmox: release IPs, flag the
 * leftover VM for the admin — never delete it), else just release the IPs.
 * Never throws; returns the released addresses.
 */
export async function abandonModuleProvisioning(serviceId: string): Promise<{ released: string[]; error?: string }> {
  const { db } = await import("@/lib/db");
  const { releaseIp } = await import("@/lib/ipam");
  try {
    const service = await db.service.findUnique({
      where: { id: serviceId },
      include: { product: { include: { category: true } }, customer: true },
    });
    if (!service?.moduleInstanceId || service.remoteId) return { released: [] };

    const binding = await getServerBindingForService(service).catch(() => null);
    if (binding?.module.abandonProvisioning) {
      const { buildServerContext } = await import("./server-bridge");
      const { parseProductOptions } = await import("./product-options");
      const { createServiceModuleState } = await import("./service-state");
      const parsed = parseProductOptions(binding.manifest, service.product?.moduleOptions);
      const ctx = {
        ...buildServerContext(binding.instance, service, parsed.success ? parsed.data : {}),
        state: createServiceModuleState(service.id, binding.manifest.id),
      };
      const result = await binding.module.abandonProvisioning(ctx);
      if (!result.ok) return { released: [], error: result.error };
      return { released: result.reference ? result.reference.split(",") : [] };
    }
    return { released: await releaseIp(serviceId) };
  } catch (error) {
    return { released: [], error: error instanceof Error ? error.message : "ABANDON_FAILED" };
  }
}
