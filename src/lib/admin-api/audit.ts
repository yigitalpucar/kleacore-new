/**
 * Every admin API call made with a known token is written to the activity
 * log (action ADMIN_API_REQUEST, entity StaffApiToken, user = token owner),
 * so /yonetim/aktivite shows who/what called which endpoint from where.
 * Calls with an unknown token have no owner to attribute and are only logged
 * to the application log.
 */
import { db } from "@/lib/db";
import { createLogger } from "@/lib/logger";

const log = createLogger("admin-api.audit");

export const ADMIN_API_AUDIT_ACTION = "ADMIN_API_REQUEST";

export interface AdminApiAuditEntry {
  ownerId: string;
  tokenId: string;
  tokenName: string;
  operationId: string;
  method: string;
  /** Route template, e.g. /customers/{id}. */
  endpoint: string;
  /** Actual path incl. ids, e.g. /api/admin/v1/customers/cus_1. */
  path: string;
  status: number;
  ip: string | null;
  durationMs: number;
  requestId: string;
  errorCode?: string;
  replayed?: boolean;
}

export async function auditAdminApiCall(entry: AdminApiAuditEntry) {
  try {
    await db.activityLog.create({
      data: {
        userId: entry.ownerId,
        action: ADMIN_API_AUDIT_ACTION,
        entity: "StaffApiToken",
        entityId: entry.tokenId,
        ipAddress: entry.ip,
        details: {
          token: entry.tokenName,
          operation: entry.operationId,
          method: entry.method,
          endpoint: entry.endpoint,
          path: entry.path,
          status: entry.status,
          durationMs: entry.durationMs,
          requestId: entry.requestId,
          ...(entry.errorCode ? { error: entry.errorCode } : {}),
          ...(entry.replayed ? { idempotentReplay: true } : {}),
        },
      },
    });
  } catch (error) {
    log.error("admin api audit write failed", { tokenId: entry.tokenId, path: entry.path, error });
  }
}

export function logUnattributedCall(entry: { method: string; path: string; status: number; ip: string | null; errorCode: string }) {
  log.warn("admin api call without a valid token", entry);
}
