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

/**
 * Per-service state a module may keep between calls (Service.moduleData,
 * namespaced by moduleId): resumable provisioning progress, remote ids,
 * encrypted initial credentials. Optional: when absent (contract tests,
 * ad-hoc calls) modules must still work, they just can't resume.
 */
export interface ServerModuleState {
  get(): Promise<Record<string, unknown>>;
  /** Shallow-merges `patch` into the module's state; `undefined` values remove keys. */
  patch(patch: Record<string, unknown>): Promise<void>;
}

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
  /** Service.moduleData[moduleId] (provided by the server bridge). */
  state?: ServerModuleState;
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

/** Limits: undefined = unknown, null = unlimited. Bandwidth = current month. */
export interface ServerUsage {
  diskUsedMB?: number;
  diskLimitMB?: number | null;
  bandwidthUsedMB?: number;
  bandwidthLimitMB?: number | null;
  cpuPercent?: number;
  ramUsedMB?: number;
  ramLimitMB?: number;
  /** Hypervisors: current power state of the VM. */
  powerState?: "running" | "stopped" | "paused" | "unknown";
  collectedAt: Date;
}

export type ServerPowerAction = "start" | "stop" | "restart" | "shutdown";

/** Panel area a single sign-on URL may open directly (modules map it to their own app id). */
export type ServerSsoApp = "fileManager" | "emailAccounts" | "phpMyAdmin";

/** Usage of one account in a bulk read (`listUsage`). */
export interface RemoteAccountUsage {
  remoteId: string;
  usage: ServerUsage;
}

/** A package/plan defined on the remote side (WHM package, …). */
export interface RemotePackage {
  /** Name to send to the panel (already prefixed for reseller-owned WHM packages). */
  name: string;
  diskLimitMB?: number | null;
  bandwidthLimitMB?: number | null;
}

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
  /** Disk used / quota in MB (undefined = unknown; limit undefined also = unlimited). */
  diskUsedMB?: number;
  diskLimitMB?: number;
  /** Panel-side suspension reason, when status is "suspended". */
  suspendReason?: string;
  raw?: Record<string, unknown>;
}

export type OperationResult = IntegrationResult<{ reference?: string }>;

/** One backup archive of a VM on the hypervisor's backup storage (capability "backups"). */
export interface ServerBackupArchive {
  /** Storage volume id ("local:backup/vzdump-qemu-1000-….vma.zst", "pbs:backup/vm/1000/…"). */
  volid: string;
  storage: string;
  node: string;
  sizeBytes: number | null;
  createdAt: Date | null;
  notes?: string | null;
  format?: string | null;
}

/** A long remote task the caller should persist so a retry resumes it instead of starting over. */
export interface ServerTaskStarted {
  upid: string;
  node: string;
  storage?: string;
}

export interface ServerBackupInput {
  mode?: "snapshot" | "suspend" | "stop";
  /** Target storage; defaults to the instance's backup storage (PBS when configured). */
  storage?: string;
  /** Unique marker written into the archive notes; used to find the archive afterwards. */
  tag: string;
  /** Free text appended to the notes. */
  notes?: string;
  /** Shut the VM down (graceful, forced after 60 s) before backing it up (final backup before termination). */
  shutdownFirst?: boolean;
  /** UPID of a backup task started by an earlier attempt: poll it instead of starting a second one. */
  resumeUpid?: string;
  /** Called right after the task was started (persist the UPID). */
  onStarted?(task: ServerTaskStarted): Promise<void>;
}

export interface ServerRestoreInput {
  volid: string;
  /**
   * The archive belongs to another service's VM (admin restore of a final
   * backup into a new service): skip the "archive is this VM's" check and
   * re-apply this service's ownership marker and network afterwards.
   */
  foreign?: boolean;
  resumeUpid?: string;
  onStarted?(task: ServerTaskStarted): Promise<void>;
}

export interface ServerBackupDeleteInput {
  volid: string;
  storage?: string;
  node?: string;
  /** VMID the archive must belong to (refused otherwise). */
  vmid: number;
}

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
  /**
   * Usage of every account on the instance in a few calls (daily sync).
   * Limits: undefined = unknown, null = unlimited. Capability "bulkUsage".
   */
  listUsage?(): Promise<IntegrationResult<RemoteAccountUsage[]>>;
  /**
   * One-time login URL. target "panel" (cPanel / Proxmox) or "webmail";
   * `app` opens a panel area directly. The URL is a credential: callers
   * redirect to it and never log or store it.
   */
  getSsoUrl?(
    ctx: ServerAccountContext<TOptions>,
    target?: "panel" | "webmail",
    options?: { app?: ServerSsoApp }
  ): Promise<IntegrationResult<{ url: string; expiresAt?: Date }>>;
  /** Sets the account's panel password (capability "password"). Never log `password`. */
  resetPassword?(ctx: ServerAccountContext<TOptions>, password: string): Promise<OperationResult>;
  /** Packages available to this instance's credentials (capability "packages"; read-only). */
  listPackages?(): Promise<IntegrationResult<RemotePackage[]>>;
  /**
   * Package name a product with these options provisions with (pure, no
   * remote call; capability "packages"). Lets the admin form validate it
   * against `listPackages`.
   */
  resolvePackageName?(options: TOptions, product: { sku: string }): string;
  getConsoleUrl?(
    ctx: ServerAccountContext<TOptions>
  ): Promise<IntegrationResult<{ url: string; expiresAt?: Date; type?: "novnc" | "xtermjs" | "spice" }>>;
  powerAction?(ctx: ServerAccountContext<TOptions>, action: ServerPowerAction): Promise<OperationResult>;
  reinstall?(
    ctx: ServerAccountContext<TOptions>,
    input: { templateId?: string; password?: string; sshKeys?: string[] }
  ): Promise<OperationResult>;
  listAccounts?(): Promise<IntegrationResult<RemoteAccount[]>>;
  /**
   * Provisioning was given up (retries exhausted / admin gave up): undo
   * reservations (IPs) and flag what is left for the admin. Must not delete
   * remote resources. Without it the bridge just releases the service's IPs.
   */
  abandonProvisioning?(ctx: ServerAccountContext<TOptions>): Promise<OperationResult>;
  /**
   * Capability "backups" (hypervisors). createBackup waits for the task up
   * to the module's task timeout; a timeout is an error with code
   * "…_RUNNING" and the caller retries with `resumeUpid`.
   */
  createBackup?(
    ctx: ServerAccountContext<TOptions>,
    input: ServerBackupInput
  ): Promise<IntegrationResult<ServerBackupArchive & { upid: string | null }>>;
  /** Archives of the service's VM on the backup storage. */
  listBackups?(ctx: ServerAccountContext<TOptions>, options?: { storage?: string }): Promise<IntegrationResult<ServerBackupArchive[]>>;
  /** Overwrites the service's VM with the archive (stops it first, starts it after). Destructive: callers confirm. */
  restoreBackup?(ctx: ServerAccountContext<TOptions>, input: ServerRestoreInput): Promise<OperationResult>;
  /** Deletes an archive; a missing archive counts as deleted. Works after the VM is gone. */
  deleteBackup?(ctx: ServerAccountContext<TOptions>, input: ServerBackupDeleteInput): Promise<OperationResult>;
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
  /**
   * Provider zone status when known ("active" = nameservers point at the
   * provider; Cloudflare also reports "pending", "moved", "deactivated" …).
   */
  status?: string;
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
  /** Capability "deleteZone" (admin only). Deleting a missing zone is ok. */
  deleteZone?(zone: string): Promise<OperationResult>;
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
