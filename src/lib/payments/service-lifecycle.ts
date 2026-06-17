import type { Prisma } from "@prisma/client";

export async function unsuspendServiceIfNeeded(
  tx: Prisma.TransactionClient,
  serviceId: string
): Promise<{ unsuspended: boolean }> {
  const service = await tx.service.findUnique({
    where: { id: serviceId },
    select: {
      id: true,
      status: true,
    },
  });

  if (!service || service.status !== "SUSPENDED") {
    return { unsuspended: false };
  }

  await tx.service.update({
    where: { id: serviceId },
    data: {
      status: "ACTIVE",
      suspendedAt: null,
      suspendReason: null,
    },
  });

  return { unsuspended: true };
}