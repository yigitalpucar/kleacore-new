import Link from "next/link";
import { DetailList, SectionCard, StatusBadge } from "@/components/app";
import { hasPermission } from "@/lib/auth/permissions";
import { getOrderReview } from "@/lib/dal/review";
import { formatDateTime } from "@/lib/format/date";
import { HOLD_REASON_LABELS, type HoldReason } from "@/lib/provisioning/hold";
import { OrderReviewActions } from "./review-actions";

const SOURCE_LABELS: Record<string, string> = { "cf-header": "Cloudflare başlığı", db: "IP veritabanı" };

/** Risk score breakdown, hold state and the review decision (admin order page). */
export async function OrderReviewCard({ orderId, role }: { orderId: string; role: string }) {
  const review = await getOrderReview(orderId);
  if (!review || (!review.fraudCheck && !review.provisioningHeldAt)) return null;
  const check = review.fraudCheck;
  const paid = review.invoice?.status === "PAID";
  const canDecide = check?.status === "REVIEW" && hasPermission(role, "orders.manage");

  return (
    <SectionCard
      title="Risk değerlendirmesi"
      description={
        check
          ? `Puan ${check.score} / eşik ${check.threshold} · ${check.stage === "payment" ? "ödeme anında güncellendi" : "sipariş anında hesaplandı"}`
          : undefined
      }
      actions={check ? <StatusBadge kind="fraudCheck" status={check.status} size="md" /> : undefined}
    >
      <div className="space-y-4">
        {review.provisioningHeldAt ? (
          <div className="rounded-md border border-dashed p-3 text-sm">
            <p className="font-medium">Kurulum bekletiliyor</p>
            <p className="mt-1 text-muted-foreground">
              {formatDateTime(review.provisioningHeldAt)} ·{" "}
              {review.provisioningHoldReasons.map((reason) => HOLD_REASON_LABELS[reason as HoldReason] ?? reason).join(", ")}
            </p>
            {review.provisioningHoldReasons.includes("KYC") ? (
              <p className="mt-1 flex flex-wrap items-center gap-2 text-muted-foreground">
                Müşterinin kimlik doğrulaması: <StatusBadge kind="kyc" status={review.customer.kycStatus} />
                <Link href={`/yonetim/kyc/${review.customer.id}`} className="underline underline-offset-2 hover:text-foreground">
                  KYC sayfası
                </Link>
              </p>
            ) : null}
          </div>
        ) : null}

        {check ? (
          <>
            <ul className="divide-y divide-dashed rounded-md border">
              {review.rules.map((rule) => (
                <li key={rule.rule} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                  <span className={rule.matched ? "font-medium" : "text-muted-foreground"}>
                    {rule.label}
                    {rule.detail ? <span className="ml-2 text-xs font-normal text-muted-foreground">{rule.detail}</span> : null}
                  </span>
                  <span className="shrink-0 font-mono tabular-nums">{rule.matched ? `+${rule.weight}` : "—"}</span>
                </li>
              ))}
            </ul>
            <DetailList
              items={[
                { label: "IP adresi", value: check.ipAddress, mono: true },
                {
                  label: "IP ülkesi",
                  value: check.ipCountry ? `${check.ipCountry}${check.ipCountrySource ? ` (${SOURCE_LABELS[check.ipCountrySource] ?? check.ipCountrySource})` : ""}` : null,
                },
                { label: "Kart ülkesi", value: check.cardCountry },
                { label: "Ödeme", value: check.paymentBlocked ? "Onaya kadar engelli" : paid ? "Alındı" : "Alınabilir" },
                { label: "Karar", value: check.reviewedAt ? formatDateTime(check.reviewedAt) : null },
                { label: "Karar notu", value: check.reviewNote },
              ]}
            />
          </>
        ) : null}

        {canDecide ? <OrderReviewActions orderId={orderId} paid={paid} paidByCard={review.paidByCard} /> : null}
      </div>
    </SectionCard>
  );
}
