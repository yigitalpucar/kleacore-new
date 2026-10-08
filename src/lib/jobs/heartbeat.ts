import { db } from "@/lib/db";

/** A worker/drain that hasn't checked in for this long makes /api/health "degraded". */
export function workerStaleAfterMs() {
  const minutes = Number(process.env.JOBS_WORKER_STALE_MINUTES);
  return (Number.isFinite(minutes) && minutes > 0 ? minutes : 5) * 60 * 1000;
}

export async function recordHeartbeat(id: string, kind: "drain" | "worker", info?: Record<string, unknown>) {
  const now = new Date();
  await db.jobWorkerHeartbeat.upsert({
    where: { id },
    create: { id, kind, lastSeenAt: now, startedAt: now, info: info as never },
    update: { lastSeenAt: now, ...(info ? { info: info as never } : {}) },
  });
}

export type WorkerHealth = {
  status: "ok" | "idle";
  lastSeenAt: Date | null;
};

/** Most recent check-in of any worker or drain run. */
export async function getWorkerHealth(now = new Date()): Promise<WorkerHealth> {
  const latest = await db.jobWorkerHeartbeat.findFirst({
    orderBy: { lastSeenAt: "desc" },
    select: { lastSeenAt: true },
  });
  const lastSeenAt = latest?.lastSeenAt ?? null;
  const fresh = lastSeenAt !== null && now.getTime() - lastSeenAt.getTime() <= workerStaleAfterMs();
  return { status: fresh ? "ok" : "idle", lastSeenAt };
}
