import type { PgBoss } from "pg-boss";
import { getBoss, JOBS_SCHEMA } from "./boss";
import { jobRegistry } from "./definitions";

/**
 * Read/modify helpers for the admin "İşler" screen. Listing goes straight to
 * pg-boss's job table because pg-boss has no cross-queue "failed jobs" API;
 * every state change goes through the public pg-boss API.
 */

export type QueueJobState = "created" | "retry" | "active" | "completed" | "cancelled" | "failed";

export interface QueueStatsRow {
  name: string;
  label: string;
  created: number;
  retry: number;
  active: number;
  completed: number;
  failed: number;
  cancelled: number;
}

export interface QueueJobRow {
  id: string;
  name: string;
  label: string;
  state: QueueJobState;
  data: unknown;
  error: string | null;
  retryCount: number;
  retryLimit: number;
  singletonKey: string | null;
  createdOn: Date;
  startAfter: Date;
  completedOn: Date | null;
}

const STATES: QueueJobState[] = ["created", "retry", "active", "completed", "failed", "cancelled"];

function labelFor(name: string) {
  return jobRegistry.has(name) ? jobRegistry.get(name).label : name;
}

export function extractJobError(output: unknown): string | null {
  if (!output || typeof output !== "object") return output ? String(output) : null;
  const value = output as Record<string, unknown>;
  if (typeof value.message === "string") return value.message;
  if (value.value !== undefined) return String(value.value);
  return JSON.stringify(output);
}

export async function getQueueStats(boss?: PgBoss): Promise<QueueStatsRow[]> {
  const instance = boss ?? (await getBoss());
  const { rows } = await instance
    .getDb()
    .executeSql(`SELECT name, state::text AS state, count(*)::int AS count FROM ${JOBS_SCHEMA}.job GROUP BY name, state`);

  const byName = new Map<string, QueueStatsRow>();
  for (const name of jobRegistry.names()) {
    byName.set(name, { name, label: labelFor(name), created: 0, retry: 0, active: 0, completed: 0, failed: 0, cancelled: 0 });
  }
  for (const row of rows as Array<{ name: string; state: QueueJobState; count: number }>) {
    if (!STATES.includes(row.state)) continue;
    const entry =
      byName.get(row.name) ??
      { name: row.name, label: labelFor(row.name), created: 0, retry: 0, active: 0, completed: 0, failed: 0, cancelled: 0 };
    entry[row.state] = Number(row.count);
    byName.set(row.name, entry);
  }
  return [...byName.values()];
}

/** Jobs that need attention: terminally failed, or failed once and waiting for a retry. */
export async function listProblemJobs(limit = 100, boss?: PgBoss): Promise<QueueJobRow[]> {
  const instance = boss ?? (await getBoss());
  const { rows } = await instance.getDb().executeSql(
    `SELECT id::text AS id, name, state::text AS state, data, output, retry_count AS "retryCount",
            retry_limit AS "retryLimit", singleton_key AS "singletonKey", created_on AS "createdOn",
            start_after AS "startAfter", completed_on AS "completedOn"
       FROM ${JOBS_SCHEMA}.job
      WHERE state = 'failed' OR (state = 'retry' AND output IS NOT NULL)
      ORDER BY COALESCE(completed_on, start_after) DESC
      LIMIT $1`,
    [limit]
  );

  return (rows as Array<Record<string, unknown>>).map((row) => ({
    id: String(row.id),
    name: String(row.name),
    label: labelFor(String(row.name)),
    state: row.state as QueueJobState,
    data: row.data,
    error: extractJobError(row.output),
    retryCount: Number(row.retryCount),
    retryLimit: Number(row.retryLimit),
    singletonKey: (row.singletonKey as string | null) ?? null,
    createdOn: new Date(row.createdOn as string),
    startAfter: new Date(row.startAfter as string),
    completedOn: row.completedOn ? new Date(row.completedOn as string) : null,
  }));
}

export async function findQueueJob(name: string, id: string, boss?: PgBoss) {
  const instance = boss ?? (await getBoss());
  const [job] = await instance.findJobs(name, { id });
  return job ?? null;
}

/** Puts a failed job back in the queue for one more attempt. */
export async function retryQueueJob(name: string, id: string, boss?: PgBoss) {
  const instance = boss ?? (await getBoss());
  const job = await findQueueJob(name, id, instance);
  if (!job) return { ok: false as const, error: "JOB_NOT_FOUND" };
  if (job.state !== "failed") return { ok: false as const, error: "JOB_NOT_FAILED" };
  await instance.retry(name, id);
  return { ok: true as const };
}

/** Cancels a queued/retrying job, or dismisses a failed one from the list. */
export async function cancelQueueJob(name: string, id: string, boss?: PgBoss) {
  const instance = boss ?? (await getBoss());
  const job = await findQueueJob(name, id, instance);
  if (!job) return { ok: false as const, error: "JOB_NOT_FOUND" };
  if (job.state === "active") return { ok: false as const, error: "JOB_ACTIVE" };
  if (job.state === "completed" || job.state === "cancelled") return { ok: false as const, error: "JOB_FINISHED" };
  if (job.state === "failed") {
    await instance.deleteJob(name, id);
  } else {
    await instance.cancel(name, id);
  }
  return { ok: true as const };
}
