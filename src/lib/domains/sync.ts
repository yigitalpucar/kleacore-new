import type { DomainStatus, Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { formatDate } from "@/lib/format/date";
import { getDomainInfoFromRegistrar, type RegistrarDomainInfo } from "@/lib/integrations/registrar";
import { getRegistrarConfig, isGriRegistrarEnabled } from "@/lib/integrations/registrar/config";
import type { CronJobResult } from "@/lib/cron/jobs/types";
import { domainLog, recordDomainEvent } from "./lifecycle";

/**
 * Daily registrar status sync (roadmap 1.3): pulls expiry, status and
 * nameservers from Gri and reconciles the Domain row. Registrar values only
 * ever fill in or correct data — a missing/empty registrar value never
 * overwrites ours. Every change is logged as a lifecycle event.
 */

const DEFAULT_BATCH_SIZE = 200;
const DEFAULT_DELAY_MS = 400;
const SYNC_STATUSES: DomainStatus[] = ["ACTIVE", "TRANSFERRING", "EXPIRED"];

/** Gri/EPP status string → our status; null when unknown (left unchanged). */
export function mapRegistrarStatus(raw: string | null | undefined): DomainStatus | null {
  const value = raw?.trim().toLowerCase().replace(/[\s-]+/g, "_");
  if (!value) return null;
  if (["active", "ok", "registered", "client_transfer_prohibited", "clienttransferprohibited"].includes(value)) {
    return "ACTIVE";
  }
  if (value.includes("transfer") && !value.includes("prohibited")) return "TRANSFERRING";
  if (value.includes("expired") || value.includes("redemption") || value.includes("pending_delete") || value.includes("pendingdelete")) {
    return "EXPIRED";
  }
  return null;
}

interface LocalDomainState {
  expiresAt: Date;
  status: DomainStatus;
  nameservers: unknown;
}

export interface DomainSyncDiff {
  field: "expiresAt" | "status" | "nameservers";
  from: string;
  to: string;
}

function normalizeNameservers(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((ns): ns is string => typeof ns === "string")
    .map((ns) => ns.trim().toLowerCase().replace(/\.$/, ""))
    .filter(Boolean);
}

/** Pure diff: which fields of the Domain row the registrar's info changes. */
export function reconcileDomain(local: LocalDomainState, remote: RegistrarDomainInfo) {
  const data: Prisma.DomainUpdateInput = {};
  const diffs: DomainSyncDiff[] = [];

  const remoteExpiry = remote.expiresAt;
  if (
    remoteExpiry instanceof Date &&
    !Number.isNaN(remoteExpiry.getTime()) &&
    remoteExpiry.getTime() > 0 &&
    // Same day = same expiry (registrars report midnight / time zones differently).
    Math.abs(remoteExpiry.getTime() - local.expiresAt.getTime()) >= 86_400_000
  ) {
    data.expiresAt = remoteExpiry;
    diffs.push({ field: "expiresAt", from: local.expiresAt.toISOString(), to: remoteExpiry.toISOString() });
  }

  let status = mapRegistrarStatus(remote.status);
  // An expiry the registrar moved into the future means the domain is live.
  if (status === null && data.expiresAt && remoteExpiry && remoteExpiry > new Date() && local.status === "EXPIRED") {
    status = "ACTIVE";
  }
  if (status && status !== local.status) {
    data.status = status;
    diffs.push({ field: "status", from: local.status, to: status });
  }

  const remoteNs = normalizeNameservers(remote.nameservers);
  const localNs = normalizeNameservers(local.nameservers);
  if (remoteNs.length > 0 && remoteNs.join(",") !== localNs.join(",")) {
    data.nameservers = remoteNs;
    diffs.push({ field: "nameservers", from: localNs.join(", ") || "—", to: remoteNs.join(", ") });
  }

  return { data, diffs };
}

function describeDiff(diff: DomainSyncDiff) {
  switch (diff.field) {
    case "expiresAt":
      return `bitiş ${formatDate(diff.from)} → ${formatDate(diff.to)}`;
    case "status":
      return `durum ${diff.from} → ${diff.to}`;
    case "nameservers":
      return `nameserver ${diff.from} → ${diff.to}`;
  }
}

export type SyncOneResult =
  | { ok: true; changed: boolean; diffs: DomainSyncDiff[] }
  | { ok: false; skipped?: boolean; error: string };

/** Syncs one domain (also used by the admin "senkronize et" action). */
export async function syncDomainWithRegistrar(domainId: string, actorId: string | null = null): Promise<SyncOneResult> {
  const domain = await db.domain.findUnique({
    where: { id: domainId },
    select: { id: true, name: true, expiresAt: true, status: true, nameservers: true },
  });
  if (!domain) return { ok: false, error: "DOMAIN_NOT_FOUND" };

  const info = await getDomainInfoFromRegistrar(domain.name);
  if (!info.ok || !info.data) {
    const error = info.error ?? "REGISTRAR_INFO_FAILED";
    if (!info.skipped) {
      await recordDomainEvent({
        domainId,
        type: "sync.failed",
        message: `Registrar senkronu başarısız: ${error}`,
        details: { error },
        actorId,
      });
    }
    return { ok: false, skipped: info.skipped, error };
  }

  const { data, diffs } = reconcileDomain(domain, info.data);
  await db.domain.update({
    where: { id: domainId },
    data: { ...data, lastSyncedAt: new Date() },
  });

  if (diffs.length > 0) {
    domainLog.info("domain synced from registrar", { domain: domain.name, diffs });
    await recordDomainEvent({
      domainId,
      type: "sync.updated",
      message: `Registrar senkronu: ${diffs.map(describeDiff).join("; ")}`,
      details: { diffs: diffs as unknown as Prisma.InputJsonValue, registrarStatus: info.data.status ?? null },
      actorId,
    });
  }

  return { ok: true, changed: diffs.length > 0, diffs };
}

export interface SyncOptions {
  batchSize?: number;
  delayMs?: number;
  sleep?: (ms: number) => Promise<void>;
}

const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * Daily: syncs ACTIVE/TRANSFERRING/EXPIRED domains, least recently synced
 * first, one request at a time with a delay (rate-limit friendly). No-ops
 * with a clear summary when Gri isn't enabled/configured.
 */
export async function syncDomainsWithRegistrar(options: SyncOptions = {}): Promise<CronJobResult & Record<string, unknown>> {
  const config = await getRegistrarConfig();
  if (!isGriRegistrarEnabled(config)) {
    return {
      processed: 0,
      skipped: 0,
      registrar: "not-configured",
      message: "Gri registrar etkin değil veya API bilgileri eksik; senkron atlandı",
    };
  }

  const batchSize = options.batchSize ?? DEFAULT_BATCH_SIZE;
  const delayMs = options.delayMs ?? DEFAULT_DELAY_MS;
  const sleep = options.sleep ?? defaultSleep;

  const domains = await db.domain.findMany({
    where: { status: { in: SYNC_STATUSES } },
    select: { id: true },
    orderBy: [{ lastSyncedAt: { sort: "asc", nulls: "first" } }, { expiresAt: "asc" }],
    take: batchSize,
  });

  const ids: string[] = [];
  let unchanged = 0;
  let failed = 0;

  for (const [index, domain] of domains.entries()) {
    if (index > 0 && delayMs > 0) await sleep(delayMs);
    try {
      const result = await syncDomainWithRegistrar(domain.id);
      if (!result.ok) failed += 1;
      else if (result.changed) ids.push(domain.id);
      else unchanged += 1;
    } catch (error) {
      failed += 1;
      domainLog.error("domain sync failed", { domainId: domain.id, error });
    }
  }

  return { processed: ids.length, skipped: unchanged, unchanged, failed, checked: domains.length, ids };
}
