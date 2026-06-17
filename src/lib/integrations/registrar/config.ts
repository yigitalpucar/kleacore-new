import { getSettingMap, isEnabled } from "../settings";
import type { GriRegistrarConfig } from "./types";

export async function getRegistrarConfig(): Promise<GriRegistrarConfig> {
  const settings = await getSettingMap([
    { key: "registrar_enabled", env: "REGISTRAR_ENABLED", fallback: "false" },
    { key: "registrar_provider", env: "REGISTRAR_PROVIDER", fallback: "disabled" },
    { key: "registrar_api_url", env: "REGISTRAR_API_URL" },
    { key: "registrar_api_key", env: "REGISTRAR_API_KEY" },
    { key: "registrar_username", env: "REGISTRAR_USERNAME" },
    { key: "registrar_password", env: "REGISTRAR_PASSWORD" },
    { key: "registrar_client_id", env: "REGISTRAR_CLIENT_ID" },
    { key: "registrar_client_secret", env: "REGISTRAR_CLIENT_SECRET" },
    { key: "registrar_test_mode", env: "REGISTRAR_TEST_MODE", fallback: "false" },
  ]);

  return {
    enabled: isEnabled(settings.registrar_enabled),
    provider: settings.registrar_provider || "disabled",
    apiUrl: settings.registrar_api_url,
    apiKey: settings.registrar_api_key,
    username: settings.registrar_username,
    password: settings.registrar_password,
    clientId: settings.registrar_client_id,
    clientSecret: settings.registrar_client_secret,
    testMode: isEnabled(settings.registrar_test_mode),
  };
}

export function isGriProvider(config: GriRegistrarConfig) {
  return config.provider.toLowerCase() === "gri";
}

export function isGriConfigured(config: GriRegistrarConfig) {
  return Boolean(
    config.username &&
      config.password &&
      config.clientId &&
      config.clientSecret
  );
}

export function isGriRegistrarEnabled(config: GriRegistrarConfig) {
  return config.enabled && isGriProvider(config) && isGriConfigured(config);
}