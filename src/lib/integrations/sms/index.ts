import { getSettingMap, isEnabled } from "../settings";
import { createDisabledSmsProvider } from "./providers/disabled";
import { createIletiMerkeziSmsProvider } from "./providers/iletimerkezi";
import { createNetgsmSmsProvider } from "./providers/netgsm";
import type { SmsConfig, SmsProvider, SmsProviderName } from "./types";

export type { SendSmsInput, SendSmsResult, SmsProvider, SmsProviderName } from "./types";

const SMS_SETTING_KEYS = [
  { key: "sms_enabled", fallback: "false" },
  { key: "sms_provider", fallback: "disabled" },
  { key: "sms_netgsm_usercode" },
  { key: "sms_netgsm_password" },
  { key: "sms_netgsm_header" },
  { key: "sms_iletimerkezi_api_key" },
  { key: "sms_iletimerkezi_secret" },
  { key: "sms_iletimerkezi_sender" },
] as const;

function normalizeProvider(value: string | undefined): SmsProviderName {
  if (value === "netgsm" || value === "iletimerkezi") {
    return value;
  }
  return "disabled";
}

export async function getSmsConfig(): Promise<SmsConfig> {
  const settings = await getSettingMap([...SMS_SETTING_KEYS]);

  return {
    enabled: isEnabled(settings.sms_enabled),
    provider: normalizeProvider(settings.sms_provider),
    netgsm: {
      usercode: settings.sms_netgsm_usercode,
      password: settings.sms_netgsm_password,
      header: settings.sms_netgsm_header,
    },
    iletimerkezi: {
      apiKey: settings.sms_iletimerkezi_api_key,
      secret: settings.sms_iletimerkezi_secret,
      sender: settings.sms_iletimerkezi_sender,
    },
  };
}

export function isSmsConfigured(config: SmsConfig): boolean {
  if (!config.enabled || config.provider === "disabled") {
    return false;
  }

  if (config.provider === "netgsm") {
    return Boolean(
      config.netgsm.usercode && config.netgsm.password && config.netgsm.header
    );
  }

  if (config.provider === "iletimerkezi") {
    return Boolean(
      config.iletimerkezi.apiKey &&
        config.iletimerkezi.secret &&
        config.iletimerkezi.sender
    );
  }

  return false;
}

export async function getSmsProvider(): Promise<SmsProvider> {
  const config = await getSmsConfig();

  if (!config.enabled || config.provider === "disabled") {
    return createDisabledSmsProvider("disabled");
  }

  if (config.provider === "netgsm") {
    if (!config.netgsm.usercode || !config.netgsm.password || !config.netgsm.header) {
      return createDisabledSmsProvider("netgsm");
    }
    return createNetgsmSmsProvider(config.netgsm);
  }

  if (config.provider === "iletimerkezi") {
    if (
      !config.iletimerkezi.apiKey ||
      !config.iletimerkezi.secret ||
      !config.iletimerkezi.sender
    ) {
      return createDisabledSmsProvider("iletimerkezi");
    }
    return createIletiMerkeziSmsProvider(config.iletimerkezi);
  }

  return createDisabledSmsProvider("disabled");
}