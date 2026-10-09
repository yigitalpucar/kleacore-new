import { db } from "@/lib/db";
import { getQueueStats, listProblemJobs, type QueueJobRow, type QueueStatsRow } from "@/lib/jobs/admin";
import { workerStaleAfterMs } from "@/lib/jobs/heartbeat";
import { createLogger } from "@/lib/logger";

const log = createLogger("dal.jobs");

/** Turkish names of the cron routes (src/app/api/cron/*). */
export const CRON_JOB_LABELS: Record<string, string> = {
  "daily-billing": "Günlük faturalama",
  "run-backups": "Yedeklemeler",
  "ssl-expiry": "SSL süre kontrolü",
  "overdue-invoices": "Gecikmiş faturalar",
  "suspend-services": "Hizmet askıya alma",
  "retry-provisioning": "Provisioning kuyruk eşitleme",
  "efatura-status": "E-Fatura durum sorgusu",
  "usage-sync": "Hosting kullanım senkronu (kuyruğa alma)",
  "support-mail": "Destek e-postaları (IMAP → ticket)",
  "support-autoclose": "Destek talebi otomatik kapatma",
  "kyc-retention": "Reddedilen KYC belgelerinin silinmesi",
  notifications: "Fatura bildirimleri ve bildirim kuyruğu eşitleme",
  "jobs-drain": "İş kuyruğu (drain)",
};

export interface JobsDashboard {
  queueAvailable: boolean;
  stats: QueueStatsRow[];
  problems: Array<Omit<QueueJobRow, "createdOn" | "startAfter" | "completedOn" | "data"> & {
    createdOn: string;
    startAfter: string;
    completedOn: string | null;
    dataPreview: string;
  }>;
  cronRuns: Array<{
    id: string;
    job: string;
    label: string;
    status: string;
    startedAt: string;
    finishedAt: string | null;
    durationMs: number | null;
    summary: string | null;
    error: string | null;
  }>;
  workers: Array<{ id: string; kind: string; lastSeenAt: string; startedAt: string; fresh: boolean }>;
}

function preview(value: unknown, max = 160) {
  if (value === null || value === undefined) return "";
  const text = typeof value === "string" ? value : JSON.stringify(value);
  return text.length > max ? `${text.slice(0, max)}…` : text;
}

export async function getJobsDashboard(): Promise<JobsDashboard> {
  const now = Date.now();
  const staleMs = workerStaleAfterMs();

  const [cronRuns, heartbeats] = await Promise.all([
    db.cronRun.findMany({ orderBy: { startedAt: "desc" }, take: 60 }),
    db.jobWorkerHeartbeat.findMany({ orderBy: { lastSeenAt: "desc" } }),
  ]);

  let queueAvailable = true;
  let stats: QueueStatsRow[] = [];
  let problems: QueueJobRow[] = [];
  try {
    [stats, problems] = await Promise.all([getQueueStats(), listProblemJobs(100)]);
  } catch (error) {
    queueAvailable = false;
    log.error("job queue unavailable", { error });
  }

  return {
    queueAvailable,
    stats,
    problems: problems.map(({ data, createdOn, startAfter, completedOn, ...job }) => ({
      ...job,
      createdOn: createdOn.toISOString(),
      startAfter: startAfter.toISOString(),
      completedOn: completedOn?.toISOString() ?? null,
      dataPreview: preview(data),
    })),
    cronRuns: cronRuns.map((run) => ({
      id: run.id,
      job: run.job,
      label: CRON_JOB_LABELS[run.job] ?? run.job,
      status: run.status,
      startedAt: run.startedAt.toISOString(),
      finishedAt: run.finishedAt?.toISOString() ?? null,
      durationMs: run.durationMs,
      summary: run.summary ? preview(run.summary, 240) : null,
      error: run.error,
    })),
    workers: heartbeats.map((hb) => ({
      id: hb.id,
      kind: hb.kind,
      lastSeenAt: hb.lastSeenAt.toISOString(),
      startedAt: hb.startedAt.toISOString(),
      fresh: now - hb.lastSeenAt.getTime() <= staleMs,
    })),
  };
}
