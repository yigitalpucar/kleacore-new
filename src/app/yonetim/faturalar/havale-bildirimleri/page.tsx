import type { Metadata } from "next";
import Link from "next/link";
import { Landmark } from "lucide-react";
import { EmptyState, PageHeader, SectionCard, StatCard, StatGrid, StatusBadge, appButton } from "@/components/app";
import { NoticeReviewButtons } from "@/components/admin-b/payments/notice-review-buttons";
import { getBankTransferNoticeQueue } from "@/lib/dal/bank-transfer";
import { formatDate, formatDateTime } from "@/lib/format/date";
import { formatTRY } from "@/lib/format/price";
import { cn } from "@/lib/utils";
import { requirePermission } from "@/lib/utils/auth-helpers";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Havale bildirimleri" };

const money = (n: number) => formatTRY(n, { keepDecimals: true });

const TABS = [
  { value: "PENDING", label: "Onay bekleyen" },
  { value: "APPROVED", label: "Onaylanan" },
  { value: "REJECTED", label: "Reddedilen" },
] as const;

type TabValue = (typeof TABS)[number]["value"];

export default async function BankTransferNoticesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requirePermission("invoices.view");
  const sp = await searchParams;
  const requested = typeof sp.durum === "string" ? sp.durum.toUpperCase() : "PENDING";
  const status: TabValue = TABS.some((tab) => tab.value === requested) ? (requested as TabValue) : "PENDING";
  const queue = await getBankTransferNoticeQueue(status);
  const pendingTotal = status === "PENDING" ? queue.notices.reduce((total, notice) => total + notice.amount, 0) : null;

  return (
    <>
      <PageHeader
        title="Havale bildirimleri"
        description="Müşterilerin gönderdiği havale/EFT ödeme bildirimleri. Banka hesabınızda tutarı gördükten sonra onaylayın; fatura ödendi olarak kapanır."
        actions={
          <Link href="/yonetim/entegrasyonlar?tab=payment" className={appButton({ variant: "outline" })}>
            Banka hesapları
          </Link>
        }
      />

      <StatGrid columns={3}>
        <StatCard
          label="Onay bekleyen"
          value={queue.counts.PENDING.toLocaleString("tr-TR")}
          tone={queue.counts.PENDING > 0 ? "warning" : undefined}
        />
        <StatCard label="Onaylanan" value={queue.counts.APPROVED.toLocaleString("tr-TR")} />
        <StatCard label="Reddedilen" value={queue.counts.REJECTED.toLocaleString("tr-TR")} />
      </StatGrid>

      <nav aria-label="Bildirim durumu" className="flex flex-wrap gap-2">
        {TABS.map((tab) => (
          <Link
            key={tab.value}
            href={`/yonetim/faturalar/havale-bildirimleri?durum=${tab.value.toLowerCase()}`}
            aria-current={tab.value === status ? "page" : undefined}
            className={cn(appButton({ variant: tab.value === status ? "secondary" : "ghost", size: "sm" }))}
          >
            {tab.label}
            <span className="tabular-nums text-muted-foreground">{queue.counts[tab.value]}</span>
          </Link>
        ))}
      </nav>

      <SectionCard
        title={TABS.find((tab) => tab.value === status)?.label}
        description={pendingTotal !== null && queue.notices.length > 0 ? `Toplam ${money(pendingTotal)}` : undefined}
        flush
      >
        {queue.notices.length === 0 ? (
          <div className="p-4 md:p-5">
            <EmptyState
              compact
              icon={Landmark}
              title="Bildirim yok"
              description={status === "PENDING" ? "Onay bekleyen havale bildirimi bulunmuyor." : "Bu durumda kayıt yok."}
            />
          </div>
        ) : (
          <ul className="divide-y divide-dashed">
            {queue.notices.map((notice) => {
              const mismatch = Math.abs(notice.amount - notice.invoice.outstanding) >= 0.01;
              return (
                <li key={notice.id} className="grid gap-3 px-4 py-4 md:grid-cols-[minmax(0,1fr)_auto] md:px-5">
                  <div className="min-w-0 space-y-1 text-sm">
                    <p className="font-medium">
                      <Link href={`/yonetim/faturalar/${notice.invoice.id}`} className="font-mono underline-offset-4 hover:underline">
                        {notice.invoice.invoiceNumber}
                      </Link>
                      <span className="text-muted-foreground"> · </span>
                      <Link href={`/yonetim/musteriler/${notice.customer.id}`} className="underline-offset-4 hover:underline">
                        {notice.customer.companyName || notice.customer.name}
                      </Link>
                    </p>
                    <p className="text-muted-foreground">
                      Gönderen: <span className="text-foreground">{notice.senderName}</span>
                      {notice.bankName ? ` · ${notice.bankName}` : null} · Ödeme tarihi {formatDate(notice.transferDate)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Bildirim {formatDateTime(notice.createdAt)}
                      {notice.reviewedAt ? ` · Sonuç ${formatDateTime(notice.reviewedAt)}` : null}
                    </p>
                    {notice.note ? <p className="text-xs text-muted-foreground">Not: {notice.note}</p> : null}
                    {notice.rejectionReason ? (
                      <p className="text-xs text-muted-foreground">Ret nedeni: {notice.rejectionReason}</p>
                    ) : null}
                    {status === "PENDING" && mismatch ? (
                      <p className="text-xs text-amber-600 dark:text-amber-400">
                        Bildirilen tutar fatura bakiyesinden ({money(notice.invoice.outstanding)}) farklı.
                      </p>
                    ) : null}
                  </div>
                  <div className="flex flex-col items-start gap-2 md:items-end">
                    <span className="text-base font-semibold tabular-nums">{money(notice.amount)}</span>
                    {status === "PENDING" ? (
                      <NoticeReviewButtons
                        noticeId={notice.id}
                        invoiceNumber={notice.invoice.invoiceNumber}
                        amountLabel={money(notice.amount)}
                        amountMismatch={mismatch}
                      />
                    ) : (
                      <StatusBadge kind="bankTransferNotice" status={notice.status} />
                    )}
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
