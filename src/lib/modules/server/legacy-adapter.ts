/**
 * ServerModule over a legacy ProvisioningProvider (frozen Virtualizor).
 * Kept free of DB/registry imports so manifests can use it without cycles.
 */
import type { ProvisioningProvider } from "@/lib/integrations/provisioning/providers/types";
import type { ServiceWithProduct } from "@/lib/integrations/provisioning/types";
import type { ServerAccountContext, ServerModule } from "../contracts";

/**
 * The other direction, for frozen legacy providers (Virtualizor): a
 * ServerModule over a ProvisioningProvider. remoteId maps to the legacy
 * `serverName`, the product SKU stays the plan.
 */
export function serverModuleFromProvisioningProvider(moduleId: string, provider: ProvisioningProvider): ServerModule {
  const toService = (ctx: ServerAccountContext): ServiceWithProduct =>
    ({
      id: ctx.service.id,
      label: ctx.service.label,
      domain: ctx.service.domain,
      username: ctx.service.username,
      serverName: ctx.service.remoteId,
      ipAddress: ctx.service.ipAddress,
      productId: ctx.service.product.id,
      product: { id: ctx.service.product.id, sku: ctx.service.product.sku, name: ctx.service.product.name },
      customer: ctx.service.customer,
    }) as unknown as ServiceWithProduct;

  return {
    moduleId,
    async createAccount(ctx) {
      const result = await provider.createService(toService(ctx));
      const remoteId = result.reference ?? result.data?.reference;
      if (!result.ok || !remoteId) return { ok: false, provider: moduleId, error: result.error ?? "MODULE_REMOTE_ID_MISSING" };
      return { ok: true, provider: moduleId, reference: remoteId, data: { remoteId } };
    },
    suspend: (ctx, reason) => provider.suspendService(toService(ctx), reason),
    unsuspend: (ctx) => provider.unsuspendService(toService(ctx)),
    terminate: (ctx) => provider.terminateService(toService(ctx)),
    changePackage: (ctx) => provider.changeServicePlan(toService(ctx), ctx.service.product.sku),
    powerAction: (ctx, action) =>
      action === "shutdown"
        ? provider.runServerAction(toService(ctx), "stop")
        : provider.runServerAction(toService(ctx), action),
  };
}
