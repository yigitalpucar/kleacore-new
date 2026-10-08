/**
 * Bridges between the new per-instance ServerModule contract and the
 * existing ProvisioningProvider interface, so every current caller
 * (retry-queue, admin service actions, suspend cron, refunds, plan change,
 * customer power buttons) works unchanged for module-bound services.
 */
import { db } from "@/lib/db";
import type { IntegrationResult } from "@/lib/integrations/settings";
import type { ProvisioningProvider } from "@/lib/integrations/provisioning/providers/types";
import type { ServerAction, ServiceWithProduct } from "@/lib/integrations/provisioning/types";
import { releaseIp } from "@/lib/ipam";
import { createLogger } from "@/lib/logger";
import type { OperationResult, ServerAccountContext, ServerModule } from "./contracts";
import { parseProductOptions } from "./product-options";
import { createServiceModuleState } from "./service-state";
import type { AnyModuleManifest, ResolvedModuleInstance } from "./types";

const log = createLogger("modules.server-bridge");

export interface ServerBinding {
  manifest: AnyModuleManifest;
  instance: ResolvedModuleInstance;
  module: ServerModule;
  /**
   * moduleId of the instance the service's *current* product is bound to
   * (null = unbound). Used to refuse plan changes across module types.
   */
  productModuleId?: string | null;
}

export function buildServerContext<TOptions>(
  instance: Pick<ResolvedModuleInstance, "id" | "label" | "moduleId">,
  service: ServiceWithProduct,
  options: TOptions
): ServerAccountContext<TOptions> {
  return {
    instance: { id: instance.id, label: instance.label, moduleId: instance.moduleId },
    service: {
      id: service.id,
      label: service.label,
      domain: service.domain,
      username: service.username,
      remoteId: service.remoteId ?? null,
      ipAddress: service.ipAddress,
      customer: service.customer
        ? {
            id: service.customer.id,
            email: service.customer.email,
            name: service.customer.name,
            surname: service.customer.surname,
          }
        : null,
      product: {
        id: service.product?.id ?? service.productId,
        sku: service.product?.sku ?? "",
        name: service.product?.name ?? service.label,
        categorySlug: service.product?.category?.slug ?? "",
      },
    },
    options,
  };
}

function withProvider<T>(result: IntegrationResult<T>, moduleId: string): IntegrationResult<T> {
  return { ...result, provider: result.provider ?? moduleId };
}

/**
 * ProvisioningProvider over a bound ServerModule. On createAccount success
 * the service records the instance + remote id (and IP / username when the
 * module returns them); on terminate the service's IPs go back to the pool.
 */
export function createModuleProvisioningProvider(binding: ServerBinding): ProvisioningProvider {
  const { manifest, instance, module } = binding;
  const moduleId = manifest.id;

  function contextFor(service: ServiceWithProduct): ServerAccountContext | IntegrationResult<never> {
    const parsed = parseProductOptions(manifest, service.product?.moduleOptions);
    if (!parsed.success) return { ok: false, provider: moduleId, error: parsed.error };
    return { ...buildServerContext(instance, service, parsed.data), state: createServiceModuleState(service.id, moduleId) };
  }

  function isError(value: ServerAccountContext | IntegrationResult<never>): value is IntegrationResult<never> {
    return "ok" in value;
  }

  async function run(
    service: ServiceWithProduct,
    operation: (ctx: ServerAccountContext) => Promise<OperationResult>
  ): Promise<IntegrationResult<{ reference?: string }>> {
    const ctx = contextFor(service);
    if (isError(ctx)) return ctx;
    try {
      return withProvider(await operation(ctx), moduleId);
    } catch (error) {
      // Contract says modules don't throw; keep callers safe if one does.
      return { ok: false, provider: moduleId, error: error instanceof Error ? error.message : "MODULE_ERROR" };
    }
  }

  return {
    name: moduleId,
    async createService(service) {
      const ctx = contextFor(service);
      if (isError(ctx)) return ctx;
      let result;
      try {
        result = await module.createAccount(ctx);
      } catch (error) {
        return { ok: false, provider: moduleId, error: error instanceof Error ? error.message : "MODULE_ERROR" };
      }
      if (!result.ok || !result.data?.remoteId) {
        return { ok: false, skipped: result.skipped, provider: moduleId, error: result.error ?? "MODULE_REMOTE_ID_MISSING" };
      }

      const created = result.data;
      await db.service.update({
        where: { id: service.id },
        data: {
          moduleInstanceId: instance.id,
          remoteId: created.remoteId,
          ...(created.ipAddress ? { ipAddress: created.ipAddress } : {}),
          ...(created.username && !service.username ? { username: created.username } : {}),
        },
      });

      // The password goes back to createRemoteService, which stores it encrypted.
      return {
        ok: true,
        provider: moduleId,
        reference: created.remoteId,
        data: { reference: created.remoteId, ...(created.password ? { password: created.password } : {}) },
      };
    },
    suspendService: (service, reason) => run(service, (ctx) => module.suspend(ctx, reason)),
    unsuspendService: (service) => run(service, (ctx) => module.unsuspend(ctx)),
    async terminateService(service) {
      const result = await run(service, (ctx) => module.terminate(ctx));
      if (result.ok && !result.skipped) {
        try {
          const released = await releaseIp(service.id);
          if (released.length) log.info("released service IPs", { serviceId: service.id, released });
        } catch (error) {
          log.error("IP release after terminate failed", { serviceId: service.id, error });
        }
      }
      return result;
    },
    async changeServicePlan(service) {
      if (binding.productModuleId && binding.productModuleId !== moduleId) {
        return { ok: false, provider: moduleId, error: `MODULE_MISMATCH: ${moduleId} → ${binding.productModuleId}` };
      }
      return run(service, (ctx) => module.changePackage(ctx));
    },
    async runServerAction(service, action: ServerAction) {
      if (!module.powerAction) {
        return { ok: false, skipped: true, provider: moduleId, error: "SERVER_ACTION_NOT_SUPPORTED" };
      }
      return run(service, (ctx) => module.powerAction!(ctx, action));
    },
    async healthCheck() {
      const health = await manifest.healthCheck(instance);
      return {
        ok: health.ok,
        provider: moduleId,
        error: health.ok ? undefined : health.message,
        data: { status: health.ok ? "ok" : "error" },
      };
    },
  };
}
