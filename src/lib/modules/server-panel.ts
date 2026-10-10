/**
 * Customer / admin server panel on top of a bound ServerModule (Proxmox VDS
 * today): serialisable views, usage refresh into the Service usage fields,
 * one-time reveal of the initial credentials, queued reinstall. Server-only;
 * every view here is safe to send to the browser (no secrets, no tokens).
 */
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import type { ServiceWithProduct } from "@/lib/integrations/provisioning/types";
import { createLogger } from "@/lib/logger";
import { decryptSecret } from "@/lib/secrets/crypto";
import type { ServerAccountContext, ServerMetricPoint, ServerMetricsRange } from "./contracts";
import { getServerBindingForService, getInstance } from "./instances";
import { parseProductOptions } from "./product-options";
import { getModule } from "./registry";
import { buildServerContext, type ServerBinding } from "./server-bridge";
import { PROXMOX_MODULE_ID, vmNameFor, type ProxmoxModuleConfig, type ProxmoxServiceState } from "./server/proxmox";
import { createServiceModuleState, moduleSlice, patchServiceModuleState } from "./service-state";

const log = createLogger("modules.server-panel");

/** moduleData key for generic usage bookkeeping (any server module). */
const USAGE_KEY = "_usage";
export const USAGE_MAX_AGE_MS = 5 * 60 * 1000;
const USAGE_TIMEOUT_MS = 8_000;

type ServiceForPanel = ServiceWithProduct & { moduleData?: Prisma.JsonValue | null };

export interface VdsPanelView {
  moduleId: string;
  provisioning: "pending" | "ready" | "failed";
  osLabel: string | null;
  specs: { cores: number | null; memoryMB: number | null; diskGB: number | null };
  hostname: string;
  username: string | null;
  vmid: string | null;
  powerState: "running" | "stopped" | "paused" | "unknown";
  usageCollectedAt: string | null;
  credentials: { available: boolean; revealedAt: string | null };
  reinstall: { phase: string; requestedAt: string | null; error: string | null } | null;
  capabilities: { power: boolean; usage: boolean; metrics: boolean; reinstall: boolean; console: boolean };
}

export interface ProxmoxAdminView {
  vmid: string | null;
  node: string | null;
  step: string | null;
  lastError: string | null;
  lastErrorAt: string | null;
  needsAdmin: string | null;
  lastUpid: string | null;
  /** Link to the VM in the Proxmox web UI (admin only, requires PVE login). */
  pveUrl: string | null;
  provisioningJob: { id: string; status: string; attempts: number; maxAttempts: number; lastError: string | null } | null;
  reinstall: { phase: string; requestedAt: string | null; error: string | null } | null;
}

async function instanceModuleId(instanceId: string | null | undefined) {
  if (!instanceId) return null;
  const row = await db.moduleInstance.findUnique({ where: { id: instanceId }, select: { moduleId: true } });
  return row?.moduleId ?? null;
}

function contextFor(binding: ServerBinding, service: ServiceWithProduct): ServerAccountContext {
  const parsed = parseProductOptions(binding.manifest, service.product?.moduleOptions);
  return {
    ...buildServerContext(binding.instance, service, parsed.success ? parsed.data : {}),
    state: createServiceModuleState(service.id, binding.manifest.id),
  };
}

