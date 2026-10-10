/**
 * Bulk actions on admin lists (UI3 item 11): run an existing single-item
 * action for each selected id, one after the other, and report what failed.
 * The single action keeps all of its own checks, events and side effects;
 * this only loops, records an activity row per successful item (unless the
 * single action already writes one) and collects the errors.
 */
import { randomUUID } from "node:crypto";
import { logActivity } from "@/lib/activity-log";
import { createLogger } from "@/lib/logger";

const log = createLogger("admin.bulk");

/** Most rows one bulk request may touch (a page of the admin lists is 100). */
export const BULK_MAX_ITEMS = 200;

export type SingleActionResult = { success: boolean; error?: string } | { success: true; [key: string]: unknown };

export interface BulkFailure {
  id: string;
  error: string;
}

export interface BulkResult {
  success: boolean;
  /** Ids processed (after de-duplication). */
  total: number;
  succeeded: number;
  failed: BulkFailure[];
  /** Whole-request problem (no ids, too many ids); nothing was run. */
  error?: string;
}

export interface BulkOptions {
  actorId: string;
  /** Activity row per successful item; omit when the single action logs itself. */
  activity?: { action: string; entity: string; details?: Record<string, unknown> };
}

export function normalizeBulkIds(ids: unknown): string[] {
  if (!Array.isArray(ids)) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const id of ids) {
    if (typeof id !== "string") continue;
    const trimmed = id.trim();
    if (!trimmed || trimmed.length > 64 || seen.has(trimmed)) continue;
    seen.add(trimmed);
    out.push(trimmed);
  }
  return out;
}

export async function runBulk(
  rawIds: unknown,
  run: (id: string) => Promise<SingleActionResult>,
  options: BulkOptions
): Promise<BulkResult> {
  const ids = normalizeBulkIds(rawIds);
  if (ids.length === 0) return { success: false, total: 0, succeeded: 0, failed: [], error: "Kayıt seçilmedi" };
  if (ids.length > BULK_MAX_ITEMS) {
    return {
      success: false,
      total: ids.length,
      succeeded: 0,
      failed: [],
      error: `Tek seferde en fazla ${BULK_MAX_ITEMS} kayıt işlenebilir`,
    };
  }

  const batchId = randomUUID();
  const failed: BulkFailure[] = [];
  let succeeded = 0;

  for (const id of ids) {
    let result: SingleActionResult;
    try {
      result = await run(id);
    } catch (error) {
      log.error("bulk item failed", { id, error });
      result = { success: false, error: "Beklenmeyen bir hata oluştu" };
    }
    if (!result.success) {
      failed.push({ id, error: ("error" in result && typeof result.error === "string" && result.error) || "İşlem başarısız" });
      continue;
    }
    succeeded += 1;
    if (options.activity) {
      try {
        await logActivity({
          userId: options.actorId,
          action: options.activity.action,
          entity: options.activity.entity,
          entityId: id,
          details: { ...options.activity.details, bulk: true, batchId },
        });
      } catch (error) {
        // The item itself succeeded; a missing audit row must not undo it.
        log.error("bulk activity log failed", { id, error });
      }
    }
  }

  return { success: failed.length === 0, total: ids.length, succeeded, failed };
}
