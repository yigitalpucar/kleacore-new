"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  ArrowDownLeft,
  ArrowUpRight,
  Check,
  CircleAlert,
  CircleCheck,
  CreditCard,
  Loader2,
  Lock,
  Wallet,
} from "lucide-react";
import {
  DataTable,
  DetailList,
  FormField,
  IconTile,
  ListRow,
  PageHeader,
  SectionCard,
  StatusBadge,
  appButton,
  enumLabel,
  type ColumnDef,
} from "@/components/app";
import { Input } from "@/components/ui/input";
import { initiateBalanceTopUp } from "@/lib/actions/customer/balance";
import { redirectToCheckoutUrl } from "@/lib/utils/safe-redirect";
import { formatTRY } from "@/lib/format/price";
import { formatDate, formatDateTime } from "@/lib/format/date";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { PanelEmptyState } from "@/components/panel/panel-empty-state";

// Limits enforced by initiateBalanceTopUp.
const MIN_TOPUP = 50;
const MAX_TOPUP = 10000;
const PRESET_AMOUNTS = [100, 250, 500, 1000, 2500, 5000];

const money = (n: number) => formatTRY(n, { keepDecimals: true });

interface SerializedTransaction {
  id: string;
  type: string;
  amount: number;
  balanceBefore: number;
  balanceAfter: number;
  description: string;
  referenceId: string | null;
  createdAt: string;
}

interface KrediContentProps {
  transactions: SerializedTransaction[];
  balance: number;
}

const isCredit = (type: string) => type === "DEPOSIT" || type === "REFUND";

const TYPE_TONES = {
  DEPOSIT: "success",
  REFUND: "info",
  PAYMENT: "neutral",
  ADJUSTMENT: "muted",
} as const;

function TypeBadge({ type }: { type: string }) {
  return (
    <StatusBadge
      tone={TYPE_TONES[type as keyof typeof TYPE_TONES] ?? "muted"}
      label={enumLabel("transactionType", type)}
    />
  );
}

function SignedAmount({ t }: { t: SerializedTransaction }) {
  const credit = isCredit(t.type);
  return (
    <span className="whitespace-nowrap font-medium tabular-nums">
      {credit ? "+" : "−"}
      {money(Math.abs(t.amount))}
    </span>
  );
}

const columns: ColumnDef<SerializedTransaction>[] = [
  {
    id: "createdAt",
    accessorFn: (r) => r.createdAt,
    header: "Tarih",
    cell: ({ row }) => (
      <span className="whitespace-nowrap tabular-nums text-muted-foreground">{formatDateTime(row.original.createdAt)}</span>
    ),
  },
  {
    accessorKey: "description",
    header: "Açıklama",
    enableSorting: false,
    cell: ({ row }) => (
      <div className="flex min-w-0 max-w-[420px] items-center gap-3">
        <IconTile size="sm">{isCredit(row.original.type) ? <ArrowDownLeft /> : <ArrowUpRight />}</IconTile>
        <span className="truncate">{row.original.description}</span>
      </div>
    ),
  },
  {
    accessorKey: "type",
    header: "Tür",
    enableSorting: false,
    cell: ({ row }) => <TypeBadge type={row.original.type} />,
  },
  {
    accessorKey: "amount",
    header: "Tutar",
    meta: { align: "right" },
    cell: ({ row }) => <SignedAmount t={row.original} />,
  },
  {
    accessorKey: "balanceAfter",
    header: "Sonraki bakiye",
    meta: { align: "right" },
    cell: ({ row }) => (
      <span className="whitespace-nowrap tabular-nums text-muted-foreground">{money(row.original.balanceAfter)}</span>
    ),
  },
];

function TopUpNotice() {
  const params = useSearchParams();
  const topup = params.get("topup");
  if (topup !== "success" && topup !== "cancelled") return null;
  const success = topup === "success";
  return (
    <div
      role="status"
      className="flex items-start gap-3 rounded-lg border bg-card px-4 py-3 text-sm shadow-sm"
    >
      {success ? (
        <CircleCheck aria-hidden className="mt-0.5 size-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
      ) : (
        <CircleAlert aria-hidden className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-400" />
      )}
      <div className="space-y-0.5">
        <p className="font-medium">{success ? "Ödemeniz alındı" : "Ödeme tamamlanmadı"}</p>
        <p className="text-muted-foreground">
          {success
            ? "Ödeme sağlayıcısı onayı ilettiğinde tutar bakiyenize eklenir. Bakiye birkaç dakika içinde güncellenmezse sayfayı yenileyin."
            : "Ödeme iptal edildi, kartınızdan çekim yapılmadı. Dilerseniz yeniden deneyebilirsiniz."}
        </p>
      </div>
    </div>
  );
}

