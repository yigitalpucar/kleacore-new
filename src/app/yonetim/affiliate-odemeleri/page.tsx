import type { Metadata } from "next";
import { AffiliateOdemeleriContent } from "./content";
import {
  getAffiliatePayoutStats,
  listAffiliatePayouts,
} from "@/lib/affiliate/payouts";
import { requireAdmin } from "@/lib/utils/auth-helpers";
import type { AffiliatePaymentStatus } from "@prisma/client";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Affiliate ödemeleri" };

function readStatusFilter(
  searchParams: Record<string, string | string[] | undefined>
): AffiliatePaymentStatus | undefined {
  const value = searchParams.status;
  const status = typeof value === "string" ? value : undefined;

  if (status === "PAID" || status === "CANCELLED") {
    return status;
  }

  return "PENDING";
}

export default async function AffiliateOdemeleriPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireAdmin();

  const sp = await searchParams;
  const status = readStatusFilter(sp);

  const [payouts, stats] = await Promise.all([
    listAffiliatePayouts(status),
    getAffiliatePayoutStats(),
  ]);

  const serializedPayouts = payouts.map((payout) => {
    const referralIds = Array.isArray(payout.referralIds)
      ? payout.referralIds.filter((id): id is string => typeof id === "string")
      : [];

    return {
      id: payout.id,
      affiliateId: payout.affiliateId,
      affiliateName: `${payout.affiliate.name} ${payout.affiliate.surname}`.trim(),
      affiliateEmail: payout.affiliate.email,
      companyName: payout.affiliate.companyName,
      amount: Number(payout.amount),
      status: payout.status,
      notes: payout.notes,
      processedBy: payout.processedBy,
      referralCount: referralIds.length,
      payoutIban: payout.affiliate.affiliatePayoutIban,
      createdAt: payout.createdAt.toISOString(),
      paidAt: payout.paidAt ? payout.paidAt.toISOString() : null,
    };
  });

  return (
    <AffiliateOdemeleriContent
      payouts={serializedPayouts}
      stats={{
        totalPending: Number(stats.totalPending),
        pendingCount: stats.pendingCount,
        totalPaidThisMonth: Number(stats.totalPaidThisMonth),
      }}
      statusFilter={typeof sp.status === "string" ? sp.status : "PENDING"}
    />
  );
}