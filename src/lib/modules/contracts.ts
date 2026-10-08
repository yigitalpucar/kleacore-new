/**
 * Typed capability contracts per module kind — docs/modules.md.
 *
 * They extend (never break) the provider interfaces that already exist under
 * src/lib/integrations/**: a RegistrarModule *is* a RegistrarProvider, a
 * payment module *is* a PaymentGatewayProvider, and ServerModule is the
 * per-instance successor of ProvisioningProvider (an adapter turns one into
 * the other: ./server-bridge.ts), so every existing caller keeps working.
 *
 * Conventions:
 * - Every remote call returns `IntegrationResult` and never throws for remote
 *   failures (`{ ok: false, error }`); `skipped: true` = "not supported /
 *   not configured, nothing happened".
 * - Optional methods exist only when the manifest declares the matching
 *   capability (see CapabilitiesByKind in ./types.ts).
 */
import type { IntegrationResult } from "@/lib/integrations/settings";
import type { PaymentGatewayProvider } from "@/lib/integrations/payment-gateways/types";
import type { EInvoiceProvider } from "@/lib/integrations/efatura/types";
import type { RegistrarProvider } from "@/lib/integrations/registrar/providers/types";
import type { RegistrarDomainInfo } from "@/lib/integrations/registrar/types";
import type { SmsProvider } from "@/lib/integrations/sms/types";

// ---------------------------------------------------------------------------
// Server (hosting panels, hypervisors)
// ---------------------------------------------------------------------------

/** What a server module gets for every account operation. */
export interface ServerAccountContext<TOptions = Record<string, unknown>> {
  instance: { id: string; label: string; moduleId: string };
  service: {
    id: string;
    label: string;
    domain: string | null;
    /** Panel/login username stored on the service (may be null). */
    username: string | null;
    /** Id of the account on this instance (WHM username / Proxmox VMID); null before createAccount. */
    remoteId: string | null;
    ipAddress: string | null;
    customer: { id: string; email: string; name: string; surname: string } | null;
    product: { id: string; sku: string; name: string; categorySlug: string };
  };
  /** Product.moduleOptions parsed by the manifest's productOptionsSchema. */
  options: TOptions;
}

export interface ServerAccountCreated {
  /** Required: stored in Service.remoteId (WHM username / Proxmox VMID). */
  remoteId: string;
  username?: string;
  /** Initial password, if the module generated one (never logged). */
  password?: string;
  /** Primary IP; stored in Service.ipAddress when given. */
  ipAddress?: string;
  hostname?: string;
  meta?: Record<string, unknown>;
}

export interface ServerUsage {
  diskUsedMB?: number;
  diskLimitMB?: number;
  bandwidthUsedMB?: number;
  bandwidthLimitMB?: number;
  cpuPercent?: number;
  ramUsedMB?: number;
  ramLimitMB?: number;
  collectedAt: Date;
}

export type ServerPowerAction = "start" | "stop" | "restart" | "shutdown";

/** Account / VM found on the remote side (importers, 2.7). */
export interface RemoteAccount {
  remoteId: string;
  username?: string;
  domain?: string;
  email?: string;
  package?: string;
  status?: "active" | "suspended" | "stopped" | "unknown";
  ipAddress?: string;
  createdAt?: Date;
  raw?: Record<string, unknown>;
}

export type OperationResult = IntegrationResult<{ reference?: string }>;

export interface ServerModule<TOptions = Record<string, unknown>> {
  readonly moduleId: string;
  createAccount(ctx: ServerAccountContext<TOptions>): Promise<IntegrationResult<ServerAccountCreated>>;
  suspend(ctx: ServerAccountContext<TOptions>, reason?: string): Promise<OperationResult>;
  unsuspend(ctx: ServerAccountContext<TOptions>): Promise<OperationResult>;
  /** Irreversible. The bridge releases the service's IPs afterwards. */
  terminate(ctx: ServerAccountContext<TOptions>): Promise<OperationResult>;
  /** ctx.options are the *new* product's options. */
  changePackage(ctx: ServerAccountContext<TOptions>): Promise<OperationResult>;
  getUsage?(ctx: ServerAccountContext<TOptions>): Promise<IntegrationResult<ServerUsage>>;
  /** One-time login URL. target "panel" (cPanel / Proxmox) or "webmail". */
  getSsoUrl?(
    ctx: ServerAccountContext<TOptions>,
    target?: "panel" | "webmail"
  ): Promise<IntegrationResult<{ url: string; expiresAt?: Date }>>;
  getConsoleUrl?(
    ctx: ServerAccountContext<TOptions>
  ): Promise<IntegrationResult<{ url: string; expiresAt?: Date; type?: "novnc" | "xtermjs" | "spice" }>>;
  powerAction?(ctx: ServerAccountContext<TOptions>, action: ServerPowerAction): Promise<OperationResult>;
  reinstall?(
    ctx: ServerAccountContext<TOptions>,
    input: { templateId?: string; password?: string; sshKeys?: string[] }
  ): Promise<OperationResult>;
  listAccounts?(): Promise<IntegrationResult<RemoteAccount[]>>;
}

