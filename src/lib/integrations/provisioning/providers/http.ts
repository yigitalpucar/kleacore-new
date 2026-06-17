/**
 * Generic HTTP provisioning provider — API contract
 *
 * Base URL: configured `provisioning_api_url` (no trailing slash required)
 * Auth: `Authorization: Bearer <provisioning_api_key>` when key is set
 * Method: POST for all endpoints
 * Content-Type: application/json
 *
 * Every request body includes `provider` (configured provider id) plus endpoint fields.
 * The `service` object is the KLEACORE Service record (with optional product/customer).
 *
 * --- POST /services/create ---
 * Request:  { provider, service }
 * Response: { reference?: string, ok?: boolean }
 *
 * --- POST /services/suspend ---
 * Request:  { provider, service, reason?: string }
 * Response: { reference?: string, ok?: boolean }
 *
 * --- POST /services/unsuspend ---
 * Request:  { provider, service }
 * Response: { reference?: string, ok?: boolean }
 *
 * --- POST /services/terminate ---
 * Request:  { provider, service }
 * Response: { reference?: string, ok?: boolean }
 *
 * --- POST /servers/start | /servers/stop | /servers/restart ---
 * Request:  { provider, service, action: "start" | "stop" | "restart" }
 * Response: { reference?: string, ok?: boolean }
 *
 * --- POST /health ---
 * Request:  { provider }
 * Response: { status: "ok" | string }
 *
 * Non-2xx responses are surfaced as IntegrationResult { ok: false, error: "HTTP_<status>" }.
 */

import { postIntegrationJson, type IntegrationResult } from "../../settings";
import type { ProvisioningConfig, ServerAction, ServiceWithProduct } from "../types";
import type { ProvisioningProvider } from "./types";

type ReferencePayload = { reference?: string };
type HealthPayload = { status?: string };

export function createHttpProvisioningProvider(config: ProvisioningConfig): ProvisioningProvider {
  const provider = config.provider;

  async function post<T extends Record<string, unknown>>(
    path: string,
    body: unknown
  ): Promise<IntegrationResult<T>> {
    if (!config.apiUrl) {
      return {
        ok: false,
        skipped: true,
        provider,
        error: "PROVISIONING_NOT_CONFIGURED",
      };
    }

    const result = await postIntegrationJson<T>(config.apiUrl, path, config.apiKey ?? "", {
      provider,
      ...(body as Record<string, unknown>),
    });

    return {
      ...result,
      provider,
      reference:
        typeof result.data?.reference === "string" ? result.data.reference : undefined,
    };
  }

  return {
    name: provider,
    createService: (service) => post<ReferencePayload>("/services/create", { service }),
    suspendService: (service, reason) =>
      post<ReferencePayload>("/services/suspend", { service, reason }),
    unsuspendService: (service) => post<ReferencePayload>("/services/unsuspend", { service }),
    terminateService: (service) => post<ReferencePayload>("/services/terminate", { service }),
    changeServicePlan: (service, newPlan) =>
      post<ReferencePayload>("/services/change-plan", { service, newPlan }),
    runServerAction: (service, action) =>
      post<ReferencePayload>(`/servers/${action}`, { service, action }),
    healthCheck: async () => {
      const result = await post<HealthPayload>("/health", {});

      if (!result.ok) {
        return result as IntegrationResult<{ status: string }>;
      }

      return {
        ...result,
        data: {
          status: result.data?.status ?? "ok",
        },
      };
    },
  };
}