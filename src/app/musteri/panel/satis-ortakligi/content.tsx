"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CreditCard, Link2, Loader2, Share2, ShoppingCart, UserPlus, Users, Wallet } from "lucide-react";
import {
  CopyButton,
  DataTable,
  EmptyState,
  FormField,
  ListRow,
  PageHeader,
  SectionCard,
  StatCard,
  StatGrid,
  StatusBadge,
  UnavailableAction,
  appButton,
  type ColumnDef,
} from "@/components/app";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { requestPayout, saveAffiliatePayoutIban } from "@/lib/actions/customer/affiliate";
import { MIN_PAYOUT_AMOUNT } from "@/lib/affiliate/constants";
import { formatTRY } from "@/lib/format/price";
import { formatDate } from "@/lib/format/date";
import { toast } from "@/lib/toast";

// Mirrors AFFILIATE_COMMISSION_RATE (src/lib/affiliate/index.ts) — a flat rate on every paid order.
const COMMISSION_PERCENT = 10;

const money = (n: number) => formatTRY(n, { keepDecimals: true });

interface Referral {
  id: string;
  referredEmail: string;
  registeredAt: string;
  commission: number;
  isPaid: boolean;
}

interface Payment {
  id: string;
  amount: number;
  status: string;
  createdAt: string;
  paidAt: string | null;
}

interface AffiliateStats {
  totalReferrals: number;
  totalEarnings: number;
  pendingPayments: number;
  paidPayments: number;
  availableBalance: number;
}

interface SatisOrtakligiContentProps {
  referralCode: string;
  referralLink: string;
  payoutIban: string;
  referrals: Referral[];
  payments: Payment[];
  stats: AffiliateStats;
}

type ReferralState = "paid" | "earned" | "waiting";
const referralState = (r: Referral): ReferralState => (r.isPaid ? "paid" : r.commission > 0 ? "earned" : "waiting");
const REFERRAL_META: Record<ReferralState, { label: string; tone: "success" | "warning" | "muted" }> = {
  paid: { label: "Komisyon ödendi", tone: "success" },
  earned: { label: "Komisyon kazanıldı", tone: "warning" },
  waiting: { label: "Alışveriş bekleniyor", tone: "muted" },
};

function ReferralBadge({ r }: { r: Referral }) {
  const meta = REFERRAL_META[referralState(r)];
  return <StatusBadge tone={meta.tone} label={meta.label} />;
}

const shortId = (id: string) => id.slice(-8).toUpperCase();

const referralColumns: ColumnDef<Referral>[] = [
  {
    accessorKey: "referredEmail",
    header: "Müşteri",
    cell: ({ row }) => <span className="font-medium">{row.original.referredEmail}</span>,
  },
  {
    id: "registeredAt",
    accessorFn: (r) => r.registeredAt,
    header: "Kayıt tarihi",
    cell: ({ row }) => <span className="tabular-nums text-muted-foreground">{formatDate(row.original.registeredAt)}</span>,
  },
  {
    id: "state",
    accessorFn: (r) => referralState(r),
    header: "Durum",
    enableSorting: false,
    cell: ({ row }) => <ReferralBadge r={row.original} />,
  },
  {
    accessorKey: "commission",
    header: "Komisyon",
    meta: { align: "right" },
    cell: ({ row }) => <span className="whitespace-nowrap font-medium tabular-nums">{money(row.original.commission)}</span>,
  },
];

const paymentColumns: ColumnDef<Payment>[] = [
  {
    accessorKey: "id",
    header: "Talep",
    enableSorting: false,
    cell: ({ row }) => <span className="font-mono text-[13px]">#{shortId(row.original.id)}</span>,
  },
  {
    id: "createdAt",
    accessorFn: (p) => p.createdAt,
    header: "Talep tarihi",
    cell: ({ row }) => <span className="tabular-nums text-muted-foreground">{formatDate(row.original.createdAt)}</span>,
  },
  {
    id: "paidAt",
    accessorFn: (p) => p.paidAt ?? "",
    header: "Ödeme tarihi",
    cell: ({ row }) => <span className="tabular-nums text-muted-foreground">{formatDate(row.original.paidAt)}</span>,
  },
  {
    accessorKey: "status",
    header: "Durum",
    enableSorting: false,
    cell: ({ row }) => <StatusBadge kind="affiliatePayment" status={row.original.status} />,
  },
  {
    accessorKey: "amount",
    header: "Tutar",
    meta: { align: "right" },
    cell: ({ row }) => <span className="whitespace-nowrap font-medium tabular-nums">{money(row.original.amount)}</span>,
  },
];