// ---------------------------------------------------------------------------
// Registrar
// ---------------------------------------------------------------------------

export interface RegistrarDomainListItem {
  domain: string;
  expiresAt?: Date | null;
  status?: string | null;
  autoRenew?: boolean;
  nameservers?: string[];
}

/** Existing RegistrarProvider + required getDomainInfo + importer/extra hooks. */
export interface RegistrarModule extends RegistrarProvider {
  getDomainInfo(domain: string): Promise<IntegrationResult<RegistrarDomainInfo>>;
  listDomains?(): Promise<IntegrationResult<RegistrarDomainListItem[]>>;
  getEppCode?(domain: string): Promise<IntegrationResult<{ eppCode: string }>>;
  setLock?(domain: string, locked: boolean): Promise<OperationResult>;
}

// ---------------------------------------------------------------------------
// DNS
// ---------------------------------------------------------------------------

export const DNS_RECORD_TYPES = ["A", "AAAA", "CNAME", "MX", "TXT", "NS", "SRV", "CAA"] as const;
export type DnsModuleRecordType = (typeof DNS_RECORD_TYPES)[number];

/** Types that hold a single value per name: upsert without id replaces it. */
export const SINGLE_VALUE_DNS_TYPES: readonly DnsModuleRecordType[] = ["CNAME"];

/**
 * A DNS record. `name` is the fully qualified, lower-case name without the
 * trailing dot ("www.example.com"; apex = "example.com").
 */
export interface DnsModuleRecord {
  id?: string;
  type: DnsModuleRecordType;
  name: string;
  content: string;
  /** Seconds; 1 = provider "auto". */
  ttl?: number;
  priority?: number;
  /** Cloudflare-style proxying (capability "proxy"). */
  proxied?: boolean;
}

export interface DnsZoneInfo {
  zoneId: string;
  /** Nameservers the registrar must point at. */
  nameservers: string[];
  created: boolean;
}

export interface DnsModule {
  readonly moduleId: string;
  /** Idempotent: returns the existing zone or creates it. */
  ensureZone(zone: string): Promise<IntegrationResult<DnsZoneInfo>>;
  listRecords(zone: string): Promise<IntegrationResult<Array<DnsModuleRecord & { id: string }>>>;
  /**
   * With `record.id`: update that record. Without: for single-value types
   * (CNAME) update the record with the same type+name; for the others update
   * the record with the same type+name+content (TTL/priority/proxied change)
   * or create it. Idempotent.
   */
  upsertRecord(zone: string, record: DnsModuleRecord): Promise<IntegrationResult<DnsModuleRecord & { id: string }>>;
  /** Deleting a missing record is ok (idempotent). */
  deleteRecord(zone: string, recordId: string): Promise<OperationResult>;
}

// ---------------------------------------------------------------------------
// Settings-backed kinds (unchanged existing interfaces)
// ---------------------------------------------------------------------------

export type PaymentModule = PaymentGatewayProvider;
export type EInvoiceModule = EInvoiceProvider;
export type SmsModule = SmsProvider;

export interface MailModule {
  send(message: {
    to: string;
    subject: string;
    html?: string;
    text?: string;
  }): Promise<IntegrationResult<{ providerMessageId?: string }>>;
}

export interface StorageModule {
  put(key: string, body: Buffer, options?: { contentType?: string }): Promise<IntegrationResult<{ key: string }>>;
  get(key: string): Promise<IntegrationResult<Buffer>>;
  delete(key: string): Promise<OperationResult>;
  list?(prefix: string): Promise<IntegrationResult<Array<{ key: string; size: number }>>>;
}

/** Contract type per kind (TOptions only matters for server modules). */
export type ModuleContracts<TOptions = Record<string, unknown>> = {
  server: ServerModule<TOptions>;
  registrar: RegistrarModule;
  dns: DnsModule;
  payment: PaymentModule;
  einvoice: EInvoiceModule;
  sms: SmsModule;
  mail: MailModule;
  storage: StorageModule;
};
