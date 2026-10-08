/**
 * Proxmox VMs for the importer.
 *
 * The Proxmox server module is built on a parallel branch, so the importer
 * depends only on this small interface:
 *
 *   interface VirtualMachineLister { listVirtualMachines(): Promise<IntegrationResult<RemoteVirtualMachine[]>> }
 *
 * `getVirtualMachineLister(contract, config)` uses the module's own
 * `listVirtualMachines()` when the contract has one (integration: implement
 * it in src/lib/modules/server/proxmox and this file needs no change), else
 * the read-only HTTP adapter below against the instance config
 * `{ apiUrl, tokenId, tokenSecret, node? }` — the field names in
 * docs/modules.md §7. Only GET requests are made.
 *
 * Self-signed PVE certificates: Node's fetch rejects them. The adapter takes
 * an optional `fetchImpl` so the Proxmox module can pass its own TLS-aware
 * fetch (undici Agent with the pinned CA / fingerprint).
 */
import type { IntegrationResult } from "@/lib/integrations/settings";
import type { ImportedVirtualMachine } from "../types";
import { ImportSourceError, mapLimit } from "./errors";

export interface RemoteVirtualMachine {
  vmid: number;
  name: string;
  node: string;
  type: "qemu" | "lxc";
  status: "running" | "stopped" | "unknown";
  cores?: number;
  memoryMB?: number;
  diskGB?: number;
  ipAddresses: string[];
  createdAt?: Date;
}

export interface VirtualMachineLister {
  listVirtualMachines(): Promise<IntegrationResult<RemoteVirtualMachine[]>>;
}

export interface ProxmoxHttpConfig {
  apiUrl: string;
  tokenId: string;
  tokenSecret: string;
  /** Limit to one node; empty = every node of the cluster. */
  node?: string;
}

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

const REQUEST_TIMEOUT_MS = 15_000;
const IPV4 = /^(\d{1,3}\.){3}\d{1,3}$/;

interface ClusterResource {
  id?: string;
  vmid?: number;
  name?: string;
  node?: string;
  type?: string;
  status?: string;
  template?: number;
  maxcpu?: number;
  maxmem?: number;
  maxdisk?: number;
}

function isPublicUsableIpv4(address: string) {
  if (!IPV4.test(address)) return false;
  return !address.startsWith("127.") && !address.startsWith("169.254.");
}

/** "ip=188.132.235.40/24,gw=…" (qemu ipconfigN / lxc netN) → "188.132.235.40". */
export function ipFromNetConfig(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const match = /(?:^|,)ip=([\d.]+)(?:\/\d+)?/.exec(value);
  return match && isPublicUsableIpv4(match[1]) ? match[1] : null;
}

/** "local-lvm:vm-100-disk-0,size=40G" → 40. */
export function diskSizeGB(value: unknown): number | null {
  if (typeof value !== "string") return null;
  const match = /size=([\d.]+)([KMGT])?/i.exec(value);
  if (!match) return null;
  const amount = Number(match[1]);
  const unit = (match[2] ?? "G").toUpperCase();
  const factor = { K: 1 / (1024 * 1024), M: 1 / 1024, G: 1, T: 1024 }[unit as "K" | "M" | "G" | "T"];
  return Math.round(amount * factor * 100) / 100;
}

/** Sums the disks of a qemu/lxc config (scsi0, virtio1, rootfs, mp0 …; cdroms ignored). */
export function totalDiskGB(config: Record<string, unknown>) {
  let total = 0;
  let found = false;
  for (const [key, value] of Object.entries(config)) {
    if (!/^(scsi|virtio|sata|ide|rootfs|mp)\d*$/.test(key)) continue;
    if (typeof value === "string" && value.includes("media=cdrom")) continue;
    const size = diskSizeGB(value);
    if (size !== null) {
      total += size;
      found = true;
    }
  }
  return found ? Math.round(total * 100) / 100 : null;
}

function ctimeOf(meta: unknown) {
  if (typeof meta !== "string") return undefined;
  const match = /ctime=(\d+)/.exec(meta);
  return match ? new Date(Number(match[1]) * 1000) : undefined;
}

function toNumber(value: unknown) {
  const number = typeof value === "number" ? value : typeof value === "string" ? Number(value) : Number.NaN;
  return Number.isFinite(number) ? number : undefined;
}

