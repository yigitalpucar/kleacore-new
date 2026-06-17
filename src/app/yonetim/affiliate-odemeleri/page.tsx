import { AffiliateOdemeleriContent } from "./content";
import {
  getAffiliatePayoutStats,
  listAffiliatePayouts,
} from "@/lib/affiliate/payouts";
import { requireAdmin } from "@/lib/utils/auth-helpers";

export const dynamic = "force-dynamic";

export default async function AffiliateOdemeleriPage() {
  await requireAdmin();

  const [payouts, stats] = await Promise.all([
    listAffiliatePayouts("PENDING"),
    getAffiliatePayoutStats(),
  ]);

  const serializedPayouts = payouts.map((payout) => ({
    id: payout.id,
    affiliateId: payout.affiliateId,
    affiliateName: `${payout.affiliate.name} ${payout.affiliate.surname}`.trim(),
    affiliateEmail: payout.affiliate.email,
    companyName: payout.affiliate.companyName,
    amount: Number(payout.amount),
    status: payout.status,
    notes: payout.notes,
    processedBy: payout.processedBy,
    createdAt: payout.createdAt.toISOString(),
    paidAt: payout.paidAt ? payout.paidAt.toISOString() : null,
  }));

  return (
    <AffiliateOdemeleriContent
      payouts={serializedPayouts}
      stats={{
        totalPending: Number(stats.totalPending),
        pendingCount: stats.pendingCount,
        totalPaidThisMonth: Number(stats.totalPaidThisMonth),
      }}
    />
  );
}