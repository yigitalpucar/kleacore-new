import { db } from "@/lib/db";
import { toNumber } from "@/lib/money";

export async function getReferrals(userId: string) {
  return db.affiliateReferral.findMany({
    where: { affiliateId: userId },
    include: {
      referred: {
        select: {
          id: true,
          name: true,
          surname: true,
          email: true,
          createdAt: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function getPayments(userId: string) {
  return db.affiliatePayment.findMany({
    where: { affiliateId: userId },
    orderBy: { createdAt: "desc" },
  });
}

export async function getAffiliateStats(userId: string) {
  const [totalReferrals, totalEarnings, pendingPayments, paidPayments] =
    await Promise.all([
      db.affiliateReferral.count({
        where: { affiliateId: userId },
      }),
      db.affiliateReferral.aggregate({
        where: { affiliateId: userId },
        _sum: { commission: true },
      }),
      db.affiliatePayment.aggregate({
        where: { affiliateId: userId, status: "PENDING" },
        _sum: { amount: true },
      }),
      db.affiliatePayment.aggregate({
        where: { affiliateId: userId, status: "PAID" },
        _sum: { amount: true },
      }),
    ]);

  return {
    totalReferrals,
    totalEarnings: toNumber(totalEarnings._sum.commission),
    pendingPayments: toNumber(pendingPayments._sum.amount),
    paidPayments: toNumber(paidPayments._sum.amount),
  };
}
