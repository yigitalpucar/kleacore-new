import type { Metadata } from "next";
import Link from "next/link";
import { Settings, ShieldAlert } from "lucide-react";
import { EmptyState, PageHeader, SectionCard, StatusBadge, appButton } from "@/components/app";
import { LinkTabs } from "@/components/admin-b/icerik/link-tabs";
import { customerDisplayName, getReviewCounts, getReviewQueue, type ReviewTab } from "@/lib/dal/review";
import { formatDateTime } from "@/lib/format/date";
import { formatTRY } from "@/lib/format/price";
import { parseRuleResults } from "@/lib/fraud/rules";
import { HOLD_REASON_LABELS, type HoldReason } from "@/lib/provisioning/hold";
import { requirePermission } from "@/lib/utils/auth-helpers";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Sipariş incelemesi" };

const TABS: ReviewTab[] = ["review", "kyc", "history"];

export default async function OrderReviewQueuePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requirePermission("orders.view");
  const sp = await searchParams;
  const tab = TABS.find((value) => value === sp.tab) ?? "review";
  const [rows, counts] = await Promise.all([getReviewQueue(tab), getReviewCounts()]);

  return (
    <>
      <PageHeader
        eyebrow="Siparişler"
        title="Sipariş incelemesi"
        description="Risk puanı eşiği aşan siparişler ve kimlik doğrulaması bekleyen sunucu siparişleri. Ödenmiş siparişlerde kurulum, onaya kadar bekler."
        actions={
          <Link href="/yonetim/siparisler/inceleme/ayarlar" className={appButton({ variant: "outline" })}>
            <Settings aria-hidden />
            Kurallar ve ayarlar
          </Link>
        }
      />

      <LinkTabs
        label="İnceleme filtresi"
        active={tab}
        tabs={[
          { value: "review", label: "İnceleme bekleyen", href: "/yonetim/siparisler/inceleme", count: counts.review },
          { value: "kyc", label: "Kimlik bekleyen", href: "/yonetim/siparisler/inceleme?tab=kyc", count: counts.kyc },
          { value: "history", label: "Karar verilen", href: "/yonetim/siparisler/inceleme?tab=history" },
        ]}
      />

      <SectionCard flush title={tab === "history" ? "Son kararlar" : "Kuyruk"}>
        {rows.length === 0 ? (
          <div className="p-4">
            <EmptyState
              compact
              icon={ShieldAlert}
              title={tab === "review" ? "İnceleme bekleyen sipariş yok" : tab === "kyc" ? "Kimlik bekleyen sipariş yok" : "Henüz karar yok"}
            />
          </div>
        ) : (
          <ul className="divide-y">
            {rows.map(({ order, check }) => {
              const matched = check ? parseRuleResults(check.rules).filter((rule) => rule.matched) : [];
              return (
                <li key={order.id} className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link href={`/yonetim/siparisler/${order.id}`} className="font-mono text-[13px] font-medium hover:underline">
                        {order.orderNumber}
                      </Link>
                      {check ? <StatusBadge kind="fraudCheck" status={check.status} /> : null}
                      <StatusBadge kind="invoice" status={order.invoice?.status} />
                      {order.provisioningHoldReasons.map((reason) => (
                        <StatusBadge key={reason} tone="warning" label={HOLD_REASON_LABELS[reason as HoldReason] ?? reason} />
                      ))}
                    </div>
                    <p className="truncate text-sm">
                      {order.product.name} ·{" "}
                      <Link href={`/yonetim/musteriler/${order.customer.id}`} className="hover:underline">
                        {customerDisplayName(order.customer)}
                      </Link>
                    </p>
                    {matched.length > 0 ? (
                      <p className="text-xs text-muted-foreground">
                        {matched.map((rule) => `${rule.label} (+${rule.weight})`).join(" · ")}
                      </p>
                    ) : null}
                    <p className="text-xs tabular-nums text-muted-foreground">
                      {formatDateTime(order.createdAt)} · {formatTRY(Number(order.totalAmount), { keepDecimals: true })}
                      {check?.ipCountry ? ` · IP: ${check.ipCountry}` : ""}
                    </p>
                    {tab === "kyc" ? (
                      <p className="flex items-center gap-2 text-xs text-muted-foreground">
                        Kimlik doğrulama: <StatusBadge kind="kyc" status={order.customer.kycStatus} />
                      </p>
                    ) : null}
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    {check ? (
                      <span className="font-mono text-lg font-semibold tabular-nums" title={`Eşik ${check.threshold}`}>
                        {check.score}
                        <span className="text-xs font-normal text-muted-foreground">/{check.threshold}</span>
                      </span>
                    ) : null}
                    <Link
                      href={tab === "kyc" ? `/yonetim/kyc/${order.customer.id}` : `/yonetim/siparisler/${order.id}`}
                      className={appButton({ variant: "outline", size: "sm" })}
                    >
                      {tab === "kyc" ? "Kimliği incele" : "İncele"}
                    </Link>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </SectionCard>
    </>
  );
}
