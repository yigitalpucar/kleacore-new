import type { Prisma, SslStatus, SslType } from "@prisma/client";

export type SslProviderName = "disabled" | "letsencrypt" | "sectigo";

export interface SslConfig {
  enabled: boolean;
  provider: SslProviderName;
  acmeEmail: string;
  sectigoApiKey: string;
}

export interface SslProvisionInput {
  certificateId: string;
  domain: string;
  type: SslType;
  customerId: string;
}

export interface SslProvisionResult {
  ok: boolean;
  skipped?: boolean;
  status?: SslStatus;
  provider?: string;
  issuedAt?: Date;
  expiresAt?: Date;
  certificateId?: string;
  externalId?: string;
  providerResponse?: Prisma.InputJsonValue;
  error?: string;
}

export interface SslProvider {
  readonly name: SslProviderName;
  provisionCertificate(input: SslProvisionInput): Promise<SslProvisionResult>;
  healthCheck(): Promise<{ ok: boolean; skipped?: boolean; error?: string }>;
}