import { auth } from "@/lib/auth";
import { getAffiliateBalance } from "@/lib/affiliate/payouts";
import { getReferrals, getPayments, getAffiliateStats } from "@/lib/dal/affiliate";
import { db } from "@/lib/db";
import { getAppBaseUrl } from "@/lib/stripe";
import { SatisOrtakligiContent } from "./content";

export const dynamic = "force-dynamic";

export default async function SatisOrtakligiPage() {
  const session = await auth();
  const userId = session!.user.id;

  const [referralsData, paymentsData, stats, availableBalance, user] = await Promise.all([
    getReferrals(userId),
    getPayments(userId),
    getAffiliateStats(userId),
    getAffiliateBalance(userId),
    db.user.findUnique({
      where: { id: userId },
      select: { affiliateCode: true },
    }),
  ]);

  const affiliateCode = user?.affiliateCode || "";
  const appBaseUrl = getAppBaseUrl();
  const referralLink = affiliateCode
    ? `${appBaseUrl}/ref/${affiliateCode}`
    : "";

  // Serialize referrals — mask emails for privacy
  const serializedReferrals = referralsData.map((r) => {
    const email = r.referred.email;
    const [localPart, domain] = email.split("@");
    const maskedEmail = `${localPart[0]}***@${domain}`;

    return {
      id: r.id,
      referredEmail: maskedEmail,
      registeredAt: r.createdAt.toISOString(),
      commission: Number(r.commission),
      isPaid: r.isPaid,
    };
  });

  // Serialize payments
  const serializedPayments = paymentsData.map((p) => ({
    id: p.id,
    amount: Number(p.amount),
    status: p.status,
    createdAt: p.createdAt.toISOString(),
    paidAt: p.paidAt ? p.paidAt.toISOString() : null,
  }));

  return (
    <SatisOrtakligiContent
      referralCode={affiliateCode}
      referralLink={referralLink}
      referrals={serializedReferrals}
      payments={serializedPayments}
      stats={{
        totalReferrals: stats.totalReferrals,
        totalEarnings: Number(stats.totalEarnings),
        pendingPayments: Number(stats.pendingPayments),
        paidPayments: Number(stats.paidPayments),
        availableBalance: Number(availableBalance),
      }}
    />
  );
}
