import { getSettingMap, isEnabled } from "../settings";
import type { CpanelWhmConfig, ProvisioningConfig, VpsVdsConfig } from "./types";

export async function getCpanelWhmConfig(): Promise<CpanelWhmConfig> {
  const settings = await getSettingMap([
    { key: "cpanel_enabled", env: "CPANEL_ENABLED", fallback: "false" },
    { key: "cpanel_host", env: "CPANEL_HOST" },
    { key: "cpanel_port", env: "CPANEL_PORT", fallback: "2087" },
    { key: "cpanel_username", env: "CPANEL_USERNAME" },
    { key: "cpanel_api_token", env: "CPANEL_API_TOKEN" },
    { key: "cpanel_default_plan", env: "CPANEL_DEFAULT_PLAN", fallback: "default" },
    { key: "cpanel_use_ssl", env: "CPANEL_USE_SSL", fallback: "true" },
  ]);

  return {
    enabled: isEnabled(settings.cpanel_enabled),
    host: settings.cpanel_host,
    port: Number(settings.cpanel_port || 2087),
    username: settings.cpanel_username,
    apiToken: settings.cpanel_api_token,
    defaultPlan: settings.cpanel_default_plan || "default",
    useSsl: isEnabled(settings.cpanel_use_ssl ?? "true"),
  };
}

export async function getVpsVdsConfig(): Promise<VpsVdsConfig> {
  const settings = await getSettingMap([
    { key: "vps_vds_enabled", env: "VPS_VDS_ENABLED", fallback: "false" },
    { key: "vps_vds_provider", env: "VPS_VDS_PROVIDER", fallback: "disabled" },
    { key: "vps_vds_api_url", env: "VPS_VDS_API_URL" },
    { key: "vps_vds_api_key", env: "VPS_VDS_API_KEY" },
    { key: "vps_vds_api_username", env: "VPS_VDS_API_USERNAME" },
    { key: "vps_vds_api_password", env: "VPS_VDS_API_PASSWORD" },
    { key: "provisioning_enabled" },
    { key: "provisioning_provider", fallback: "disabled" },
    { key: "provisioning_api_url" },
    { key: "provisioning_api_key" },
  ]);

  const legacyEnabled = isEnabled(settings.provisioning_enabled);
  const legacyProvider = settings.provisioning_provider || "disabled";
  const hasDedicatedConfig =
    isEnabled(settings.vps_vds_enabled) && settings.vps_vds_provider !== "disabled";

  if (hasDedicatedConfig) {
    return {
      enabled: true,
      provider: settings.vps_vds_provider || "virtualizor",
      apiUrl: settings.vps_vds_api_url,
      apiKey: settings.vps_vds_api_key,
      apiUsername: settings.vps_vds_api_username,
      apiPassword: settings.vps_vds_api_password,
    };
  }

  if (legacyEnabled && legacyProvider !== "disabled") {
    return {
      enabled: true,
      provider: legacyProvider === "generic-http" ? "generic-http" : legacyProvider,
      apiUrl: settings.provisioning_api_url,
      apiKey: settings.provisioning_api_key,
      apiUsername: "",
      apiPassword: "",
    };
  }

  return {
    enabled: false,
    provider: "disabled",
    apiUrl: settings.vps_vds_api_url,
    apiKey: settings.vps_vds_api_key,
    apiUsername: settings.vps_vds_api_username,
    apiPassword: settings.vps_vds_api_password,
  };
}

export function isCpanelWhmConfigured(config: CpanelWhmConfig) {
  return Boolean(config.enabled && config.host && config.username && config.apiToken);
}

export function isVpsVdsConfigured(config: VpsVdsConfig) {
  if (!config.enabled || config.provider === "disabled") {
    return false;
  }

  if (config.provider === "virtualizor") {
    return Boolean(config.apiUrl && config.apiKey && config.apiPassword);
  }

  return Boolean(config.apiUrl);
}

/** @deprecated Legacy generic config — use getCpanelWhmConfig / getVpsVdsConfig */
export async function getProvisioningConfig(): Promise<ProvisioningConfig> {
  const vps = await getVpsVdsConfig();
  return {
    enabled: vps.enabled,
    provider: vps.provider,
    apiUrl: vps.apiUrl,
    apiKey: vps.apiKey,
  };
}