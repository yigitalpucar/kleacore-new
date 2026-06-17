import type { IntegrationResult } from "./settings";
import { getCpanelWhmProvider, getVpsVdsProvider } from "./provisioning";
import { getRegistrarProvider } from "./registrar";

export interface IntegrationHealthStatus {
  registrar: IntegrationResult<{ status: string; configured: boolean }>;
  cpanel: IntegrationResult<{ status: string; configured: boolean }>;
  vpsVds: IntegrationResult<{ status: string; configured: boolean }>;
  /** @deprecated Use cpanel / vpsVds */
  provisioning: IntegrationResult<{ status: string; configured: boolean }>;
  checkedAt: string;
}

function mapHealth(
  health: IntegrationResult<{ status: string }>,
  configured: boolean
): IntegrationResult<{ status: string; configured: boolean }> {
  return {
    ...health,
    data: health.skipped
      ? { status: "disabled", configured: false }
      : {
          status: health.data?.status ?? (health.ok ? "ok" : "error"),
          configured,
        },
  };
}

export async function checkIntegrationHealth(): Promise<IntegrationHealthStatus> {
  const [registrarProvider, cpanelProvider, vpsVdsProvider] = await Promise.all([
    getRegistrarProvider(),
    getCpanelWhmProvider(),
    getVpsVdsProvider(),
  ]);

  const [registrarHealth, cpanelHealth, vpsVdsHealth] = await Promise.all([
    registrarProvider.healthCheck(),
    cpanelProvider.healthCheck(),
    vpsVdsProvider.healthCheck(),
  ]);

  const registrarConfigured = !registrarHealth.skipped;
  const cpanelConfigured = !cpanelHealth.skipped;
  const vpsVdsConfigured = !vpsVdsHealth.skipped;

  const cpanel = mapHealth(cpanelHealth, cpanelConfigured);
  const vpsVds = mapHealth(vpsVdsHealth, vpsVdsConfigured);

  return {
    registrar: mapHealth(registrarHealth, registrarConfigured),
    cpanel,
    vpsVds,
    provisioning: vpsVds,
    checkedAt: new Date().toISOString(),
  };
}