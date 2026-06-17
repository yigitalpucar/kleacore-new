import { disabledResult } from "../../helpers";
import type { IntegrationResult } from "../../settings";
import type { SendSmsInput, SendSmsResult, SmsProvider } from "../types";

const NOT_CONFIGURED = "SMS_NOT_CONFIGURED";

export function createDisabledSmsProvider(provider: "disabled" | "netgsm" | "iletimerkezi" = "disabled"): SmsProvider {
  return {
    name: provider,
    sendSms: async (_input: SendSmsInput): Promise<SendSmsResult> => ({
      sent: false,
      skipped: true,
      provider,
      error: NOT_CONFIGURED,
    }),
    healthCheck: async (): Promise<IntegrationResult<{ status: string }>> =>
      disabledResult(provider, NOT_CONFIGURED),
  };
}