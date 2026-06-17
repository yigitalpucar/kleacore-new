import type { IntegrationResult } from "../../settings";
import type { ServerAction, ServiceWithProduct } from "../types";

export interface ProvisioningProvider {
  readonly name: string;
  createService(
    service: ServiceWithProduct
  ): Promise<IntegrationResult<{ reference?: string }>>;
  suspendService(
    service: ServiceWithProduct,
    reason?: string
  ): Promise<IntegrationResult<{ reference?: string }>>;
  unsuspendService(
    service: ServiceWithProduct
  ): Promise<IntegrationResult<{ reference?: string }>>;
  terminateService(
    service: ServiceWithProduct
  ): Promise<IntegrationResult<{ reference?: string }>>;
  changeServicePlan(
    service: ServiceWithProduct,
    newPlan: string
  ): Promise<IntegrationResult<{ reference?: string }>>;
  runServerAction(
    service: ServiceWithProduct,
    action: ServerAction
  ): Promise<IntegrationResult<{ reference?: string }>>;
  healthCheck(): Promise<IntegrationResult<{ status: string }>>;
}