function num(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

/** Customer VDS panel for a Proxmox-bound service, else null (legacy / other modules). */
export async function getVdsPanelView(service: ServiceForPanel): Promise<VdsPanelView | null> {
  const moduleId = await instanceModuleId(service.moduleInstanceId);
  if (moduleId !== PROXMOX_MODULE_ID) return null;
  const manifest = getModule(moduleId);
  if (!manifest) return null;

  const state = moduleSlice(service.moduleData, moduleId) as ProxmoxServiceState;
  const usage = moduleSlice(service.moduleData, USAGE_KEY);
  const parsed = parseProductOptions(manifest, service.product?.moduleOptions);
  const options = parsed.success ? parsed.data : {};
  const capabilities = manifest.capabilities as readonly string[];

  return {
    moduleId,
    provisioning: service.remoteId ? "ready" : state.abandonedAt ? "failed" : "pending",
    osLabel: (state.osLabel ?? (typeof options.osLabel === "string" ? options.osLabel : null)) || null,
    specs: { cores: num(options.cores), memoryMB: num(options.memoryMB), diskGB: num(options.diskGB) },
    hostname: vmNameFor(service.id),
    username: state.ciUser ?? (typeof options.ciUser === "string" ? options.ciUser : null),
    vmid: service.remoteId ?? null,
    powerState: (usage.powerState as VdsPanelView["powerState"]) ?? "unknown",
    usageCollectedAt: typeof usage.collectedAt === "string" ? usage.collectedAt : null,
    credentials: { available: Boolean(state.passwordEnc), revealedAt: state.credentialsRevealedAt ?? null },
    reinstall: state.reinstall
      ? { phase: state.reinstall.phase, requestedAt: state.reinstall.requestedAt ?? null, error: state.reinstall.error ?? null }
      : null,
    capabilities: {
      power: capabilities.includes("power"),
      usage: capabilities.includes("usage"),
      metrics: capabilities.includes("metrics"),
      // Imported VMs were not cloned from our template: no reinstall.
      reinstall: capabilities.includes("reinstall") && !state.imported,
      // noVNC needs a PVE user ticket in the browser; not exposed (docs/modules/proxmox.md).
      console: capabilities.includes("console"),
    },
  };
}

/** Admin "Proxmox" card on the service detail. */
export async function getProxmoxAdminView(service: ServiceForPanel): Promise<ProxmoxAdminView | null> {
  if ((await instanceModuleId(service.moduleInstanceId)) !== PROXMOX_MODULE_ID) return null;
  const state = moduleSlice(service.moduleData, PROXMOX_MODULE_ID) as ProxmoxServiceState;

  let pveUrl: string | null = null;
  const vmid = service.remoteId ?? (state.vmid ? String(state.vmid) : null);
  try {
    const instance = await getInstance<ProxmoxModuleConfig>(service.moduleInstanceId!);
    if (instance && vmid) {
      pveUrl = `${instance.config.apiUrl.replace(/\/+$/, "")}/#v1:0:=qemu%2F${vmid}:4:::::::`;
    }
  } catch {
    pveUrl = null;
  }

  const job = await db.provisioningJob.findFirst({
    where: { serviceId: service.id, kind: "PROVISION" },
    orderBy: { createdAt: "desc" },
    select: { id: true, status: true, attempts: true, maxAttempts: true, lastError: true },
  });

  return {
    vmid,
    node: state.node ?? null,
    step: state.step ?? null,
    lastError: state.lastError ?? null,
    lastErrorAt: state.lastErrorAt ?? null,
    needsAdmin: state.needsAdmin ?? null,
    lastUpid: state.lastUpid ?? null,
    pveUrl,
    provisioningJob: job,
    reinstall: state.reinstall
      ? { phase: state.reinstall.phase, requestedAt: state.reinstall.requestedAt ?? null, error: state.reinstall.error ?? null }
      : null,
  };
}

async function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error("USAGE_TIMEOUT")), ms);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/**
 * Pulls usage from the bound module (getUsage) into Service.cpuUsage /
 * ramUsage (%), diskUsed / diskLimit / bandwidthUsed (GB) and remembers the
 * VM power state. Skips when the last collection is younger than `maxAgeMs`.
 * Never throws.
 */
