/**
 * Pure helpers for Proxmox VE API payloads (no I/O): VM config parsing (boot
 * disk, size, net0), usage from /status/current + /rrddata.
 */
import type { ServerUsage } from "../../contracts";

const MB = 1024 * 1024;
const DISK_KEY = /^(scsi|virtio|sata|ide)\d+$/;

export type VmConfig = Record<string, string | number | undefined>;

/** "10G" / "2252M" / "512K" / "1T" → bytes (null when unparseable). */
export function parseSize(value: string | undefined | null): number | null {
  const match = /^(\d+(?:\.\d+)?)([KMGT])?$/i.exec((value ?? "").trim());
  if (!match) return null;
  const factor = { K: 1024, M: MB, G: 1024 * MB, T: 1024 * 1024 * MB }[(match[2] ?? "").toUpperCase() as "K"] ?? 1;
  return Math.round(Number(match[1]) * factor);
}

/** Option list "a=1,b=2,first" → { a: "1", b: "2", _: "first" } (first positional value under "_"). */
export function parsePropertyString(value: string) {
  const out: Record<string, string> = {};
  value.split(",").forEach((part, index) => {
    const eq = part.indexOf("=");
    if (eq === -1) {
      if (index === 0) out._ = part;
      else out[part] = "1";
    } else {
      out[part.slice(0, eq)] = part.slice(eq + 1);
    }
  });
  return out;
}

function isDataDisk(value: unknown) {
  if (typeof value !== "string") return false;
  const props = parsePropertyString(value);
  return props.media !== "cdrom" && !/cloudinit/.test(props._ ?? "") && !/cloudinit/.test(value);
}

/**
 * The VM's boot disk: first data disk of `boot: order=…`, else the legacy
 * `bootdisk`, else the first scsi/virtio/sata/ide data disk.
 */
export function findBootDisk(config: VmConfig): { key: string; sizeBytes: number | null } | null {
  const ordered: string[] = [];
  const boot = typeof config.boot === "string" ? config.boot : "";
  const order = /order=([^,]+)/.exec(boot)?.[1];
  if (order) ordered.push(...order.split(";"));
  if (typeof config.bootdisk === "string") ordered.push(config.bootdisk);
  ordered.push(...Object.keys(config).filter((key) => DISK_KEY.test(key)).sort());

  for (const key of ordered) {
    if (!DISK_KEY.test(key) || !isDataDisk(config[key])) continue;
    const size = parsePropertyString(String(config[key])).size;
    return { key, sizeBytes: parseSize(size) };
  }
  return null;
}

/**
 * net0 with bridge / VLAN tag replaced, keeping model + MAC (so the guest's
 * interface name stays stable). Returns null when nothing changes.
 */
export function rewriteNet0(net0: string | undefined, bridge: string, vlan: number | null | undefined): string | null {
  if (!net0) return `virtio,bridge=${bridge}${vlan ? `,tag=${vlan}` : ""}`;
  const entries = net0.split(",").map((part) => {
    const eq = part.indexOf("=");
    return eq === -1 ? ([part, null] as const) : ([part.slice(0, eq), part.slice(eq + 1)] as const);
  });
  const next: Array<readonly [string, string | null]> = entries.filter(([key]) => key !== "bridge" && key !== "tag");
  // Model=MAC first, then bridge/tag, then the rest (firewall, rate, …) as PVE writes it.
  next.splice(1, 0, ["bridge", bridge], ...(vlan ? [["tag", String(vlan)] as const] : []));
  const after = next.map(([key, value]) => (value === null ? key : `${key}=${value}`)).join(",");
  const normalise = (value: string) => value.split(",").sort().join(",");
  return normalise(after) === normalise(net0) ? null : after;
}

export interface VmStatusCurrent {
  status?: string;
  qmpstatus?: string;
  cpu?: number;
  cpus?: number;
  mem?: number;
  maxmem?: number;
  disk?: number;
  maxdisk?: number;
  netin?: number;
  netout?: number;
  uptime?: number;
  lock?: string;
  name?: string;
}

export interface RrdPoint {
  time: number;
  netin?: number;
  netout?: number;
  cpu?: number;
  mem?: number;
}

function finite(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

export function powerStateOf(status: VmStatusCurrent | null | undefined): ServerUsage["powerState"] {
  if (!status?.status) return "unknown";
  if (status.status === "running") return status.qmpstatus === "paused" || status.qmpstatus === "suspended" ? "paused" : "running";
  if (status.status === "stopped") return "stopped";
  return "unknown";
}

/**
 * Usage of a VM: CPU % (`cpu` is the fraction of its vCPUs), RAM, disk size
 * (qemu reports no in-guest disk usage without the guest agent → diskUsedMB
 * only when > 0), traffic since the start of the month from rrddata
 * (bytes/s averages × step).
 */
export function parseUsage(status: VmStatusCurrent, rrd: RrdPoint[] | null | undefined, now: Date): ServerUsage {
  const usage: ServerUsage = { collectedAt: now, powerState: powerStateOf(status) };
  const cpu = finite(status.cpu);
  if (cpu !== undefined) usage.cpuPercent = Math.round(Math.min(Math.max(cpu, 0), 1) * 1000) / 10;
  const mem = finite(status.mem);
  const maxmem = finite(status.maxmem);
  if (maxmem) {
    usage.ramLimitMB = Math.round(maxmem / MB);
    usage.ramUsedMB = Math.round((mem ?? 0) / MB);
  }
  const maxdisk = finite(status.maxdisk);
  if (maxdisk) usage.diskLimitMB = Math.round(maxdisk / MB);
  const disk = finite(status.disk);
  if (disk && disk > 0) usage.diskUsedMB = Math.round(disk / MB);

  const points = (rrd ?? []).filter((point) => finite(point.time) !== undefined).sort((a, b) => a.time - b.time);
  if (points.length) {
    const monthStart = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1) / 1000;
    let bytes = 0;
    for (let index = 0; index < points.length; index++) {
      const point = points[index];
      if (point.time < monthStart) continue;
      const next = points[index + 1];
      const previous = points[index - 1];
      const step = next ? next.time - point.time : previous ? point.time - previous.time : 60;
      bytes += ((finite(point.netin) ?? 0) + (finite(point.netout) ?? 0)) * step;
    }
    usage.bandwidthUsedMB = Math.round(bytes / MB);
  }
  return usage;
}
