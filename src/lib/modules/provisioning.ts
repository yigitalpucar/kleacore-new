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