export async function refreshServiceUsage(
  service: ServiceForPanel,
  options: { maxAgeMs?: number } = {}
): Promise<{ refreshed: boolean; error?: string }> {
  const maxAgeMs = options.maxAgeMs ?? USAGE_MAX_AGE_MS;
  if (!service.moduleInstanceId || !service.remoteId) return { refreshed: false };
  const usageState = moduleSlice(service.moduleData, USAGE_KEY);
  const last = typeof usageState.collectedAt === "string" ? Date.parse(usageState.collectedAt) : 0;
  if (maxAgeMs > 0 && last && Date.now() - last < maxAgeMs) return { refreshed: false };

  try {
    const binding = await getServerBindingForService(service);
    if (!binding?.module.getUsage) return { refreshed: false };
    const result = await withTimeout(binding.module.getUsage(contextFor(binding, service)), USAGE_TIMEOUT_MS);
    if (!result.ok || !result.data) {
      await patchServiceModuleState(service.id, USAGE_KEY, { lastError: result.error ?? "USAGE_FAILED", lastErrorAt: new Date().toISOString() });
      return { refreshed: false, error: result.error };
    }
    const usage = result.data;
    // null limit = unlimited (ServerUsage), stored as null like the hosting usage sync.
    const gb = (mb: number | null | undefined) => (mb == null ? mb : Math.round((mb / 1024) * 100) / 100);
    await db.service.update({
      where: { id: service.id },
      data: {
        ...(usage.cpuPercent !== undefined ? { cpuUsage: usage.cpuPercent } : {}),
        ...(usage.ramLimitMB ? { ramUsage: Math.round(((usage.ramUsedMB ?? 0) / usage.ramLimitMB) * 1000) / 10 } : {}),
        ...(usage.diskLimitMB !== undefined ? { diskLimit: gb(usage.diskLimitMB) } : {}),
        ...(usage.diskUsedMB !== undefined ? { diskUsed: gb(usage.diskUsedMB) } : {}),
        ...(usage.bandwidthUsedMB !== undefined ? { bandwidthUsed: gb(usage.bandwidthUsedMB) } : {}),
        ...(usage.bandwidthLimitMB !== undefined ? { bandwidthLimit: gb(usage.bandwidthLimitMB) } : {}),
      },
    });
    await patchServiceModuleState(service.id, USAGE_KEY, {
      collectedAt: usage.collectedAt.toISOString(),
      powerState: usage.powerState,
      lastError: undefined,
      lastErrorAt: undefined,
    });
    return { refreshed: true };
  } catch (error) {
    log.warn("usage refresh failed", { serviceId: service.id, error: error instanceof Error ? error.message : String(error) });
    return { refreshed: false, error: error instanceof Error ? error.message : "USAGE_FAILED" };
  }
}

const SSH_KEY_PATTERN =
  /^(ssh-(rsa|ed25519|dss)|ecdsa-sha2-nistp(256|384|521)|sk-(ssh-ed25519|ecdsa-sha2-nistp256)@openssh\.com) [A-Za-z0-9+/]+={0,3}( [^\n]{0,200})?$/;

/** Splits and validates pasted OpenSSH public keys (one per line). */
export function parseSshKeysInput(text: string): { keys: string[] } | { error: string } {
  const keys = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (keys.length > 10) return { error: "En fazla 10 SSH anahtarı ekleyebilirsiniz" };
  const invalid = keys.findIndex((key) => key.length > 4096 || !SSH_KEY_PATTERN.test(key));
  if (invalid !== -1) return { error: `${invalid + 1}. satır geçerli bir OpenSSH açık anahtarı değil` };
  return { keys };
}

export class CredentialsError extends Error {
  constructor(
    readonly code: "NOT_AVAILABLE" | "ALREADY_REVEALED",
    message: string
  ) {
    super(message);
    this.name = "CredentialsError";
  }
}

/**
 * Initial cloud-init credentials, shown once: the first call returns the
 * decrypted password and stamps credentialsRevealedAt (row-locked, so two
 * tabs can't both read it). Later calls throw ALREADY_REVEALED.
 */
