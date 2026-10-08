import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { MIN_PAYOUT_AMOUNT } from "@/lib/affiliate/constants";
import { add, compare, money, roundHalfUp, sub, toNumber, type MoneyInput } from "@/lib/money";

export { MIN_PAYOUT_AMOUNT };

type DbClient = Prisma.TransactionClient | typeof db;

export class AffiliatePayoutError extends Error {
  constructor(
    message: string,
    public readonly code:
      | "INVALID_AMOUNT"
      | "BELOW_MINIMUM"
      | "INSUFFICIENT_BALANCE"
      | "NOT_FOUND"
      | "INVALID_STATUS"
  ) {
    super(message);
    this.name = "AffiliatePayoutError";
  }
}

function parseReferralIds(value: Prisma.JsonValue | null | undefined): string[] {
  if (!value || !Array.isArray(value)) {
    return [];
  }

  return value.filter((item): item is string => typeof item === "string");
}

export async function getAffiliateBalance(
  affiliateId: string,
  client: DbClient = db
): Promise<number> {
  const [commissionAggregate, paymentAggregate] = await Promise.all([
    client.affiliateReferral.aggregate({
      where: { affiliateId },
      _sum: { commission: true },
    }),
    client.affiliatePayment.aggregate({
      where: {
        affiliateId,
        status: { in: ["PENDING", "PAID"] },
      },
      _sum: { amount: true },
    }),
  ]);

  return toNumber(sub(commissionAggregate._sum.commission, paymentAggregate._sum.amount));
}

async function selectReferralsForPayout(
  tx: Prisma.TransactionClient,
  affiliateId: string,
  amount: MoneyInput
) {
  const referrals = await tx.affiliateReferral.findMany({
    where: {
      affiliateId,
      isPaid: false,
      commission: { gt: 0 },
    },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      commission: true,
    },
  });

  const selectedIds: string[] = [];
  let allocated = money(0);

  for (const referral of referrals) {
    if (compare(allocated, amount) >= 0) {
      break;
    }

    selectedIds.push(referral.id);
    allocated = add(allocated, referral.commission);
  }

  return selectedIds;
}

function normalizeIban(value: string | null | undefined) {
  return value?.replace(/\s+/g, "").toUpperCase() ?? "";
}

export function isValidPayoutIban(value: string | null | undefined) {
  const iban = normalizeIban(value);
  if (iban.length < 15) {
    return false;
  }
  if (iban.startsWith("TR") && iban.length !== 26) {
    return false;
  }
  return true;
}

export async function requestAffiliatePayout(affiliateId: string, amount: number) {
  if (!Number.isFinite(amount)) {
    throw new AffiliatePayoutError("Geçerli bir tutar girin", "INVALID_AMOUNT");
  }

  const normalizedAmount = roundHalfUp(amount);

  if (compare(normalizedAmount, 0) <= 0) {
    throw new AffiliatePayoutError("Geçerli bir tutar girin", "INVALID_AMOUNT");
  }

  if (compare(normalizedAmount, MIN_PAYOUT_AMOUNT) < 0) {
    throw new AffiliatePayoutError(
      `Minimum ödeme talep tutarı ${MIN_PAYOUT_AMOUNT} TL'dir`,
      "BELOW_MINIMUM"
    );
  }

  const affiliate = await db.user.findUnique({
    where: { id: affiliateId },
    select: { affiliatePayoutIban: true },
  });

  if (!isValidPayoutIban(affiliate?.affiliatePayoutIban)) {
    throw new AffiliatePayoutError(
      "Ödeme talebi için geçerli bir IBAN tanımlamanız gerekiyor",
      "INVALID_AMOUNT"
    );
  }

  return db.$transaction(async (tx) => {
    const balance = await getAffiliateBalance(affiliateId, tx);

    if (compare(normalizedAmount, balance) > 0) {
      throw new AffiliatePayoutError(
        "Talep edilen tutar kullanılabilir bakiyeden fazla",
        "INSUFFICIENT_BALANCE"
      );
    }

    const referralIds = await selectReferralsForPayout(
      tx,
      affiliateId,
      normalizedAmount
    );

    if (referralIds.length > 0) {
      await tx.affiliateReferral.updateMany({
        where: { id: { in: referralIds } },
        data: { isPaid: true },
      });
    }

    return tx.affiliatePayment.create({
      data: {
        affiliateId,
        amount: normalizedAmount,
        status: "PENDING",
        referralIds: referralIds.length > 0 ? referralIds : undefined,
      },
    });
  });
}

