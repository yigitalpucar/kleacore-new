import { getRequestIp } from "@/lib/request-meta";
import { db } from "@/lib/db";
import type { Prisma } from "@prisma/client";

export interface LogActivityParams {
  userId: string;
  action: string;
  entity: string;
  entityId?: string;
  details?: Prisma.InputJsonValue | null;
  ipAddress?: string;
}

async function resolveIpAddress(explicit?: string): Promise<string | null> {
  if (explicit) {
    return explicit;
  }

  return getRequestIp();
}

export async function logActivity(params: LogActivityParams) {
  const ipAddress = await resolveIpAddress(params.ipAddress);

  await db.activityLog.create({
    data: {
      userId: params.userId,
      action: params.action,
      entity: params.entity,
      entityId: params.entityId ?? null,
      details: params.details ?? undefined,
      ipAddress,
    },
  });
}