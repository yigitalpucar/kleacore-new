import { PgBoss } from "pg-boss";
import { createLogger } from "@/lib/logger";
import { jobRegistry } from "./definitions";

const log = createLogger("jobs");

/** pg-boss keeps its tables in its own schema, next to Prisma's `public`. */
export const JOBS_SCHEMA = "pgboss";

export type JobsRole = "web" | "worker";

const globalForBoss = globalThis as unknown as {
  kleacoreBoss?: Promise<PgBoss>;
  kleacoreBossRole?: JobsRole;
};

/**
 * The worker entry calls this before anything touches the queue. The web
 * process (default) never runs pg-boss maintenance timers on its own; the
 * drain cron triggers maintenance explicitly instead.
 */
export function configureJobsRole(role: JobsRole) {
  globalForBoss.kleacoreBossRole = role;
}

export function getJobsRole(): JobsRole {
  return globalForBoss.kleacoreBossRole ?? "web";
}

async function createBoss(): Promise<PgBoss> {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set");
  }

  const role = getJobsRole();
  const boss = new PgBoss({
    connectionString,
    schema: JOBS_SCHEMA,
    application_name: `kleacore-jobs-${role}`,
    max: Number(process.env.JOBS_POOL_MAX) || (role === "worker" ? 6 : 3),
    supervise: role === "worker",
    // Recurring schedules stay in Dokploy (see docs/ops-cron.md).
    schedule: false,
  });

  boss.on("error", (error) => log.error("pg-boss error", { error, role }));

  await boss.start();
  await ensureQueues(boss);
  return boss;
}

/** Creates (or updates) one pg-boss queue per registered job. Idempotent. */
export async function ensureQueues(boss: PgBoss) {
  for (const definition of jobRegistry.all()) {
    const { policy, ...options } = definition.queue;
    const existing = await boss.getQueue(definition.name);
    if (!existing) {
      await boss.createQueue(definition.name, { policy, ...options });
    } else {
      // Policy can't change after creation; retry/expiry settings can.
      await boss.updateQueue(definition.name, options);
    }
  }
}

/** Lazily started, process-wide pg-boss instance. */
export function getBoss(): Promise<PgBoss> {
  if (!globalForBoss.kleacoreBoss) {
    globalForBoss.kleacoreBoss = createBoss().catch((error) => {
      globalForBoss.kleacoreBoss = undefined;
      throw error;
    });
  }
  return globalForBoss.kleacoreBoss;
}

export async function stopBoss(options?: { graceful?: boolean; timeout?: number }) {
  const pending = globalForBoss.kleacoreBoss;
  globalForBoss.kleacoreBoss = undefined;
  if (!pending) return;
  const boss = await pending.catch(() => null);
  await boss?.stop({ graceful: options?.graceful ?? true, timeout: options?.timeout ?? 30_000 });
}
