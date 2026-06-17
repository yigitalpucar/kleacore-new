import type { SslType } from "@prisma/client";
import { getSettingMap, isEnabled } from "../settings";
import { createDisabledSslProvider } from "./providers/disabled";
import { createLetsEncryptSslProvider } from "./providers/letsencrypt";

import { createSectigoSslProvider } from "./providers/sectigo";
import type {
  SslConfig,
  SslProvisionInput,
  SslProvisionResult,
  SslProvider,
  SslProviderName,
} from "./types";

export type {
  SslConfig,
  SslProvisionInput,
  SslProvisionResult,
  SslProvider,
  SslProviderName,
} from "./types";

const SSL_SETTING_KEYS = [
  { key: "ssl_enabled", fallback: "false" },
  { key: "ssl_provider", fallback: "disabled" },
  { key: "ssl_acme_email" },
  { key: "ssl_sectigo_api_key" },
] as const;

function normalizeProvider(value: string | undefined): SslProviderName {
  if (value === "letsencrypt" || value === "sectigo") {
    return value;
  }
  return "disabled";
}

export async function getSslConfig(): Promise<SslConfig> {
  const settings = await getSettingMap([...SSL_SETTING_KEYS]);

  return {
    enabled: isEnabled(settings.ssl_enabled),
    provider: normalizeProvider(settings.ssl_provider),
    acmeEmail: settings.ssl_acme_email,
    sectigoApiKey: settings.ssl_sectigo_api_key,
  };
}

export function isSslConfigured(config: SslConfig): boolean {
  if (!config.enabled || config.provider === "disabled") {
    return false;
  }

  if (config.provider === "letsencrypt") {
    return Boolean(config.acmeEmail.trim());
  }

  if (config.provider === "sectigo") {
    return Boolean(config.sectigoApiKey.trim());
  }

  return false;
}

export async function getSslProvider(): Promise<SslProvider> {
  const config = await getSslConfig();

  if (!config.enabled || config.provider === "disabled") {
    return createDisabledSslProvider();
  }

  if (config.provider === "letsencrypt") {
    if (!config.acmeEmail.trim()) {
      return createDisabledSslProvider();
    }
    return createLetsEncryptSslProvider(config.acmeEmail);
  }

  if (config.provider === "sectigo") {
    if (!config.sectigoApiKey.trim()) {
      return createDisabledSslProvider();
    }
    return createSectigoSslProvider(config.sectigoApiKey);
  }

  return createDisabledSslProvider();
}

export function mapProductSubTypeToSslType(subType: string | null | undefined): SslType {
  switch (subType) {
    case "kurumsal":
      return "OV";
    case "ev":
      return "EV";
    case "wildcard":
      return "WILDCARD";
    case "standart":
    default:
      return "DV";
  }
}

export async function provisionSslCertificate(
  input: SslProvisionInput
): Promise<SslProvisionResult> {
  const provider = await getSslProvider();
  return provider.provisionCertificate(input);
}

export function serializeSslProvisionResult(result: SslProvisionResult) {
  return {
    ok: result.ok,
    skipped: result.skipped,
    status: result.status,
    provider: result.provider,
    issuedAt: result.issuedAt?.toISOString(),
    expiresAt: result.expiresAt?.toISOString(),
    certificateId: result.certificateId,
    externalId: result.externalId,
    providerResponse: result.providerResponse,
    error: result.error,
  };
}