/**
 * Proxmox VE server module (Faz 2.3): VDS/VPS from a cloud-init template.
 * Docs: docs/modules/proxmox.md.
 *
 * createAccount is a resumable, idempotent pipeline; every step can be
 * re-run and progress lives in Service.moduleData.proxmox (ctx.state):
 *   lookup (own VM by VMID / name + owner marker in the description)
 *   → IP from IPAM (idempotent per service)
 *   → VMID in the instance range (/cluster/nextid check, retry on conflict)
 *   → full clone of the template → poll task UPID
 *   → config (cores, memory, name kc-…, tag kleacore, cloud-init user /
 *     password / SSH keys / ipconfig0 / nameserver, bridge+VLAN)
 *   → disk resize (grow only) → start.
 * A retry after a crash or timeout continues where it stopped instead of
 * cloning twice. VMs are never deleted automatically: only terminate()
 * (explicit admin termination) and reinstall() (customer-confirmed) destroy,
 * and only a VM whose description carries this service's owner marker.
 */
import { randomInt } from "node:crypto";
import { z } from "zod";
import type { IntegrationResult } from "@/lib/integrations/settings";
import { decryptSecret, encryptSecret } from "@/lib/secrets/crypto";
import type {
  OperationResult,
  RemoteAccount,
  ServerAccountContext,
  ServerAccountCreated,
  ServerModule,
  ServerModuleState,
  ServerPowerAction,
  ServerUsage,
} from "../../contracts";
import { defineModule, type ResolvedModuleInstance } from "../../types";
import {
  ProxmoxApiError,
  ProxmoxTaskError,
  createProxmoxClient,
  isUpid,
  type ProxmoxClient,
  type ProxmoxRuntime,
  type ProxmoxTransport,
} from "./client";
import { findBootDisk, parseUsage, rewriteNet0, type RrdPoint, type VmConfig, type VmStatusCurrent } from "./parse";

export const PROXMOX_MODULE_ID = "proxmox";
const MODULE_ID = PROXMOX_MODULE_ID;
const VM_TAG = "kleacore";

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

export const proxmoxConfigSchema = z.object({
  apiUrl: z.string().trim().url("https://sunucu:8006 biçiminde olmalı"),
  tokenId: z
    .string()
    .trim()
    .regex(/^[^@\s]+@[^!\s]+![^\s=]+$/, "Biçim: kullanıcı@realm!token-adı (ör. kleacore@pve!kleacore)"),
  tokenSecret: z.string().trim().min(1, "API token gizli anahtarı gerekli"),
  node: z.string().trim().min(1, "Node adı gerekli"),
  verifyTls: z.boolean().default(true),
  caCert: z.string().trim().optional(),
  defaultStorage: z.string().trim().min(1).default("local-lvm"),
  bridge: z.string().trim().min(1).default("vmbr0"),
  vmidStart: z.coerce.number().int().min(100).max(999_999_999).default(1000),
  vmidEnd: z.coerce.number().int().min(100).max(999_999_999).default(1999),
  pool: z.string().trim().optional(),
  nameservers: z.array(z.string().trim().min(1)).default(["1.1.1.1", "8.8.8.8"]),
  taskTimeoutSeconds: z.coerce.number().int().min(30).max(540).default(420),
  testDisableKvm: z.boolean().default(false),
});

export type ProxmoxModuleConfig = z.infer<typeof proxmoxConfigSchema>;

export const proxmoxProductOptionsSchema = z.object({
  templateVmid: z.coerce.number().int().min(100, "Şablon VMID gerekli"),
  cores: z.coerce.number().int().min(1).max(128).default(1),
  memoryMB: z.coerce.number().int().min(256).max(4_194_304).default(1024),
  diskGB: z.coerce.number().int().min(1).max(65_536).optional(),
  storage: z.string().trim().optional(),
  bridge: z.string().trim().optional(),
  vlan: z.coerce.number().int().min(1).max(4094).optional(),
  ipPoolId: z.string().trim().optional(),
  osLabel: z.string().trim().optional(),
  ciUser: z
    .string()
    .trim()
    .regex(/^[a-z_][a-z0-9_-]{0,31}$/, "Küçük harf, rakam, - ve _ (en fazla 32)")
    .default("kleacore"),
});

export type ProxmoxProductOptions = z.infer<typeof proxmoxProductOptionsSchema>;
type Ctx = ServerAccountContext<ProxmoxProductOptions>;

// ---------------------------------------------------------------------------
// State (Service.moduleData.proxmox)
// ---------------------------------------------------------------------------

export type ProvisionStep = "ip" | "cloning" | "cloned" | "configured" | "resized" | "done";