export async function revealInitialCredentials(serviceId: string) {
  return db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT "id" FROM "services" WHERE "id" = ${serviceId} FOR UPDATE`;
    const row = await tx.service.findUnique({ where: { id: serviceId }, select: { moduleData: true, ipAddress: true } });
    const all = (row?.moduleData && typeof row.moduleData === "object" && !Array.isArray(row.moduleData)
      ? { ...(row.moduleData as Record<string, unknown>) }
      : {}) as Record<string, unknown>;
    const state = moduleSlice(all, PROXMOX_MODULE_ID) as ProxmoxServiceState;
    if (!state.passwordEnc) throw new CredentialsError("NOT_AVAILABLE", "Bu sunucu için kayıtlı ilk giriş bilgisi yok.");
    if (state.credentialsRevealedAt) {
      throw new CredentialsError("ALREADY_REVEALED", "İlk giriş bilgileri daha önce gösterildi.");
    }
    const password = decryptSecret(state.passwordEnc);
    if (!password || password.startsWith("enc:")) throw new CredentialsError("NOT_AVAILABLE", "Şifre çözülemedi.");
    const revealedAt = new Date().toISOString();
    all[PROXMOX_MODULE_ID] = { ...state, credentialsRevealedAt: revealedAt };
    await tx.service.update({ where: { id: serviceId }, data: { moduleData: all as Prisma.InputJsonValue } });
    return { username: state.ciUser ?? null, password, ipAddress: row?.ipAddress ?? state.ipAddress ?? null, revealedAt };
  });
}

/**
 * Queues a reinstall (job "server.reinstall"): the module re-clones the
 * template into the same VMID with the same IP. `sshKeys` replace the stored
 * public keys when given.
 */
export async function queueServerReinstall(serviceId: string, input: { sshKeys?: string[] } = {}) {
  await patchServiceModuleState(serviceId, PROXMOX_MODULE_ID, {
    reinstall: { phase: "queued", requestedAt: new Date().toISOString() },
    ...(input.sshKeys ? { sshKeys: input.sshKeys } : {}),
  });
  const { enqueue } = await import("@/lib/jobs/enqueue");
  return enqueue("server.reinstall", { serviceId }, { singletonKey: serviceId });
}

/** Handler of the server.reinstall job: one (resumable) reinstall attempt. */
export async function runServerReinstallJob(serviceId: string, context: { isFinalAttempt: boolean }) {
  const service = await db.service.findUnique({
    where: { id: serviceId },
    include: { product: { include: { category: true } }, customer: true },
  });
  if (!service) return { skipped: "SERVICE_NOT_FOUND" };
  const state = moduleSlice(service.moduleData, PROXMOX_MODULE_ID) as ProxmoxServiceState;
  if (!state.reinstall || state.reinstall.phase === "done" || state.reinstall.phase === "failed") {
    return { skipped: "NO_PENDING_REINSTALL" };
  }

  const binding = await getServerBindingForService(service);
  if (!binding?.module.reinstall) throw new Error("REINSTALL_NOT_SUPPORTED");
  const result = await binding.module.reinstall(contextFor(binding, service), {});
  if (result.ok) {
    await patchServiceModuleState(serviceId, USAGE_KEY, { collectedAt: undefined });
    return { ok: true };
  }

  if (context.isFinalAttempt) {
    const current = (await createServiceModuleState(serviceId, PROXMOX_MODULE_ID).get()) as ProxmoxServiceState;
    await patchServiceModuleState(serviceId, PROXMOX_MODULE_ID, {
      reinstall: { ...(current.reinstall ?? { requestedAt: new Date().toISOString() }), phase: "failed", error: result.error },
      needsAdmin: `Yeniden kurulum başarısız: ${result.error ?? "bilinmeyen hata"}`,
    });
  }
  throw new Error(result.error ?? "REINSTALL_FAILED");
}

/** Admin: log lines of the service's last Proxmox task (clone / start / resize …). */
export async function fetchProxmoxTaskLog(service: ServiceForPanel): Promise<{ upid: string; lines: string[] } | { error: string }> {
  if (!service.moduleInstanceId) return { error: "Hizmet bir modül örneğine bağlı değil" };
  const state = moduleSlice(service.moduleData, PROXMOX_MODULE_ID) as ProxmoxServiceState;
  const upid = state.lastUpid ?? state.cloneUpid;
  if (!upid) return { error: "Kayıtlı Proxmox görevi yok" };
  try {
    const instance = await getInstance<ProxmoxModuleConfig>(service.moduleInstanceId);
    if (!instance || instance.moduleId !== PROXMOX_MODULE_ID) return { error: "Proxmox örneği bulunamadı" };
    const { createProxmoxClient } = await import("./server/proxmox/client");
    const client = createProxmoxClient({ ...instance.config, requestTimeoutMs: 10_000 });
    return { upid, lines: await client.taskLog(upid, 300) };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Görev kaydı alınamadı" };
  }
}

// ---------------------------------------------------------------------------
// Metrics (charts) and live status (power buttons)
// ---------------------------------------------------------------------------

export const METRICS_RANGES: readonly ServerMetricsRange[] = ["hour", "day", "week"];
const METRICS_TIMEOUT_MS = 8_000;

export function isMetricsRange(value: unknown): value is ServerMetricsRange {
  return typeof value === "string" && (METRICS_RANGES as readonly string[]).includes(value);
}

/**
 * - `unavailable`: no module / module without "metrics" / VM not created yet
 *   (the panel says "Ölçüm verisi bu sunucu için henüz yok").
 * - `error`: the hypervisor did not answer (temporary).
 * - `ok`: points as reported (may be empty right after creation).
 */
export type ServiceMetricsResult =
  | { status: "unavailable" }
  | { status: "error" }
  | { status: "ok"; range: ServerMetricsRange; points: ServerMetricPoint[] };

/** Time series of a module-bound server; never throws, never invents data. */
export async function getServiceMetrics(service: ServiceForPanel, range: ServerMetricsRange): Promise<ServiceMetricsResult> {
  if (!service.moduleInstanceId || !service.remoteId) return { status: "unavailable" };
  try {
    const binding = await getServerBindingForService(service);
    const declared = (binding?.manifest.capabilities as readonly string[] | undefined)?.includes("metrics");
    if (!binding || !declared || !binding.module.getMetrics) return { status: "unavailable" };
    const result = await withTimeout(binding.module.getMetrics(contextFor(binding, service), range), METRICS_TIMEOUT_MS);
    if (!result.ok || !result.data) {
      log.warn("metrics read failed", { serviceId: service.id, error: result.error });
      return { status: "error" };
    }
    return { status: "ok", range, points: result.data };
  } catch (error) {
    log.warn("metrics read failed", { serviceId: service.id, error: error instanceof Error ? error.message : String(error) });
    return { status: "error" };
  }
}

export interface ServerLiveStatus {
  status: string;
  suspendReason: string | null;
  powerState: VdsPanelView["powerState"];
  /** Reinstall phase from the module state (queued / destroy / provision / done / failed), else null. */
  reinstallPhase: string | null;
  collectedAt: string | null;
}

/**
 * Status the power buttons poll while an action runs: DB status plus the
 * VM power state (refreshed from the module at most every `maxAgeMs`).
 */
export async function getServerLiveStatus(service: ServiceForPanel, options: { maxAgeMs?: number } = {}): Promise<ServerLiveStatus> {
  let current = service;
  if (service.moduleInstanceId && service.remoteId) {
    const refreshed = await refreshServiceUsage(service, { maxAgeMs: options.maxAgeMs ?? 4_000 });
    if (refreshed.refreshed) {
      const row = await db.service.findUnique({
        where: { id: service.id },
        select: { status: true, suspendReason: true, moduleData: true },
      });
      if (row) current = { ...service, ...row };
    }
  }
  const usage = moduleSlice(current.moduleData, USAGE_KEY);
  const state = moduleSlice(current.moduleData, PROXMOX_MODULE_ID) as ProxmoxServiceState;
  const legacyPower: VdsPanelView["powerState"] =
    current.status === "ACTIVE" ? "running" : current.status === "SUSPENDED" ? "stopped" : "unknown";
  return {
    status: current.status,
    suspendReason: current.suspendReason ?? null,
    powerState: current.moduleInstanceId
      ? ((usage.powerState as VdsPanelView["powerState"] | undefined) ?? "unknown")
      : legacyPower,
    reinstallPhase: state.reinstall?.phase ?? null,
    collectedAt: typeof usage.collectedAt === "string" ? usage.collectedAt : null,
  };
}

/**
 * After a completed power action: remember the resulting power state and
 * expire the usage reading so the next view pulls fresh values.
 */
export async function recordPowerChange(serviceId: string, powerState: VdsPanelView["powerState"]) {
  await patchServiceModuleState(serviceId, USAGE_KEY, { powerState, collectedAt: undefined });
}
