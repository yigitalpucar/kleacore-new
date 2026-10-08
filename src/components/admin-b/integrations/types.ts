import type { IntegrationModule, IntegrationOverview } from "@/lib/integrations/module-status";

export type { IntegrationModule, IntegrationOverview };

export interface ApiKeyItem {
  id: string;
  name: string;
  keyPrefix: string;
  createdAt: Date;
  lastUsedAt: Date | null;
}

export interface CronJobItem {
  name: string;
  path: string;
  schedule: string;
  url: string;
}

export interface RegistrarConfig {
  enabled: boolean;
  provider: string;
  apiUrl: string;
  apiKey: string;
  username: string;
  hasPassword: boolean;
  clientId: string;
  hasClientSecret: boolean;
  testMode: boolean;
}

export interface CpanelConfig {
  enabled: boolean;
  host: string;
  port: string;
  username: string;
  hasApiToken: boolean;
  defaultPlan: string;
  useSsl: boolean;
  backupEnabled: boolean;
}

export interface VpsVdsConfig {
  enabled: boolean;
  provider: string;
  apiUrl: string;
  apiKey: string;
  apiUsername: string;
  hasApiPassword: boolean;
}

export interface SmtpConfig {
  server: string;
  port: string;
  username: string;
  hasPassword: boolean;
  notificationsEnabled: boolean;
}

export interface SmsConfig {
  enabled: boolean;
  provider: string;
  netgsm: { usercode: string; hasPassword: boolean; header: string };
  iletimerkezi: { apiKey: string; hasSecret: boolean; sender: string };
  notificationsEnabled: boolean;
}

export interface WebhooksConfig {
  orders: string;
  payments: string;
}

export interface PaymentGatewayConfig {
  provider: string;
  iyzico: { enabled: boolean; apiKey: string; hasSecretKey: boolean; testMode: boolean };
  paytr: { enabled: boolean; merchantId: string; hasMerchantKey: boolean; hasMerchantSalt: boolean };
  kuveytturk: {
    enabled: boolean;
    merchantId: string;
    customerId: string;
    username: string;
    hasPassword: boolean;
    testMode: boolean;
  };
}

export interface EfaturaConfig {
  enabled: boolean;
  provider: string;
  hasApiKey: boolean;
  companyVkn: string;
}

export interface SslConfig {
  enabled: boolean;
  provider: string;
  acmeEmail: string;
  hasSectigoApiKey: boolean;
}

export interface EnvFlags {
  stripeSecretConfigured: boolean;
  stripeWebhookConfigured: boolean;
  stripePublishableConfigured: boolean;
  cronSecretConfigured: boolean;
  appBaseUrl: string;
}