export interface ProxmoxServiceState {
  vmid?: number;
  node?: string;
  step?: ProvisionStep;
  /** UPID of a clone that may still be running (resume polls it). */
  cloneUpid?: string;
  /** Last task started for this VM (admin task log). */
  lastUpid?: string;
  ipAddress?: string;
  poolId?: string;
  ciUser?: string;
  osLabel?: string;
  /** enc:v1: initial password (cloud-init); decrypted only for the reveal. */
  passwordEnc?: string;
  credentialsRevealedAt?: string;
  sshKeys?: string[];
  lastError?: string;
  lastErrorAt?: string;
  completedAt?: string;
  /** Provisioning given up (retries exhausted): IP released, VM left for the admin. */
  abandonedAt?: string;
  needsAdmin?: string;
  suspendedAt?: string;
  terminatedAt?: string;
  reinstall?: { phase: "destroy" | "provision" | "done" | "failed"; requestedAt: string; completedAt?: string; error?: string };
}

function memoryState(): ServerModuleState {
  let data: Record<string, unknown> = {};
  return {
    get: async () => ({ ...data }),
    patch: async (patch) => {
      data = { ...data, ...patch };
      for (const [key, value] of Object.entries(patch)) if (value === undefined) delete data[key];
    },
  };
}

// ---------------------------------------------------------------------------
// Dependencies (injectable for tests)
// ---------------------------------------------------------------------------

export interface ProxmoxIpLease {
  address: string;
  prefix: number;
  gateway: string;
  dnsServers: string[];
  poolId: string;
  vlan: number | null;
}

export interface ProxmoxIpam {
  allocate(input: { serviceId: string; instanceId: string; poolId?: string }): Promise<ProxmoxIpLease>;
  release(serviceId: string): Promise<string[]>;
}

/** IPAM in the app DB (imported lazily: module files stay DB-free at import time). */
export const dbIpam: ProxmoxIpam = {
  async allocate({ serviceId, instanceId, poolId }) {
    const { allocateIp, listPoolsForInstance } = await import("@/lib/ipam");
    const { db } = await import("@/lib/db");
    const pool = poolId
      ? await db.ipPool.findUnique({ where: { id: poolId } })
      : ((await listPoolsForInstance(instanceId))[0] ?? null);
    if (!pool) {
      throw new Error(
        poolId
          ? `IP havuzu bulunamadı: ${poolId}`
          : "Bu Proxmox örneğine bağlı IP havuzu yok (IP havuzları ekranından bağlayın veya ürüne havuz seçin)."
      );
    }
    const address = await allocateIp(pool.id, serviceId);
    return {
      address: address.address,
      prefix: pool.prefix,
      gateway: pool.gateway,
      dnsServers: pool.dnsServers,
      poolId: pool.id,
      vlan: pool.vlan,
    };
  },
  async release(serviceId) {
    const { releaseIp } = await import("@/lib/ipam");
    return releaseIp(serviceId);
  },
};

export interface ProxmoxModuleDeps {
  transport?: ProxmoxTransport;
  runtime?: ProxmoxRuntime;
  ipam: ProxmoxIpam;
  generatePassword(): string;
}

const PASSWORD_CHARS = "abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function generateVmPassword(length = 20) {
  return Array.from({ length }, () => PASSWORD_CHARS[randomInt(PASSWORD_CHARS.length)]).join("");
}

const defaultDeps: ProxmoxModuleDeps = { ipam: dbIpam, generatePassword: () => generateVmPassword() };

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** VM name for a service: "kc-" + last 12 id characters (DNS-safe, unique enough; ownership is checked by marker). */
export function vmNameFor(serviceId: string) {
  return `kc-${serviceId.toLowerCase().replace(/[^a-z0-9]/g, "").slice(-12)}`;
}

/** Written into the VM description; the only proof a VM belongs to a service. */
export function ownerMarker(serviceId: string) {
  return `kleacore-service:${serviceId}`;
}

function isOwnedBy(config: VmConfig | null | undefined, serviceId: string) {
  return typeof config?.description === "string" && config.description.includes(ownerMarker(serviceId));
}

