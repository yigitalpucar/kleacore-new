/**
 * Daily hosting usage sync (Faz 2.6). The `usage-sync` cron (advisory lock +
 * CronRun) enqueues one `hosting.usage-sync` job per server module instance
 * that supports bulk usage reads; each job reads every account's disk and
 * this month's bandwidth in a couple of panel calls (WHM: listaccts + showbw)
 * and writes them onto the instance's services.
 *
 * Units: the module reports MB; Service.disk* / bandwidth* are GB (what every
 * screen shows). A null limit means "unlimited" on the panel.
 */
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { createLogger } from "@/lib/logger";
import { HOSTING_USAGE_SYNC_JOB } from "@/lib/jobs/definitions";
import type { ServerUsage } from "@/lib/modules/contracts";

const log = createLogger("services.usage-sync");

/** Statuses whose usage is worth tracking (cancelled accounts are gone). */
const SYNC_STATUSES = ["ACTIVE", "SUSPENDED"] as const;

const mbToGb = (mb: number) => Math.round((mb / 1024) * 1000) / 1000;

/** Service columns for one account's usage; untouched when the panel didn't report a value. */
export function usageToServiceData(usage: ServerUsage, syncedAt: Date): Prisma.ServiceUpdateInput {
  const data: Prisma.ServiceUpdateInput = { usageSyncedAt: syncedAt };
  if (typeof usage.diskUsedMB === "number") data.diskUsed = mbToGb(usage.diskUsedMB);
  if (usage.diskLimitMB !== undefined) data.diskLimit = usage.diskLimitMB === null ? null : mbToGb(usage.diskLimitMB);
  if (typeof usage.bandwidthUsedMB === "number") data.bandwidthUsed = mbToGb(usage.bandwidthUsedMB);
  if (usage.bandwidthLimitMB !== undefined) {
    data.bandwidthLimit = usage.bandwidthLimitMB === null ? null : mbToGb(usage.bandwidthLimitMB);
  }
  return data;
}

/** Instances whose module declares `bulkUsage` and that hold at least one live service. */
export async function listUsageSyncInstanceIds(): Promise<string[]> {
  const { getModule } = await import("@/lib/modules/registry");
  const rows = await db.moduleInstance.findMany({
    // Inactive instances still host existing accounts.
    where: { kind: "server", services: { some: { status: { in: [...SYNC_STATUSES] } } } },
    select: { id: true, moduleId: true },
    orderBy: { createdAt: "asc" },
  });
  return rows
    .filter((row) => (getModule(row.moduleId)?.capabilities as readonly string[] | undefined)?.includes("bulkUsage"))
    .map((row) => row.id);
}

/** Cron body: one queued job per instance (deduplicated per instance). */
export async function enqueueHostingUsageSync() {
  const instanceIds = await listUsageSyncInstanceIds();
  const { enqueue } = await import("@/lib/jobs/enqueue");
  let deduplicated = 0;
  for (const instanceId of instanceIds) {
    const result = await enqueue(HOSTING_USAGE_SYNC_JOB, { instanceId }, { singletonKey: instanceId });
    if (result.deduplicated) deduplicated += 1;
  }
  return { processed: instanceIds.length - deduplicated, skipped: deduplicated, ids: instanceIds };
}

export interface InstanceUsageSyncResult {
  instanceId: string;
  /** Services updated. */
  updated: number;
  /** Live services whose account the panel didn't list (renamed / removed remotely). */
  missing: string[];
  skipped?: string;
}

/**
 * Job body: reads the instance's usage once and updates its services.
 * Throws on a panel error so pg-boss retries the job.
 */
export async function syncInstanceUsage(instanceId: string): Promise<InstanceUsageSyncResult> {
  const { getInstance, createContract } = await import("@/lib/modules/instances");
  const instance = await getInstance(instanceId);
  if (!instance) return { instanceId, updated: 0, missing: [], skipped: "MODULE_INSTANCE_NOT_FOUND" };

  const server = createContract(instance, "server");
  if (!server.listUsage) return { instanceId, updated: 0, missing: [], skipped: "BULK_USAGE_NOT_SUPPORTED" };

  const result = await server.listUsage();
  if (!result.ok || !result.data) throw new Error(`USAGE_SYNC_FAILED: ${result.error ?? "unknown"}`);

  const byRemoteId = new Map(result.data.map((row) => [row.remoteId.toLowerCase(), row.usage]));
  const services = await db.service.findMany({
    where: { moduleInstanceId: instanceId, status: { in: [...SYNC_STATUSES] } },
    select: { id: true, remoteId: true, username: true },
  });

  const syncedAt = new Date();
  const updates: Prisma.PrismaPromise<unknown>[] = [];
  const missing: string[] = [];
  for (const service of services) {
    const key = (service.remoteId || service.username || "").toLowerCase();
    const usage = key ? byRemoteId.get(key) : undefined;
    if (!usage) {
      missing.push(service.id);
      continue;
    }
    updates.push(db.service.update({ where: { id: service.id }, data: usageToServiceData(usage, syncedAt) }));
  }
  if (updates.length) await db.$transaction(updates);

  if (missing.length) log.warn("accounts missing on the panel", { instanceId, missing: missing.length });
  return { instanceId, updated: updates.length, missing };
}

/** Services at or over their disk or bandwidth quota (admin list). */
export async function listOverQuotaServices(limit = 200) {
  return db.service.findMany({
    where: {
      status: { in: [...SYNC_STATUSES] },
      usageSyncedAt: { not: null },
      OR: [
        { diskLimit: { gt: 0 }, diskUsed: { gte: db.service.fields.diskLimit } },
        { bandwidthLimit: { gt: 0 }, bandwidthUsed: { gte: db.service.fields.bandwidthLimit } },
      ],
    },
    select: {
      id: true,
      label: true,
      domain: true,
      remoteId: true,
      status: true,
      diskUsed: true,
      diskLimit: true,
      bandwidthUsed: true,
      bandwidthLimit: true,
      usageSyncedAt: true,
      customer: { select: { id: true, name: true, surname: true, email: true } },
      product: { select: { name: true } },
      moduleInstance: { select: { id: true, label: true } },
    },
    orderBy: { usageSyncedAt: "desc" },
    take: limit,
  });
}
