import type { BillingPeriod, Prisma } from "@prisma/client";

const billingMonths: Record<BillingPeriod, number> = {
  monthly: 1,
  quarterly: 3,
  semiannual: 6,
  yearly: 12,
  biennial: 24,
  triennial: 36,
};

function addMonths(date: Date, months: number) {
  const next = new Date(date);
  next.setMonth(next.getMonth() + months);
  return next;
}

function parseRenewalMonths(configuration: unknown): number | null {
  if (!configuration || typeof configuration !== "object" || Array.isArray(configuration)) {
    return null;
  }

  const renewalMonths = (configuration as Record<string, unknown>).renewalMonths;
  if (typeof renewalMonths !== "number" || !Number.isFinite(renewalMonths) || renewalMonths <= 0) {
    return null;
  }

  return Math.round(renewalMonths);
}

export async function applyServiceRenewalFromOrder(
  tx: Prisma.TransactionClient,
  orderId: string
): Promise<{ applied: boolean; serviceId?: string; newExpiryDate?: Date }> {
  const order = await tx.order.findUnique({
    where: { id: orderId },
    include: {
      items: true,
    },
  });

  if (!order?.serviceId) {
    return { applied: false };
  }

  const renewalMonths = parseRenewalMonths(order.items.at(0)?.configuration);
  if (!renewalMonths) {
    return { applied: false };
  }

  const service = await tx.service.findUnique({
    where: { id: order.serviceId },
    select: {
      id: true,
      status: true,
      nextDueDate: true,
      expiresAt: true,
    },
  });

  if (!service) {
    throw new Error("SERVICE_NOT_FOUND");
  }

  const now = new Date();
  const currentExpiry = service.nextDueDate ?? service.expiresAt ?? now;
  const renewalBaseDate =
    currentExpiry.getTime() > now.getTime() ? currentExpiry : now;
  const newExpiryDate = addMonths(renewalBaseDate, renewalMonths);

  await tx.service.update({
    where: { id: service.id },
    data: {
      status: "ACTIVE",
      billingPeriod: order.billingPeriod,
      // Pre-tax, pre-discount amount for the renewed period (see
      // provisioning/internal.ts) so the next renewal adds KDV exactly once.
      amount: order.basePrice,
      nextDueDate: newExpiryDate,
      expiresAt: newExpiryDate,
      suspendedAt: null,
      suspendReason: null,
    },
  });

  return {
    applied: true,
    serviceId: service.id,
    newExpiryDate,
  };
}

export function isRenewalOrder(
  order: {
    serviceId: string | null;
    items: Array<{ configuration: unknown }>;
  } | null
) {
  if (!order?.serviceId) {
    return false;
  }

  return parseRenewalMonths(order.items.at(0)?.configuration) !== null;
}

export { billingMonths };