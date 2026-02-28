import { db } from "@/lib/db";

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
    totalEarnings: totalEarnings._sum.commission ?? 0,
    pendingPayments: pendingPayments._sum.amount ?? 0,
    paidPayments: paidPayments._sum.amount ?? 0,
  };
}