const steps = [
  { icon: Share2, title: "Bağlantınızı paylaşın", text: "Referans bağlantınızı sitenizde, sosyal medyada veya çevrenizle paylaşın." },
  { icon: UserPlus, title: "Hesap açılsın", text: "Bağlantınızla gelen ziyaretçi KLEACORE hesabı oluşturduğunda referansınız olur." },
  {
    icon: ShoppingCart,
    title: "Komisyon kazanın",
    text: `Referansınızın ödenen her siparişinden %${COMMISSION_PERCENT} komisyon hesabınıza eklenir.`,
  },
];

export function SatisOrtakligiContent({
  referralCode,
  referralLink,
  payoutIban: initialPayoutIban,
  referrals,
  payments,
  stats,
}: SatisOrtakligiContentProps) {
  const router = useRouter();
  const [payoutDialogOpen, setPayoutDialogOpen] = useState(false);
  const [payoutAmount, setPayoutAmount] = useState("");
  const [payoutIban, setPayoutIban] = useState(initialPayoutIban);
  const [isSubmittingPayout, setIsSubmittingPayout] = useState(false);
  const [isSavingIban, setIsSavingIban] = useState(false);

  const handleSaveIban = async () => {
    setIsSavingIban(true);
    const result = await saveAffiliatePayoutIban(payoutIban);
    setIsSavingIban(false);

    if (!result.success) {
      toast.error(result.error || "IBAN kaydedilemedi");
      return;
    }

    toast.success("IBAN kaydedildi");
    router.refresh();
  };

  const handleRequestPayout = async () => {
    const amount = Number(payoutAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      toast.error("Geçerli bir tutar girin");
      return;
    }

    if (!payoutIban.trim()) {
      toast.error("Ödeme talebi için IBAN tanımlayın");
      return;
    }

    setIsSubmittingPayout(true);
    const result = await requestPayout(amount);
    setIsSubmittingPayout(false);

    if (!result.success) {
      toast.error(result.error || "Ödeme talebi oluşturulamadı");
      return;
    }

    toast.success("Ödeme talebiniz alındı");
    setPayoutDialogOpen(false);
    setPayoutAmount("");
    router.refresh();
  };

  const availableBalance = Math.max(0, stats.availableBalance);
  const canRequestPayout = availableBalance >= MIN_PAYOUT_AMOUNT;
  const purchasingReferrals = referrals.filter((r) => r.commission > 0).length;

  const payoutButton = canRequestPayout ? (
    <button
      type="button"
      className={appButton()}
      onClick={() => {
        setPayoutAmount(String(availableBalance));
        setPayoutDialogOpen(true);
      }}
    >
      <Wallet aria-hidden />
      Ödeme talep et
    </button>
  ) : (
    <UnavailableAction
      variant="primary"
      icon={<Wallet aria-hidden />}
      label="Ödeme talep et"
      reason={`En az ${formatTRY(MIN_PAYOUT_AMOUNT)} bakiye gerekir`}
    />
  );

  return (
    <>
      <PageHeader
        title="Satış ortaklığı"
        description={`Referans bağlantınızla gelen müşterilerin ödenen siparişlerinden %${COMMISSION_PERCENT} komisyon kazanın.`}
        actions={payoutButton}
      />

      <StatGrid columns={4}>
        <StatCard
          label="Kullanılabilir"
          value={money(availableBalance)}
          hint={canRequestPayout ? "Ödeme talep edebilirsiniz" : `Talep için en az ${formatTRY(MIN_PAYOUT_AMOUNT)}`}
          tone={canRequestPayout ? "success" : undefined}
        />
        <StatCard label="Toplam kazanç" value={money(stats.totalEarnings)} hint="Tüm zamanlar" />
        <StatCard
          label="Bekleyen ödeme"
          value={money(stats.pendingPayments)}
          hint={stats.pendingPayments > 0 ? "İnceleniyor" : "Bekleyen talep yok"}
          tone={stats.pendingPayments > 0 ? "warning" : undefined}
        />
        <StatCard
          label="Referans"
          value={stats.totalReferrals}
          hint={stats.totalReferrals ? `${purchasingReferrals} tanesi alışveriş yaptı` : "Henüz referans yok"}
        />
      </StatGrid>

      <div className="grid items-start gap-6 lg:grid-cols-3">
        <SectionCard
          className="lg:col-span-2"
          title="Referans bağlantınız"
          description="Bu bağlantıyla hesap açan herkes sizin referansınız olarak kaydedilir."
        >
          {referralLink ? (
            <div className="space-y-4">
              <div className="flex min-w-0 items-center gap-1 rounded-md border bg-muted/30 py-1 pl-3 pr-1">
                <Link2 aria-hidden className="size-4 shrink-0 text-muted-foreground" />
                <span className="min-w-0 flex-1 truncate font-mono text-[13px]" title={referralLink}>
                  {referralLink}
                </span>
                <CopyButton value={referralLink} label="Referans bağlantısını kopyala" />
              </div>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                <span className="text-muted-foreground">Referans kodu</span>
                <span className="inline-flex items-center gap-0.5 rounded-md border px-2 py-0.5">
                  <code className="font-mono text-[13px] font-medium">{referralCode}</code>
                  <CopyButton value={referralCode} label="Referans kodunu kopyala" className="size-8 md:size-7" />
                </span>
              </div>
            </div>
          ) : (
            <EmptyState
              compact
              icon={Link2}
              title="Referans kodunuz henüz oluşturulmamış"
              description="Kodunuzun tanımlanması için destek ekibimize yazabilirsiniz."
            />
          )}

          <ol className="mt-5 grid gap-4 border-t border-dashed pt-5 sm:grid-cols-3">
            {steps.map((s, i) => (
              <li key={s.title} className="space-y-1.5">
                <p className="flex items-center gap-2 text-sm font-medium">
                  <span className="flex size-6 items-center justify-center rounded-full border font-mono text-[11px] text-muted-foreground">
                    {i + 1}
                  </span>
                  {s.title}
                </p>
                <p className="text-[13px] text-muted-foreground">{s.text}</p>
              </li>
            ))}
          </ol>
        </SectionCard>

        <SectionCard
          title="Ödeme hesabı"
          description="Komisyon ödemeleri bu IBAN'a havale/EFT ile yapılır."
          footer={
            <button type="button" className={appButton({ variant: "outline" })} onClick={handleSaveIban} disabled={isSavingIban}>
              {isSavingIban ? <Loader2 aria-hidden className="animate-spin" /> : <CreditCard aria-hidden />}
              {isSavingIban ? "Kaydediliyor…" : "IBAN'ı kaydet"}
            </button>
          }
        >
          <FormField label="IBAN" htmlFor="affiliate-iban" hint="TR ile başlayan 26 karakter.">
            <Input
              id="affiliate-iban"
              value={payoutIban}
              onChange={(event) => setPayoutIban(event.target.value.toUpperCase())}
              placeholder="TR00 0000 0000 0000 0000 0000 00"
              autoComplete="off"
              spellCheck={false}
              className="h-11 font-mono md:h-9"
            />
          </FormField>
        </SectionCard>
      </div>

      <section aria-labelledby="referanslar-title" className="space-y-3">
        <h2 id="referanslar-title" className="text-sm font-semibold tracking-tight">
          Referanslarınız
        </h2>
        <DataTable
          caption="Referanslar"
          columns={referralColumns}
          data={referrals}
          initialSort={[{ id: "registeredAt", desc: true }]}
          searchFn={(r, q) => r.referredEmail.toLocaleLowerCase("tr-TR").includes(q)}
          searchPlaceholder="E-posta ara…"
          filters={[
            {
              id: "state",
              label: "Durum",
              options: (Object.keys(REFERRAL_META) as ReferralState[]).map((k) => ({ value: k, label: REFERRAL_META[k].label })),
              getValue: (r) => referralState(r),
            },
          ]}
          mobileCard={(r) => (
            <ListRow
              title={r.referredEmail}
              trailing={money(r.commission)}
              meta={
                <>
                  <ReferralBadge r={r} />
                  <span className="tabular-nums">Kayıt {formatDate(r.registeredAt)}</span>
                </>
              }
            />
          )}
          emptyState={
            <EmptyState
              icon={Users}
              title="Henüz referansınız yok"
              description="Referans bağlantınızla hesap açan müşteriler burada listelenir. E-posta adresleri gizlilik için kısaltılarak gösterilir."
            />
          }
          noResultsText="Aramanızla eşleşen referans bulunamadı."
        />
      </section>

      <section aria-labelledby="odemeler-title" className="space-y-3">
        <h2 id="odemeler-title" className="text-sm font-semibold tracking-tight">
          Ödeme talepleri
        </h2>
        <DataTable
          caption="Ödeme talepleri"
          columns={paymentColumns}
          data={payments}
          initialSort={[{ id: "createdAt", desc: true }]}
          mobileCard={(p) => (
            <ListRow
              title={<span className="font-mono text-[13px]">#{shortId(p.id)}</span>}
              trailing={money(p.amount)}
              meta={
                <>
                  <StatusBadge kind="affiliatePayment" status={p.status} />
                  <span className="tabular-nums">
                    {p.paidAt ? `Ödendi ${formatDate(p.paidAt)}` : `Talep ${formatDate(p.createdAt)}`}
                  </span>
                </>
              }
            />
          )}
          emptyState={
            <EmptyState
              compact
              icon={Wallet}
              title="Henüz ödeme talebiniz yok"
              description={`Kullanılabilir bakiyeniz ${formatTRY(MIN_PAYOUT_AMOUNT)} tutarına ulaştığında ödeme talep edebilirsiniz.`}
            />
          }
        />
      </section>

      <SectionCard title="Ödeme koşulları" headingLevel={2}>
        <ul className="space-y-2 text-[13px] text-muted-foreground">
          <li>• Komisyon, referansınızın ödenen siparişleri üzerinden %{COMMISSION_PERCENT} olarak hesaplanır.</li>
          <li>• En düşük ödeme talebi tutarı {formatTRY(MIN_PAYOUT_AMOUNT)}.</li>
          <li>• Ödemeler kayıtlı IBAN&apos;ınıza havale/EFT ile yapılır; talepler ekibimiz tarafından incelenerek işleme alınır.</li>
        </ul>
      </SectionCard>

      <Dialog open={payoutDialogOpen} onOpenChange={setPayoutDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ödeme talep et</DialogTitle>
            <DialogDescription>
              Kullanılabilir bakiyeniz {money(availableBalance)}. En düşük talep tutarı {formatTRY(MIN_PAYOUT_AMOUNT)}.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <FormField label="IBAN" htmlFor="payout-iban">
              <Input
                id="payout-iban"
                value={payoutIban}
                onChange={(event) => setPayoutIban(event.target.value.toUpperCase())}
                placeholder="TR00 0000 0000 0000 0000 0000 00"
                autoComplete="off"
                spellCheck={false}
                className="h-11 font-mono md:h-9"
              />
            </FormField>
            <FormField label="Talep tutarı (₺)" htmlFor="payout-amount">
              <Input
                id="payout-amount"
                type="number"
                inputMode="decimal"
                min={MIN_PAYOUT_AMOUNT}
                max={availableBalance}
                step="0.01"
                value={payoutAmount}
                onChange={(event) => setPayoutAmount(event.target.value)}
                placeholder={String(MIN_PAYOUT_AMOUNT)}
                className="h-11 tabular-nums md:h-9"
              />
            </FormField>
          </div>
          <DialogFooter className="gap-2">
            <button type="button" className={appButton({ variant: "outline" })} onClick={() => setPayoutDialogOpen(false)}>
              Vazgeç
            </button>
            <button type="button" className={appButton()} onClick={handleRequestPayout} disabled={isSubmittingPayout}>
              {isSubmittingPayout ? <Loader2 aria-hidden className="animate-spin" /> : null}
              {isSubmittingPayout ? "Gönderiliyor…" : "Talep oluştur"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