/** Read-only Proxmox VE API adapter (GET only). */
export function createProxmoxHttpLister(
  config: ProxmoxHttpConfig,
  fetchImpl: FetchLike = (input, init) => fetch(input, init)
): VirtualMachineLister {
  const base = config.apiUrl.replace(/\/+$/, "").replace(/\/api2\/json$/, "");
  const authorization = `PVEAPIToken=${config.tokenId}=${config.tokenSecret}`;

  async function get<T>(path: string): Promise<T> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const response = await fetchImpl(`${base}/api2/json${path}`, {
        method: "GET",
        headers: { authorization, accept: "application/json" },
        signal: controller.signal,
      });
      if (!response.ok) throw new Error(`HTTP_${response.status}`);
      const payload = (await response.json()) as { data?: T };
      return payload.data as T;
    } finally {
      clearTimeout(timeout);
    }
  }

  async function guestIps(resource: Required<Pick<ClusterResource, "node" | "vmid">> & { type: "qemu" | "lxc" }, cfg: Record<string, unknown>, running: boolean) {
    const ips = new Set<string>();
    for (const [key, value] of Object.entries(cfg)) {
      if (/^(ipconfig|net)\d+$/.test(key)) {
        const ip = ipFromNetConfig(value);
        if (ip) ips.add(ip);
      }
    }
    if (resource.type === "qemu" && running && ips.size === 0) {
      // Guest agent (optional): fails when the agent is not installed/running — ignored.
      try {
        const agent = await get<{ result?: Array<{ name?: string; "ip-addresses"?: Array<{ "ip-address"?: string; "ip-address-type"?: string }> }> }>(
          `/nodes/${encodeURIComponent(resource.node)}/qemu/${resource.vmid}/agent/network-get-interfaces`
        );
        for (const iface of agent?.result ?? []) {
          if (iface.name === "lo") continue;
          for (const address of iface["ip-addresses"] ?? []) {
            if (address["ip-address-type"] === "ipv4" && address["ip-address"] && isPublicUsableIpv4(address["ip-address"])) {
              ips.add(address["ip-address"]);
            }
          }
        }
      } catch {
        // no agent
      }
    }
    return [...ips];
  }

  return {
    async listVirtualMachines() {
      try {
        const resources = (await get<ClusterResource[]>("/cluster/resources?type=vm")) ?? [];
        const vms = resources.filter(
          (r) =>
            (r.type === "qemu" || r.type === "lxc") &&
            !r.template &&
            typeof r.vmid === "number" &&
            r.node &&
            (!config.node || r.node === config.node)
        );
        const data = await mapLimit(vms, 4, async (r): Promise<RemoteVirtualMachine> => {
          const type = r.type as "qemu" | "lxc";
          const node = r.node!;
          const vmid = r.vmid!;
          const cfg = (await get<Record<string, unknown>>(`/nodes/${encodeURIComponent(node)}/${type}/${vmid}/config`)) ?? {};
          const status = r.status === "running" ? "running" : r.status === "stopped" ? "stopped" : "unknown";
          const sockets = toNumber(cfg.sockets) ?? 1;
          const cores = toNumber(cfg.cores);
          return {
            vmid,
            name: (typeof cfg.name === "string" && cfg.name) || (typeof cfg.hostname === "string" && cfg.hostname) || r.name || `vm-${vmid}`,
            node,
            type,
            status,
            cores: cores !== undefined ? cores * sockets : r.maxcpu,
            memoryMB: toNumber(cfg.memory) ?? (r.maxmem ? Math.round(r.maxmem / 1024 / 1024) : undefined),
            diskGB: totalDiskGB(cfg) ?? (r.maxdisk ? Math.round(r.maxdisk / 1024 ** 3) : undefined),
            ipAddresses: await guestIps({ node, vmid, type }, cfg, status === "running"),
            createdAt: ctimeOf(cfg.meta),
          };
        });
        return { ok: true, provider: "proxmox", data };
      } catch (error) {
        const message = error instanceof Error ? (error.name === "AbortError" ? "PROXMOX_TIMEOUT" : error.message) : "PROXMOX_ERROR";
        return { ok: false, provider: "proxmox", error: message };
      }
    },
  };
}

function isProxmoxHttpConfig(config: Record<string, unknown>): config is Record<string, unknown> & ProxmoxHttpConfig {
  return ["apiUrl", "tokenId", "tokenSecret"].every((key) => typeof config[key] === "string" && config[key] !== "");
}

/** The module's own lister when it has one, else the HTTP adapter over the instance config. */
export function getVirtualMachineLister(contract: unknown, config: Record<string, unknown>, fetchImpl?: FetchLike): VirtualMachineLister {
  const own = contract as Partial<VirtualMachineLister> | null;
  if (own && typeof own.listVirtualMachines === "function") {
    return { listVirtualMachines: () => own.listVirtualMachines!() };
  }
  if (!isProxmoxHttpConfig(config)) {
    throw new ImportSourceError("Proxmox örneğinin ayarlarında apiUrl / tokenId / tokenSecret bulunamadı.");
  }
  return createProxmoxHttpLister(
    { apiUrl: config.apiUrl, tokenId: config.tokenId, tokenSecret: config.tokenSecret, node: typeof config.node === "string" ? config.node : undefined },
    fetchImpl
  );
}

export function toImportedVirtualMachine(vm: RemoteVirtualMachine): ImportedVirtualMachine {
  return {
    kind: "vm",
    remoteId: String(vm.vmid),
    name: vm.name,
    node: vm.node,
    status: vm.status,
    cores: vm.cores ?? null,
    memoryMB: vm.memoryMB ?? null,
    diskGB: vm.diskGB ?? null,
    ipAddresses: vm.ipAddresses,
    createdAt: vm.createdAt ? vm.createdAt.toISOString() : null,
  };
}

export async function listProxmoxVirtualMachines(lister: VirtualMachineLister): Promise<ImportedVirtualMachine[]> {
  const result = await lister.listVirtualMachines();
  if (!result.ok) throw new ImportSourceError(`VM listesi alınamadı: ${result.error ?? "bilinmeyen hata"}`);
  return (result.data ?? []).map(toImportedVirtualMachine);
}