function errorText(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

const STEP_CODES: Record<string, string> = {
  lookup: "PROXMOX_LOOKUP",
  ip: "PROXMOX_IP",
  clone: "PROXMOX_CLONE",
  config: "PROXMOX_CONFIG",
  resize: "PROXMOX_RESIZE",
  start: "PROXMOX_START",
  destroy: "PROXMOX_DESTROY",
  power: "PROXMOX_POWER",
  usage: "PROXMOX_USAGE",
  resolve: "PROXMOX_VM",
};

function fail<T = { reference?: string }>(step: string, error: unknown): IntegrationResult<T> {
  return { ok: false, provider: MODULE_ID, error: `${STEP_CODES[step] ?? "PROXMOX"}: ${errorText(error)}` };
}

function parseVmid(remoteId: string | null | undefined) {
  const vmid = Number((remoteId ?? "").trim());
  return Number.isInteger(vmid) && vmid >= 100 ? vmid : null;
}

interface ClusterVm {
  vmid: number;
  name?: string;
  node: string;
  status?: string;
  template?: number;
  type?: string;
  tags?: string;
}

interface OwnedVm {
  vmid: number;
  node: string;
  config: VmConfig;
}

// ---------------------------------------------------------------------------
// Module
// ---------------------------------------------------------------------------

export function createProxmoxModule(
  instance: ResolvedModuleInstance<ProxmoxModuleConfig>,
  deps: ProxmoxModuleDeps = defaultDeps
): ServerModule<ProxmoxProductOptions> {
  const config = instance.config;
  const client: ProxmoxClient = createProxmoxClient(
    { apiUrl: config.apiUrl, tokenId: config.tokenId, tokenSecret: config.tokenSecret, verifyTls: config.verifyTls, caCert: config.caCert },
    { transport: deps.transport, runtime: deps.runtime }
  );
  const runtime = client.runtime;
  const taskTimeoutMs = config.taskTimeoutSeconds * 1000;
  const POWER_TIMEOUT_MS = Math.min(150_000, taskTimeoutMs);

  const qemu = (node: string, vmid: number, rest = "") =>
    `/nodes/${encodeURIComponent(node)}/qemu/${vmid}${rest}`;

  async function listVms(): Promise<ClusterVm[]> {
    const rows = await client.get<ClusterVm[]>("/cluster/resources", { type: "vm" });
    return (rows ?? []).filter((row) => row.type === undefined || row.type === "qemu");
  }

  async function getConfig(node: string, vmid: number) {
    return (await client.get<VmConfig>(qemu(node, vmid, "/config"))) ?? {};
  }

  async function getStatus(node: string, vmid: number) {
    return (await client.get<VmStatusCurrent>(qemu(node, vmid, "/status/current"))) ?? {};
  }

  /** Runs an async endpoint and waits for its task (or returns at once for sync answers). */
  async function runTask(
    state: ServerModuleState,
    start: () => Promise<unknown>,
    timeoutMs: number
  ): Promise<string | null> {
    const upid = await start();
    if (!isUpid(upid)) return null;
    await state.patch({ lastUpid: upid });
    await client.waitForTask(upid, { timeoutMs });
    return upid;
  }

  /** The service's VM (by remoteId), verified by owner marker. */
  async function resolveOwnedVm(ctx: Ctx): Promise<OwnedVm> {
    const vmid = parseVmid(ctx.service.remoteId);
    if (!vmid) throw new Error(`Geçersiz VMID: "${ctx.service.remoteId ?? ""}"`);
    const vm = (await listVms()).find((row) => row.vmid === vmid);
    if (!vm) throw new ProxmoxApiError(`VM ${vmid} Proxmox'ta bulunamadı`, 404, "/cluster/resources");
    const vmConfig = await getConfig(vm.node, vmid);
    if (!isOwnedBy(vmConfig, ctx.service.id)) {
      throw new Error(`VM ${vmid} bu hizmete ait değil (açıklamada ${ownerMarker(ctx.service.id)} yok); işlem yapılmadı`);
    }
    return { vmid, node: vm.node, config: vmConfig };
  }

  async function pickVmid(vms: ClusterVm[], exclude: Set<number>) {
    if (config.vmidEnd < config.vmidStart) throw new Error("VMID aralığı geçersiz (bitiş < başlangıç)");
    const used = new Set(vms.map((vm) => vm.vmid));
    let checks = 0;
    for (let vmid = config.vmidStart; vmid <= config.vmidEnd; vmid++) {
      if (used.has(vmid) || exclude.has(vmid)) continue;
      if (++checks > 25) break;
      try {
        // 200 = free cluster-wide (also covers IDs reserved by running tasks).
        await client.get("/cluster/nextid", { vmid });
        return vmid;
      } catch (error) {
        if (error instanceof ProxmoxApiError && error.status >= 400 && error.status < 500) {
          exclude.add(vmid);
          continue;
        }
        throw error;
      }
    }
    throw new Error(`VMID aralığında (${config.vmidStart}–${config.vmidEnd}) boş numara yok`);
  }

  /** The service's existing VM (resume), by stored/fixed VMID, then by name. */
  async function findOwnedVm(
    ctx: Ctx,
    vms: ClusterVm[],
    state: ProxmoxServiceState,
    fixedVmid?: number
  ): Promise<(OwnedVm & { cloning: boolean }) | null> {
    const name = vmNameFor(ctx.service.id);
    const preferred = fixedVmid ?? state.vmid;
    const byId = preferred ? vms.filter((vm) => vm.vmid === preferred) : [];
    const byName = vms.filter((vm) => vm.name === name && !vm.template && vm.vmid !== preferred);

    for (const vm of [...byId, ...byName]) {
      const vmConfig = await getConfig(vm.node, vm.vmid);
      if (isOwnedBy(vmConfig, ctx.service.id)) return { vmid: vm.vmid, node: vm.node, config: vmConfig, cloning: false };
      // A clone in progress has only a placeholder config (lock: clone) until it finishes.
      if (vm.vmid === state.vmid && vmConfig.lock === "clone" && state.cloneUpid) {
        return { vmid: vm.vmid, node: vm.node, config: vmConfig, cloning: true };
      }
      if (fixedVmid && vm.vmid === fixedVmid) {
        throw new Error(`VMID ${fixedVmid} başka bir VM tarafından kullanılıyor; yeniden kurulum durduruldu`);
      }
    }
    if (byName.length) {
      throw new Error(`"${name}" adlı VM var ama bu hizmete ait değil; yöneticinin incelemesi gerekiyor`);
    }
    return null;
  }

  async function cloneTemplate(
    ctx: Ctx,
    state: ServerModuleState,
    vms: ClusterVm[],
    deadline: number,
    fixedVmid?: number
  ): Promise<OwnedVm> {
    const { options } = ctx;
    const template = vms.find((vm) => vm.vmid === options.templateVmid);
    if (!template) throw new Error(`Şablon VM ${options.templateVmid} bulunamadı`);
    if (!template.template) throw new Error(`VM ${options.templateVmid} bir şablon değil`);

    const exclude = new Set<number>();
    for (let attempt = 0; attempt < 5; attempt++) {
      const vmid = fixedVmid ?? (await pickVmid(vms, exclude));
      let upid: unknown;
      try {
        upid = await client.post(qemu(template.node, options.templateVmid, "/clone"), {
          newid: vmid,
          name: vmNameFor(ctx.service.id),
          full: 1,
          storage: options.storage || config.defaultStorage,
          pool: config.pool || undefined,
          target: template.node !== config.node ? config.node : undefined,
          description: ownerMarker(ctx.service.id),
        });
      } catch (error) {
        if (error instanceof ProxmoxApiError && error.isConflict && !fixedVmid) {
          exclude.add(vmid); // someone took it between the check and the clone
          continue;
        }
        throw error;
      }
      await state.patch({ vmid, node: config.node, step: "cloning", cloneUpid: isUpid(upid) ? upid : undefined, lastUpid: isUpid(upid) ? upid : undefined });
      if (isUpid(upid)) await client.waitForTask(upid, { timeoutMs: Math.max(deadline - runtime.now(), 1_000) });
      await state.patch({ step: "cloned", cloneUpid: undefined });
      return { vmid, node: config.node, config: await getConfig(config.node, vmid) };
    }
    throw new Error("VMID çakışması 5 denemede çözülemedi");
  }

  async function waitUnlocked(vm: OwnedVm, deadline: number) {
    let current = vm.config;
    while (current.lock) {
      if (runtime.now() >= deadline) throw new ProxmoxTaskError(`VM ${vm.vmid} kilitli (${current.lock}); işlem sürüyor`, "", true);
      await runtime.sleep(2_000);
      current = await getConfig(vm.node, vm.vmid);
    }
    return current;
  }

  /**
   * The converge pipeline shared by createAccount and reinstall. Every step
   * re-checks the remote state first, so calling it again is safe.
   */
  async function provision(ctx: Ctx, fixedVmid?: number): Promise<IntegrationResult<ServerAccountCreated>> {
    const store = ctx.state ?? memoryState();
    const deadline = runtime.now() + taskTimeoutMs;
    let step = "lookup";
    try {
      const vms = await listVms();
      const state = (await store.get()) as ProxmoxServiceState;
      let vm: OwnedVm | null = await findOwnedVm(ctx, vms, state, fixedVmid);

      step = "ip";
      const lease = await deps.ipam.allocate({ serviceId: ctx.service.id, instanceId: instance.id, poolId: ctx.options.ipPoolId });
      await store.patch({
        ipAddress: lease.address,
        poolId: lease.poolId,
        osLabel: ctx.options.osLabel,
        ciUser: ctx.options.ciUser,
        ...(state.step ? {} : { step: "ip" }),
      });

      step = "clone";
      if (vm && "cloning" in vm && vm.cloning && state.cloneUpid) {
        await client.waitForTask(state.cloneUpid, { timeoutMs: Math.max(deadline - runtime.now(), 1_000) });
        await store.patch({ step: "cloned", cloneUpid: undefined });
        vm = { vmid: vm.vmid, node: vm.node, config: await getConfig(vm.node, vm.vmid) };
      }
      if (!vm && state.cloneUpid) {
        // Clone requested but the VM isn't listed yet: let the task finish, then look again.
        const task = await client.taskStatus(state.cloneUpid).catch(() => null);
        if (task?.status === "running") {
          await client.waitForTask(state.cloneUpid, { timeoutMs: Math.max(deadline - runtime.now(), 1_000) });
          vm = await findOwnedVm(ctx, await listVms(), (await store.get()) as ProxmoxServiceState, fixedVmid);
        }
      }
      if (!vm) vm = await cloneTemplate(ctx, store, vms, deadline, fixedVmid);
      const vmConfig = await waitUnlocked(vm, deadline);
      if (!isOwnedBy(vmConfig, ctx.service.id)) throw new Error(`VM ${vm.vmid} sahiplik işareti taşımıyor`);
      await store.patch({ vmid: vm.vmid, node: vm.node });

      step = "config";
      const fresh = (await store.get()) as ProxmoxServiceState;
      let password = fresh.passwordEnc ? decryptSecret(fresh.passwordEnc) : "";
      if (!password || password.startsWith("enc:")) {
        password = deps.generatePassword();
        await store.patch({ passwordEnc: encryptSecret(password), credentialsRevealedAt: undefined });
      }
      const nameservers = lease.dnsServers.length ? lease.dnsServers : config.nameservers;
      const net0 = rewriteNet0(
        typeof vmConfig.net0 === "string" ? vmConfig.net0 : undefined,
        ctx.options.bridge || config.bridge,
        ctx.options.vlan ?? lease.vlan
      );
      const sshKeys = (fresh.sshKeys ?? []).map((key) => key.trim()).filter(Boolean);
      await client.put(qemu(vm.node, vm.vmid, "/config"), {
        name: vmNameFor(ctx.service.id),
        description: `${ownerMarker(ctx.service.id)}\n${ctx.service.label || ctx.service.product.name}`,
        tags: VM_TAG,
        cores: ctx.options.cores,
        memory: ctx.options.memoryMB,
        onboot: 1,
        ciuser: ctx.options.ciUser,
        cipassword: password,
        ipconfig0: `ip=${lease.address}/${lease.prefix},gw=${lease.gateway}`,
        nameserver: nameservers.join(" "),
        // PVE expects sshkeys URL-encoded inside the (also encoded) form body.
        sshkeys: sshKeys.length ? encodeURIComponent(sshKeys.join("\n")) : undefined,
        net0: net0 ?? undefined,
        kvm: config.testDisableKvm ? 0 : undefined,
      });
      await store.patch({ step: "configured" });

      step = "resize";
      if (ctx.options.diskGB) await growDisk(store, vm, ctx.options.diskGB, deadline);
      await store.patch({ step: "resized" });

      step = "start";
      const status = await getStatus(vm.node, vm.vmid);
      if (status.status !== "running") {
        await runTask(store, () => client.post(qemu(vm!.node, vm!.vmid, "/status/start")), Math.max(deadline - runtime.now(), 1_000));
      }

      await store.patch({
        step: "done",
        completedAt: new Date(runtime.now()).toISOString(),
        lastError: undefined,
        lastErrorAt: undefined,
        needsAdmin: undefined,
        abandonedAt: undefined,
      });
      return {
        ok: true,
        provider: MODULE_ID,
        reference: String(vm.vmid),
        data: {
          remoteId: String(vm.vmid),
          ipAddress: lease.address,
          username: ctx.options.ciUser,
          hostname: vmNameFor(ctx.service.id),
          meta: { node: vm.node, vmid: vm.vmid },
        },
      };
    } catch (error) {
      const result = fail<ServerAccountCreated>(step, error);
      await store.patch({ lastError: result.error, lastErrorAt: new Date(runtime.now()).toISOString() }).catch(() => undefined);
      return result;
    }
  }

  async function growDisk(store: ServerModuleState, vm: OwnedVm, diskGB: number, deadline: number) {
    const vmConfig = await getConfig(vm.node, vm.vmid);
    const disk = findBootDisk(vmConfig);
    if (!disk) throw new Error("Önyükleme diski bulunamadı");
    const wanted = diskGB * 1024 ** 3;
    // Grow only: PVE can't shrink, and an equal size is already done.
    if (disk.sizeBytes !== null && disk.sizeBytes >= wanted) return;
    await runTask(
      store,
      () => client.put(qemu(vm.node, vm.vmid, "/resize"), { disk: disk.key, size: `${diskGB}G` }),
      Math.max(deadline - runtime.now(), 1_000)
    );
  }

  /** Runs `body` against the service's own VM; maps errors to { ok: false }. */
  async function onVm(
    ctx: Ctx,
    step: string,
    body: (vm: OwnedVm, store: ServerModuleState) => Promise<string | void>
  ): Promise<OperationResult> {
    const store = ctx.state ?? memoryState();
    let vm: OwnedVm;
    try {
      vm = await resolveOwnedVm(ctx);
    } catch (error) {
      return fail("resolve", error);
    }
    try {
      const reference = (await body(vm, store)) ?? String(vm.vmid);
      return { ok: true, provider: MODULE_ID, reference, data: { reference } };
    } catch (error) {
      const result = fail(step, error);
      await store.patch({ lastError: result.error, lastErrorAt: new Date(runtime.now()).toISOString() }).catch(() => undefined);
      return result;
    }
  }

  async function power(vm: OwnedVm, store: ServerModuleState, action: ServerPowerAction) {
    const status = await getStatus(vm.node, vm.vmid);
    const running = status.status === "running";
    const path = (verb: string) => qemu(vm.node, vm.vmid, `/status/${verb}`);
    switch (action) {
      case "start":
        if (!running) await runTask(store, () => client.post(path("start")), POWER_TIMEOUT_MS);
        return;
      case "stop":
        // Graceful ACPI shutdown, forced off after 60 s: "durdur" never leaves it running.
        if (running) await runTask(store, () => client.post(path("shutdown"), { timeout: 60, forceStop: 1 }), POWER_TIMEOUT_MS);
        return;
      case "shutdown":
        if (running) await runTask(store, () => client.post(path("shutdown"), { timeout: 120 }), POWER_TIMEOUT_MS);
        return;
      case "restart":
        if (running) await runTask(store, () => client.post(path("reboot"), { timeout: 60 }), POWER_TIMEOUT_MS);
        else await runTask(store, () => client.post(path("start")), POWER_TIMEOUT_MS);
        return;
    }
  }

  async function destroyVm(vm: OwnedVm, store: ServerModuleState, deadline: number) {
    const status = await getStatus(vm.node, vm.vmid);
    if (status.status === "running" || status.status === "paused") {
      await runTask(store, () => client.post(qemu(vm.node, vm.vmid, "/status/stop")), POWER_TIMEOUT_MS);
    }
    await runTask(
      store,
      () => client.del(qemu(vm.node, vm.vmid), { purge: 1, "destroy-unreferenced-disks": 1 }),
      Math.max(deadline - runtime.now(), 1_000)
    );
  }

  return {
    moduleId: MODULE_ID,

    createAccount: (ctx) => provision(ctx),

    // Suspend = stop (graceful, forced after 60 s) + onboot off. The customer
    // has no Proxmox access; the panel refuses to start a billing-suspended
    // server (server-power.ts), so no PVE lock is needed (a lock would also
    // block the admin and backups).
    suspend: (ctx) =>
      onVm(ctx, "power", async (vm, store) => {
        await power(vm, store, "stop");
        await client.put(qemu(vm.node, vm.vmid, "/config"), { onboot: 0 });
        await store.patch({ suspendedAt: new Date(runtime.now()).toISOString() });
      }),

    unsuspend: (ctx) =>
      onVm(ctx, "power", async (vm, store) => {
        await client.put(qemu(vm.node, vm.vmid, "/config"), { onboot: 1 });
        await power(vm, store, "start");
        await store.patch({ suspendedAt: undefined });
      }),

    // Only reached through an explicit admin action (service cancel / refund
    // that cancels the service). A VM that is already gone counts as done.
    async terminate(ctx) {
      const store = ctx.state ?? memoryState();
      const vmid = parseVmid(ctx.service.remoteId);
      if (!vmid) return fail("resolve", new Error(`Geçersiz VMID: "${ctx.service.remoteId ?? ""}"`));
      try {
        if (!(await listVms()).some((vm) => vm.vmid === vmid)) {
          await store.patch({ terminatedAt: new Date(runtime.now()).toISOString() });
          return { ok: true, provider: MODULE_ID, reference: String(vmid), data: { reference: String(vmid) } };
        }
      } catch (error) {
        return fail("resolve", error);
      }
      return onVm(ctx, "destroy", async (vm, state) => {
        await destroyVm(vm, state, runtime.now() + taskTimeoutMs);
        await state.patch({ terminatedAt: new Date(runtime.now()).toISOString(), step: undefined });
      });
    },

    // New product's cores / memory / disk (grow only). CPU and memory changes
    // of a running VM are applied by PVE at the next restart unless hotplug
    // is enabled in the template.
    changePackage: (ctx) =>
      onVm(ctx, "config", async (vm, store) => {
        await client.put(qemu(vm.node, vm.vmid, "/config"), { cores: ctx.options.cores, memory: ctx.options.memoryMB });
        if (ctx.options.diskGB) await growDisk(store, vm, ctx.options.diskGB, runtime.now() + taskTimeoutMs);
      }),

    powerAction: (ctx, action) => onVm(ctx, "power", (vm, store) => power(vm, store, action)),

    async getUsage(ctx): Promise<IntegrationResult<ServerUsage>> {
      try {
        const vm = await resolveOwnedVm(ctx);
        const status = await getStatus(vm.node, vm.vmid);
        const rrd = await client
          .get<RrdPoint[]>(qemu(vm.node, vm.vmid, "/rrddata"), { timeframe: "month", cf: "AVERAGE" })
          .catch(() => null);
        return { ok: true, provider: MODULE_ID, data: parseUsage(status, rrd, new Date(runtime.now())) };
      } catch (error) {
        return fail<ServerUsage>("usage", error);
      }
    },

    /**
     * Re-clone from the template keeping VMID and IP: destroy (owned VM only)
     * → the provision pipeline with a fixed VMID. Resumable through
     * state.reinstall.phase; a new initial password is generated (or the
     * customer's) and must be revealed again.
     */
    async reinstall(ctx, input) {
      const store = ctx.state ?? memoryState();
      const vmid = parseVmid(ctx.service.remoteId);
      if (!vmid) return fail("resolve", new Error(`Geçersiz VMID: "${ctx.service.remoteId ?? ""}"`));
      let state: ProxmoxServiceState;
      try {
        state = (await store.get()) as ProxmoxServiceState;
      } catch (error) {
        return fail("resolve", error);
      }
      const now = () => new Date(runtime.now()).toISOString();
      let reinstall = state.reinstall;
      if (!reinstall || reinstall.phase === "done" || reinstall.phase === "failed") {
        reinstall = { phase: "destroy", requestedAt: now() };
        await store.patch({
          reinstall,
          ...(input.sshKeys ? { sshKeys: input.sshKeys } : {}),
        });
      }

      if (reinstall.phase === "destroy") {
        try {
          const exists = (await listVms()).some((vm) => vm.vmid === vmid);
          if (exists) {
            const vm = await resolveOwnedVm(ctx);
            await destroyVm(vm, store, runtime.now() + taskTimeoutMs);
          }
        } catch (error) {
          const result = fail("destroy", error);
          await store.patch({ lastError: result.error, lastErrorAt: now() }).catch(() => undefined);
          return result;
        }
        reinstall = { ...reinstall, phase: "provision" };
        await store.patch({
          reinstall,
          step: undefined,
          cloneUpid: undefined,
          passwordEnc: input.password ? encryptSecret(input.password) : undefined,
          credentialsRevealedAt: undefined,
        });
      }

      const result = await provision(ctx, vmid);
      if (!result.ok) return { ok: false, provider: MODULE_ID, error: result.error };
      await store.patch({ reinstall: { ...reinstall, phase: "done", completedAt: now() } });
      return { ok: true, provider: MODULE_ID, reference: String(vmid), data: { reference: String(vmid) } };
    },

    async abandonProvisioning(ctx) {
      try {
        const released = await abandonProxmoxProvisioning(ctx, deps.ipam);
        return { ok: true, provider: MODULE_ID, reference: released.join(",") || undefined };
      } catch (error) {
        return fail("ip", error);
      }
    },

    async listAccounts(): Promise<IntegrationResult<RemoteAccount[]>> {
      try {
        const vms = await listVms();
        return {
          ok: true,
          provider: MODULE_ID,
          data: vms
            .filter((vm) => !vm.template)
            .map((vm) => ({
              remoteId: String(vm.vmid),
              username: vm.name,
              status: vm.status === "running" ? "active" : vm.status === "stopped" ? "stopped" : "unknown",
              raw: { node: vm.node, tags: vm.tags ?? null, managed: (vm.tags ?? "").split(/[;,\s]/).includes(VM_TAG) },
            })),
        };
      } catch (error) {
        return fail<RemoteAccount[]>("lookup", error);
      }
    },
  };
}

/**
 * Given up after the last retry (provisioning job FAILED): release the
 * service's IPs and flag the admin. The VM (if any) is left untouched —
 * never deleted automatically; "Proxmox'ta yeniden dene" resumes on it.
 */
export async function abandonProxmoxProvisioning(
  ctx: Pick<Ctx, "service" | "state">,
  ipam: Pick<ProxmoxIpam, "release"> = dbIpam
) {
  const store = ctx.state ?? memoryState();
  const state = (await store.get()) as ProxmoxServiceState;
  const released = await ipam.release(ctx.service.id);
  await store.patch({
    abandonedAt: new Date().toISOString(),
    ipAddress: undefined,
    needsAdmin: state.vmid
      ? `Kurulum yarıda kaldı: VM ${state.vmid} (${state.node ?? "?"}) Proxmox'ta bırakıldı, IP ${released.join(", ") || "-"} havuza döndü. VM'i inceleyip silin veya "Proxmox'ta yeniden dene" ile devam edin.`
      : `Kurulum başarısız; VM oluşturulmadı. IP ${released.join(", ") || "-"} havuza döndü.`,
  });
  return released;
}

export const proxmoxModule = defineModule({
  id: MODULE_ID,
  kind: "server",
  name: "Proxmox VE",
  description:
    "VDS/VPS: cloud-init şablonundan tam klon, IP havuzundan adres, CPU/RAM/disk ayarı, güç işlemleri, kullanım ve yeniden kurulum (API token ile).",
  configSchema: proxmoxConfigSchema,
  secretFields: ["tokenSecret"],
  configFields: {
    apiUrl: { label: "API adresi", placeholder: "https://188.132.235.28:8006", hint: "Proxmox web arayüzünün adresi (port 8006)." },
    tokenId: { label: "API token kimliği", placeholder: "kleacore@pve!kleacore", hint: "kullanıcı@realm!token-adı" },
    tokenSecret: { label: "API token gizli anahtarı", hint: "Token oluşturulurken bir kez gösterilen UUID." },
    node: { label: "Node adı", placeholder: "pve", hint: "VM'lerin açılacağı node (Datacenter → Nodes)." },
    verifyTls: {
      label: "TLS sertifikasını doğrula",
      hint: "Kapatmak yalnızca test içindir. Kendinden imzalı sertifika için kapatmak yerine aşağıya PVE kök sertifikasını ekleyin.",
    },
    caCert: {
      label: "PVE kök sertifikası (PEM)",
      multiline: true,
      hint: "/etc/pve/pve-root-ca.pem içeriği. Doluysa sertifika bu CA ile doğrulanır.",
    },
    defaultStorage: { label: "Varsayılan depolama", placeholder: "local-lvm" },
    bridge: { label: "Ağ köprüsü", placeholder: "vmbr0" },
    vmidStart: { label: "VMID aralığı başlangıcı" },
    vmidEnd: { label: "VMID aralığı bitişi" },
    pool: { label: "Kaynak havuzu (pool)", hint: "Doluysa yeni VM'ler bu havuza eklenir; token yetkisi havuz üzerinden verilebilir." },
    nameservers: { label: "DNS sunucuları", hint: "IP havuzunda DNS tanımlı değilse kullanılır." },
    taskTimeoutSeconds: {
      label: "Görev bekleme süresi (sn)",
      hint: "Klon/başlatma için bir denemede beklenecek en uzun süre. Aşılırsa iş sonraki denemede kaldığı yerden sürer.",
    },
    testDisableKvm: {
      label: "Yalnızca test: KVM kapalı (kvm: 0)",
      hint: "İç içe sanallaştırmada KVM yoksa VM'ler yazılımsal emülasyonla (çok yavaş) açılır. Üretimde kapalı tutun.",
    },
  },
  capabilities: ["provision", "changePackage", "usage", "power", "reinstall", "listAccounts", "ipam"],
  productCategories: ["vds", "vps", "server", "cloud"],
  productOptionsSchema: proxmoxProductOptionsSchema,
  productOptionsFields: {
    templateVmid: { label: "Şablon VMID", placeholder: "9000", hint: "cloud-init hazır şablon (ör. 9000 tpl-ubuntu-2204)." },
    cores: { label: "vCPU" },
    memoryMB: { label: "RAM (MB)", placeholder: "2048" },
    diskGB: { label: "Disk (GB)", hint: "Şablon diski bu boyuta büyütülür (küçültme yapılmaz)." },
    storage: { label: "Depolama (isteğe bağlı)", hint: "Boşsa örneğin varsayılan depolaması." },
    bridge: { label: "Ağ köprüsü (isteğe bağlı)", hint: "Boşsa örneğin köprüsü." },
    vlan: { label: "VLAN etiketi (isteğe bağlı)", hint: "Boşsa IP havuzunun VLAN'ı." },
    ipPoolId: { label: "IP havuzu kimliği (isteğe bağlı)", hint: "Boşsa örneğe bağlı ilk IP havuzu." },
    osLabel: { label: "İşletim sistemi adı", placeholder: "Ubuntu 22.04 LTS", hint: "Müşteri panelinde gösterilir." },
    ciUser: { label: "Varsayılan kullanıcı adı (cloud-init)", placeholder: "kleacore" },
  },
  async healthCheck(instance) {
    const config = instance.config;
    if (config.vmidEnd < config.vmidStart) return { ok: false, message: "VMID aralığı geçersiz (bitiş < başlangıç)." };
    try {
      const client = createProxmoxClient({
        apiUrl: config.apiUrl,
        tokenId: config.tokenId,
        tokenSecret: config.tokenSecret,
        verifyTls: config.verifyTls,
        caCert: config.caCert,
        requestTimeoutMs: 10_000,
      });
      const version = await client.get<{ version?: string; release?: string }>("/version");
      const node = await client.get<{ uptime?: number; pveversion?: string }>(`/nodes/${encodeURIComponent(config.node)}/status`);
      const warnings = [!config.verifyTls ? "TLS doğrulaması kapalı" : "", config.testDisableKvm ? "KVM kapalı (test)" : ""].filter(Boolean);
      return {
        ok: true,
        message: `Proxmox VE ${version?.version ?? "?"} · node ${config.node} çevrimiçi${warnings.length ? ` (${warnings.join(", ")})` : ""}.`,
        details: { version: version?.version, release: version?.release, uptime: node?.uptime },
      };
    } catch (error) {
      return { ok: false, message: errorText(error) };
    }
  },
  create: (instance) => createProxmoxModule(instance),
});
