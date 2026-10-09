import type { Metadata } from "next";
import Link from "next/link";
import type { KycStatus } from "@prisma/client";
import { IdCard } from "lucide-react";
import { EmptyState, PageHeader, SectionCard, StatusBadge, appButton, enumLabel } from "@/components/app";
import { LinkTabs } from "@/components/admin-b/icerik/link-tabs";
import { customerDisplayName, getKycCounts, getKycQueue } from "@/lib/dal/review";
import { formatDateTime } from "@/lib/format/date";
import { requirePermission } from "@/lib/utils/auth-helpers";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Kimlik doğrulama" };

const STATUSES: KycStatus[] = ["PENDING", "APPROVED", "REJECTED"];

export default async function KycQueuePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requirePermission("kyc.review");
  const sp = await searchParams;
  const status = STATUSES.find((value) => value === sp.status) ?? "PENDING";
  const [users, counts] = await Promise.all([getKycQueue(status), getKycCounts()]);

  return (
    <>
      <PageHeader
        eyebrow="Müşteri"
        title="Kimlik doğrulama (KYC)"
        description="Sunucu hizmetleri için yüklenen kimlik / vergi levhası belgeleri (5651). Belgeleri yalnızca bu yetkiye sahip personel görür; her görüntüleme aktivite kaydına yazılır."
      />
      <LinkTabs
        label="Durum filtresi"
        active={status}
        tabs={STATUSES.map((value) => ({
          value,
          label: value === "PENDING" ? "İnceleme bekleyen" : value === "APPROVED" ? "Onaylanan" : "Reddedilen",
          href: value === "PENDING" ? "/yonetim/kyc" : `/yonetim/kyc?status=${value}`,
          count: counts[value],
        }))}
      />
      <SectionCard flush>
        {users.length === 0 ? (
          <div className="p-4">
            <EmptyState compact icon={IdCard} title="Kayıt yok" />
          </div>
        ) : (
          <ul className="divide-y">
            {users.map((user) => (
              <li key={user.id} className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="truncate text-sm font-medium">{customerDisplayName(user)}</span>
                    <StatusBadge kind="kyc" status={user.kycStatus} />
                    {user._count.orders > 0 ? <StatusBadge tone="warning" label={`${user._count.orders} sipariş bekliyor`} /> : null}
                  </div>
                  <p className="truncate text-xs text-muted-foreground">
                    {user.email} · {enumLabel("customerType", user.customerType)}
                    {user.kycSubmittedAt ? ` · Gönderim ${formatDateTime(user.kycSubmittedAt)}` : ""}
                    {user.kycReviewedAt && status !== "PENDING" ? ` · Karar ${formatDateTime(user.kycReviewedAt)}` : ""}
                  </p>
                  {user.kycRejectionReason && status === "REJECTED" ? (
                    <p className="text-xs text-muted-foreground">Ret nedeni: {user.kycRejectionReason}</p>
                  ) : null}
                </div>
                <Link href={`/yonetim/kyc/${user.id}`} className={appButton({ variant: "outline", size: "sm" })}>
                  {status === "PENDING" ? "İncele" : "Aç"}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </SectionCard>
    </>
  );
}
