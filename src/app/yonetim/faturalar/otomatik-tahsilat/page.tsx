import type { Metadata } from "next";
import Link from "next/link";
import { CreditCard } from "lucide-react";
import { EmptyState, FormField, PageHeader, SectionCard, StatCard, StatGrid, StatusBadge, appButton } from "@/components/app";
import { Input } from "@/components/ui/input";
import { db } from "@/lib/db";
import { formatDateTime } from "@/lib/format/date";
import { formatTRY } from "@/lib/format/price";
import { saveSavedCardSettings } from "@/lib/actions/admin/saved-cards";
import { getSavedCardAvailability, savedCardLabel } from "@/lib/payments/saved-cards";
import { requirePermission } from "@/lib/utils/auth-helpers";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Otomatik tahsilat" };

const ATTEMPT_STATUS = {
  PENDING: { tone: "info", label: "İşleniyor" },
  SUCCEEDED: { tone: "success", label: "Başarılı" },
  FAILED: { tone: "danger", label: "Başarısız" },
  UNKNOWN: { tone: "warning", label: "Sonuç bekleniyor" },
} as const;

export default async function AutoChargePage() {
  await requirePermission("invoices.edit");
  const availability = await getSavedCardAvailability();
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const [activeCards, autoPayCustomers, attempts, unrefunded] = await Promise.all([
    db.savedCard.count({ where: { status: "ACTIVE" } }),
    db.user.count({ where: { autoPayEnabled: true } }),
    db.paymentAttempt.findMany({
      where: { createdAt: { gte: since } },
      orderBy: { createdAt: "desc" },
      take: 100,
      include: {
        invoice: { select: { id: true, invoiceNumber: true } },
        user: { select: { name: true, surname: true, email: true } },
        savedCard: { select: { brand: true, last4: true } },
      },
    }),
    db.savedCard.count({
      where: {
        verificationChargedAt: { not: null, lt: new Date(Date.now() - 60 * 60 * 1000) },
        verificationRefundedAt: null,
      },
    }),
  ]);
  const succeeded = attempts.filter((attempt) => attempt.status === "SUCCEEDED").length;
  const failed = attempts.filter((attempt) => attempt.status === "FAILED").length;

  return (
    <>
      <PageHeader
        title="Otomatik tahsilat"
        description="Kayıtlı kartlar PayTR Kart Saklama API ile tutulur; vadesi gelen faturalar her gün 05:30'da otomatik ödemesi açık müşterilerin varsayılan kartından çekilir."
      />

      <StatGrid columns={4}>
        <StatCard label="Kayıtlı kart" value={activeCards} />
        <StatCard label="Otomatik ödeme açık" value={autoPayCustomers} />
        <StatCard label="Başarılı (30 gün)" value={succeeded} tone="success" />
        <StatCard label="Başarısız (30 gün)" value={failed} tone={failed > 0 ? "danger" : undefined} />
      </StatGrid>

      {unrefunded > 0 ? (
        <p role="alert" className="rounded-lg border px-4 py-3 text-sm">
          {unrefunded} kart doğrulamasında 1,00 TL iadesi yapılamadı; PayTR panelinden iade edin.
        </p>
      ) : null}

      <SectionCard
        title="Ayarlar"
        description={
          availability.available
            ? "PayTR yapılandırılmış; kayıtlı kart açık."
            : availability.reason === "gateway-not-configured"
              ? "PayTR mağaza bilgileri eksik (Entegrasyonlar → Ödeme). PayTR'den Non3D ve kart saklama yetkisi istenmeli."
              : "Kayıtlı kart kapalı."
        }
      >
        <form action={saveSavedCardSettings} className="grid gap-4 md:grid-cols-3">
          <label className="flex items-center gap-2 text-sm md:col-span-3">
            <input type="checkbox" name="enabled" defaultChecked={availability.settings.enabled} className="size-4" />
            Müşteriler kart kaydedebilir ve otomatik ödeme açabilir
          </label>
          <FormField label="En fazla deneme (fatura başına)" htmlFor="maxAttempts" hint="Günde bir deneme yapılır.">
            <Input id="maxAttempts" name="maxAttempts" type="number" min={1} max={10} defaultValue={availability.settings.maxAttempts} />
          </FormField>
          <FormField label="Vade sonrası deneme süresi (gün)" htmlFor="graceDays" hint="Vadeden bu kadar gün sonrasına kadar denenir.">
            <Input id="graceDays" name="graceDays" type="number" min={0} max={30} defaultValue={availability.settings.graceDays} />
          </FormField>
          <div className="flex items-end">
            <button type="submit" className={appButton({ variant: "primary" })}>
              Kaydet
            </button>
          </div>
        </form>
      </SectionCard>

      <SectionCard title="Son tahsilat denemeleri" description="Son 30 gün, en fazla 100 kayıt." flush>
        {attempts.length === 0 ? (
          <div className="p-4">
            <EmptyState compact icon={CreditCard} title="Henüz deneme yok" />
          </div>
        ) : (
          <ul className="divide-y">
            {attempts.map((attempt) => {
              const status = ATTEMPT_STATUS[attempt.status];
              return (
                <li key={attempt.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 text-sm">
                  <Link href={`/yonetim/faturalar/${attempt.invoice.id}`} className="font-mono underline-offset-4 hover:underline">
                    {attempt.invoice.invoiceNumber}
                  </Link>
                  <span className="min-w-0 flex-1 truncate text-muted-foreground">
                    {`${attempt.user.name} ${attempt.user.surname}`.trim() || attempt.user.email}
                    {attempt.savedCard ? ` · ${savedCardLabel(attempt.savedCard)}` : ""}
                    {` · ${attempt.kind === "AUTO" ? "Otomatik" : "Müşteri"}`}
                    {attempt.errorMessage ? ` · ${attempt.errorMessage}` : ""}
                  </span>
                  <span className="tabular-nums">{formatTRY(Number(attempt.amount), { keepDecimals: true })}</span>
                  <StatusBadge tone={status.tone} label={status.label} />
                  <span className="text-xs text-muted-foreground">{formatDateTime(attempt.createdAt)}</span>
                </li>
              );
            })}
          </ul>
        )}
      </SectionCard>
    </>
  );
}