export function KrediContent({ transactions, balance }: KrediContentProps) {
  const [preset, setPreset] = useState<number | null>(null);
  const [customAmount, setCustomAmount] = useState("");
  const [loading, setLoading] = useState(false);

  const parsedCustom = customAmount ? parseFloat(customAmount) : 0;
  const finalAmount = preset ?? (Number.isFinite(parsedCustom) ? parsedCustom : 0);
  const tooLow = finalAmount > 0 && finalAmount < MIN_TOPUP;
  const tooHigh = finalAmount > MAX_TOPUP;
  const valid = finalAmount >= MIN_TOPUP && !tooHigh;

  const handleLoadBalance = async () => {
    if (!valid) return;
    setLoading(true);

    const result = await initiateBalanceTopUp(finalAmount);
    if (!result.success) {
      toast.error(result.error ?? "Ödeme başlatılamadı");
      setLoading(false);
      return;
    }

    if (result.data?.checkoutUrl && redirectToCheckoutUrl(result.data.checkoutUrl)) {
      return;
    }

    toast.error("Ödeme sayfası oluşturulamadı");
    setLoading(false);
  };

  const lastDeposit = transactions.find((t) => t.type === "DEPOSIT");

  return (
    <>
      <PageHeader
        title="Bakiye yükle"
        description="Hesabınıza bakiye yükleyin; faturalarınızı bakiyenizden ödeyebilirsiniz."
        meta={
          <span className="lg:hidden">
            Mevcut bakiye <span className="font-semibold tabular-nums text-foreground">{money(balance)}</span>
          </span>
        }
      />

      <Suspense fallback={null}>
        <TopUpNotice />
      </Suspense>

      <div className="grid items-start gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <SectionCard
            id="bakiye-yukle"
            className="scroll-mt-20"
            title="Tutar seçin"
            description={`Hazır tutarlardan birini seçin veya ${formatTRY(MIN_TOPUP)} ile ${formatTRY(MAX_TOPUP)} arasında bir tutar girin.`}
          >
            <fieldset>
              <legend className="sr-only">Hazır tutarlar</legend>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {PRESET_AMOUNTS.map((amount) => {
                  const selected = preset === amount;
                  return (
                    <label
                      key={amount}
                      className={cn(
                        "relative flex min-h-[56px] cursor-pointer flex-col justify-center rounded-md border bg-background px-4 py-3 transition-colors hover:border-foreground/30 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring",
                        selected && "border-foreground bg-muted/40 ring-1 ring-foreground hover:border-foreground"
                      )}
                    >
                      <input
                        type="radio"
                        name="amount-preset"
                        value={amount}
                        checked={selected}
                        onChange={() => {
                          setPreset(amount);
                          setCustomAmount("");
                        }}
                        className="sr-only"
                      />
                      <span className="text-lg font-semibold tabular-nums tracking-tight">{formatTRY(amount)}</span>
                      {selected ? (
                        <span
                          aria-hidden
                          className="absolute right-2.5 top-2.5 flex size-5 items-center justify-center rounded-full bg-foreground text-background"
                        >
                          <Check className="size-3" />
                        </span>
                      ) : null}
                    </label>
                  );
                })}
              </div>
            </fieldset>

            <div className="my-5 flex items-center gap-3 text-xs text-muted-foreground">
              <span className="line-dashed-x flex-1" />
              <span className="font-mono uppercase tracking-[0.14em]">veya</span>
              <span className="line-dashed-x flex-1" />
            </div>

            <FormField
              label="Farklı bir tutar"
              htmlFor="custom-amount"
              error={
                tooLow
                  ? `Minimum yükleme tutarı ${formatTRY(MIN_TOPUP)}.`
                  : tooHigh
                    ? `Tek seferde en fazla ${formatTRY(MAX_TOPUP)} yüklenebilir.`
                    : undefined
              }
              hint={`${formatTRY(MIN_TOPUP)} – ${formatTRY(MAX_TOPUP)} arası, kuruşlu tutar girebilirsiniz.`}
            >
              <div className="relative max-w-xs">
                <Input
                  id="custom-amount"
                  type="number"
                  inputMode="decimal"
                  placeholder="0,00"
                  value={customAmount}
                  onChange={(e) => {
                    setCustomAmount(e.target.value);
                    setPreset(null);
                  }}
                  min={MIN_TOPUP}
                  max={MAX_TOPUP}
                  step="0.01"
                  aria-invalid={tooLow || tooHigh || undefined}
                  className="h-11 pr-10 tabular-nums md:h-9"
                />
                <span aria-hidden className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                  ₺
                </span>
              </div>
            </FormField>
          </SectionCard>

          <SectionCard title="Ödeme yöntemi">
            <div className="flex items-center gap-3 rounded-md border bg-background px-4 py-3">
              <IconTile size="sm">
                <CreditCard />
              </IconTile>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">Kredi / banka kartı</p>
                <p className="text-[13px] text-muted-foreground">
                  Kart bilgileriniz bizim sunucularımıza gelmez; güvenli ödeme sayfasında girilir.
                </p>
              </div>
              <span aria-hidden className="flex size-5 shrink-0 items-center justify-center rounded-full bg-foreground text-background">
                <Check className="size-3" />
              </span>
            </div>
          </SectionCard>
        </div>

        <div className="space-y-6 lg:sticky lg:top-20">
          <SectionCard title="Özet" footer={
            <button
              type="button"
              className={appButton({ className: "w-full" })}
              disabled={!valid || loading}
              onClick={handleLoadBalance}
            >
              {loading ? <Loader2 aria-hidden className="animate-spin" /> : <Lock aria-hidden />}
              {loading ? "Ödeme sayfası açılıyor…" : valid ? `${money(finalAmount)} öde` : "Tutar seçin"}
            </button>
          }>
            <div className="mb-4 flex items-center gap-3">
              <IconTile>
                <Wallet />
              </IconTile>
              <div className="min-w-0">
                <p className="font-mono text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
                  Mevcut bakiye
                </p>
                <p className="text-2xl font-semibold tabular-nums tracking-tight">{money(balance)}</p>
              </div>
            </div>
            <DetailList
              items={[
                { label: "Yüklenecek tutar", value: valid ? money(finalAmount) : "—" },
                { label: "Yükleme sonrası", value: valid ? money(balance + finalAmount) : "—" },
              ]}
            />
            <p className="mt-4 text-xs text-muted-foreground">
              Güvenli ödeme sayfasına yönlendirilirsiniz. Ödeme onaylandığında tutar bakiyenize eklenir.
            </p>
          </SectionCard>

          {lastDeposit ? (
            <p className="px-1 text-xs text-muted-foreground">
              Son yükleme: {money(lastDeposit.amount)} · {formatDate(lastDeposit.createdAt)}
            </p>
          ) : null}
        </div>
      </div>

      <section aria-labelledby="hareketler-title" className="space-y-3">
        <div className="space-y-0.5">
          <h2 id="hareketler-title" className="text-sm font-semibold tracking-tight">
            Bakiye hareketleri
          </h2>
          <p className="text-[13px] text-muted-foreground">Yüklemeler, fatura ödemeleri ve iadeler.</p>
        </div>
        <DataTable
          caption="Bakiye hareketleri"
          columns={columns}
          data={transactions}
          initialSort={[{ id: "createdAt", desc: true }]}
          searchFn={(t, q) => t.description.toLocaleLowerCase("tr-TR").includes(q)}
          searchPlaceholder="Açıklama ara…"
          filters={[
            {
              id: "type",
              label: "Tür",
              options: (["DEPOSIT", "PAYMENT", "REFUND", "ADJUSTMENT"] as const)
                .filter((v) => transactions.some((t) => t.type === v))
                .map((v) => ({ value: v, label: enumLabel("transactionType", v) })),
              getValue: (t) => t.type,
            },
          ]}
          mobileCard={(t) => (
            <ListRow
              title={t.description}
              trailing={<SignedAmount t={t} />}
              meta={
                <>
                  <TypeBadge type={t.type} />
                  <span className="tabular-nums">{formatDateTime(t.createdAt)}</span>
                  <span className="tabular-nums">Bakiye {money(t.balanceAfter)}</span>
                </>
              }
            />
          )}
          emptyState={
            <PanelEmptyState kind="credit" />
          }
          noResultsText="Aramanızla eşleşen hareket bulunamadı."
        />
      </section>
    </>
  );
}
