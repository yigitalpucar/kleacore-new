import type { IntegrationResult } from "../settings";

export type SmsProviderName = "disabled" | "netgsm" | "iletimerkezi";

export interface SendSmsInput {
  to: string;
  message: string;
}

export interface SendSmsResult {
  sent: boolean;
  skipped?: boolean;
  provider?: string;
  reference?: string;
  error?: string;
}

export interface SmsProvider {
  readonly name: SmsProviderName;
  sendSms(input: SendSmsInput): Promise<SendSmsResult>;
  healthCheck(): Promise<IntegrationResult<{ status: string }>>;
}

export interface SmsConfig {
  enabled: boolean;
  provider: SmsProviderName;
  netgsm: {
    usercode: string;
    password: string;
    header: string;
  };
  iletimerkezi: {
    apiKey: string;
    secret: string;
    sender: string;
  };
}