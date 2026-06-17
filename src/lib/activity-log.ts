import { headers } from "next/headers";
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

  try {
    const headersList = await headers();
    return (
      headersList.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      headersList.get("x-real-ip") ||
      null
    );
  } catch {
    return null;
  }
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