export async function approveAffiliatePayout(paymentId: string, adminId: string) {
  const payment = await db.affiliatePayment.findUnique({
    where: { id: paymentId },
  });

  if (!payment) {
    throw new AffiliatePayoutError("Ödeme talebi bulunamadı", "NOT_FOUND");
  }

  if (payment.status !== "PENDING") {
    throw new AffiliatePayoutError("Bu talep işlenemez", "INVALID_STATUS");
  }

  return db.affiliatePayment.update({
    where: { id: paymentId },
    data: {
      processedBy: adminId,
      notes: payment.notes ?? "Yönetici tarafından onaylandı",
    },
  });
}

export async function rejectAffiliatePayout(
  paymentId: string,
  adminId: string,
  reason?: string
) {
  return db.$transaction(async (tx) => {
    const payment = await tx.affiliatePayment.findUnique({
      where: { id: paymentId },
    });

    if (!payment) {
      throw new AffiliatePayoutError("Ödeme talebi bulunamadı", "NOT_FOUND");
    }

    if (payment.status !== "PENDING") {
      throw new AffiliatePayoutError("Bu talep işlenemez", "INVALID_STATUS");
    }

    const referralIds = parseReferralIds(payment.referralIds);

    if (referralIds.length > 0) {
      await tx.affiliateReferral.updateMany({
        where: { id: { in: referralIds } },
        data: { isPaid: false },
      });
    }

    return tx.affiliatePayment.update({
      where: { id: paymentId },
      data: {
        status: "CANCELLED",
        processedBy: adminId,
        notes: reason?.trim() || "Yönetici tarafından reddedildi",
      },
    });
  });
}

export async function completeAffiliatePayout(
  paymentId: string,
  adminId: string,
  notes?: string
) {
  const payment = await db.affiliatePayment.findUnique({
    where: { id: paymentId },
  });

  if (!payment) {
    throw new AffiliatePayoutError("Ödeme talebi bulunamadı", "NOT_FOUND");
  }

  if (payment.status !== "PENDING") {
    throw new AffiliatePayoutError("Bu talep işlenemez", "INVALID_STATUS");
  }

  if (!payment.processedBy) {
    throw new AffiliatePayoutError("Ödeme talebi önce onaylanmalıdır", "INVALID_STATUS");
  }

  const now = new Date();

  return db.affiliatePayment.update({
    where: { id: paymentId },
    data: {
      status: "PAID",
      paidAt: now,
      processedBy: adminId,
      ...(notes?.trim() ? { notes: notes.trim() } : {}),
    },
  });
}

export async function getAffiliatePayoutStats() {
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const [pendingAggregate, paidThisMonthAggregate] = await Promise.all([
    db.affiliatePayment.aggregate({
      where: { status: "PENDING" },
      _sum: { amount: true },
      _count: true,
    }),
    db.affiliatePayment.aggregate({
      where: {
        status: "PAID",
        paidAt: { gte: startOfMonth },
      },
      _sum: { amount: true },
    }),
  ]);

  return {
    totalPending: toNumber(pendingAggregate._sum.amount),
    pendingCount: pendingAggregate._count,
    totalPaidThisMonth: toNumber(paidThisMonthAggregate._sum.amount),
  };
}

export async function listAffiliatePayouts(status?: "PENDING" | "PAID" | "CANCELLED") {
  return db.affiliatePayment.findMany({
    where: status ? { status } : undefined,
    orderBy: { createdAt: "desc" },
    include: {
      affiliate: {
        select: {
          id: true,
          name: true,
          surname: true,
          email: true,
          companyName: true,
          affiliatePayoutIban: true,
        },
      },
    },
  });
}