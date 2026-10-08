"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CheckCircle, Clock, HandCoins, Loader2, Wallet, XCircle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import {
  DataTable,
  EmptyState,
  FormField,
  ListRow,
  PageHeader,
  StatCard,
  StatGrid,
  StatusBadge,
  appButton,
  type ColumnDef,
} from "@/components/app";
import {
  approvePayout,
  completePayout,
  rejectPayout,
} from "@/lib/actions/admin/affiliate-payouts";
import { formatTRY } from "@/lib/format/price";
import { formatDate } from "@/lib/format/date";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";

interface AffiliatePayout {
  id: string;
  affiliateId: string;
  affiliateName: string;
  affiliateEmail: string;
  companyName: string | null;
  amount: number;
  status: string;
  notes: string | null;
  processedBy: string | null;
  referralCount: number;
  payoutIban: string | null;
  createdAt: string;
  paidAt: string | null;
}

interface AffiliatePayoutStats {
  totalPending: number;
  pendingCount: number;
  totalPaidThisMonth: number;
}

interface AffiliateOdemeleriContentProps {
  payouts: AffiliatePayout[];
  stats: AffiliatePayoutStats;
  statusFilter: string;
}

const statusTabs = [
  { value: "PENDING", label: "Bekleyen", href: "/yonetim/affiliate-odemeleri" },
  { value: "PAID", label: "Ödenen", href: "/yonetim/affiliate-odemeleri?status=PAID" },
  { value: "CANCELLED", label: "Reddedilen", href: "/yonetim/affiliate-odemeleri?status=CANCELLED" },
];

const formatPrice = (price: number) => formatTRY(price, { keepDecimals: true });

const emptyText: Record<string, string> = {
  PENDING: "Bekleyen affiliate ödeme talebi bulunmuyor.",
  PAID: "Ödenmiş affiliate kaydı bulunmuyor.",
  CANCELLED: "Reddedilmiş affiliate kaydı bulunmuyor.",
};

export function AffiliateOdemeleriContent({
  payouts: initialPayouts,
  stats,
  statusFilter,
}: AffiliateOdemeleriContentProps) {
  const router = useRouter();
  const [payouts, setPayouts] = useState(initialPayouts);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [dialogType, setDialogType] = useState<"reject" | "complete" | null>(null);
  const [activePayoutId, setActivePayoutId] = useState<string | null>(null);
  const [dialogNotes, setDialogNotes] = useState("");

  const runAction = async (
    payoutId: string,
    action: () => Promise<{ success: boolean; error?: string }>,
    onSuccess: () => void
  ) => {
    setProcessingId(payoutId);
    const result = await action();
    setProcessingId(null);

    if (!result.success) {
      toast.error(result.error || "İşlem tamamlanamadı");
      return;
    }

    onSuccess();
    router.refresh();
  };

  const handleApprove = async (payoutId: string) => {
    await runAction(
      payoutId,
      () => approvePayout(payoutId),
      () => {
        setPayouts((prev) =>
          prev.map((payout) =>
            payout.id === payoutId
              ? {
                  ...payout,
                  processedBy: "approved",
                  notes: payout.notes ?? "Yönetici tarafından onaylandı",
                }
              : payout
          )
        );
        toast.success("Ödeme talebi onaylandı");
      }
    );
  };

  const openDialog = (type: "reject" | "complete", payoutId: string) => {
    setDialogType(type);
    setActivePayoutId(payoutId);
    setDialogNotes("");
  };

  const closeDialog = () => {
    setDialogType(null);
    setActivePayoutId(null);
    setDialogNotes("");
  };

  const handleDialogConfirm = async () => {
    if (!activePayoutId || !dialogType) return;

    if (dialogType === "reject") {
      await runAction(
        activePayoutId,
        () => rejectPayout(activePayoutId, dialogNotes),
        () => {
          setPayouts((prev) => prev.filter((payout) => payout.id !== activePayoutId));
          toast.success("Ödeme talebi reddedildi");
          closeDialog();
        }
      );
      return;
    }

    await runAction(
      activePayoutId,
      () => completePayout(activePayoutId, dialogNotes || undefined),
      () => {
        setPayouts((prev) => prev.filter((payout) => payout.id !== activePayoutId));
        toast.success("Ödeme tamamlandı");
        closeDialog();
      }
    );
  };

  const isPending = statusFilter === "PENDING";

  const actionButtons = (payout: AffiliatePayout, inTable = false) => (
    <div className={cn("flex items-center gap-2", inTable ? "flex-nowrap justify-end" : "flex-wrap")}>
      {!payout.processedBy && (
        <button
          type="button"
          className={appButton({ variant: "outline", size: "sm" })}
          disabled={processingId === payout.id}
          onClick={() => handleApprove(payout.id)}
        >
          {processingId === payout.id ? <Loader2 aria-hidden className="animate-spin" /> : <CheckCircle aria-hidden />}
          Onayla
        </button>
      )}
      <button
        type="button"
        className={appButton({ size: "sm" })}
        disabled={processingId === payout.id || !payout.processedBy}
        title={!payout.processedBy ? "Önce talebi onaylayın" : undefined}
        onClick={() => openDialog("complete", payout.id)}
      >
        <Wallet aria-hidden />
        Tamamla
      </button>
      <button
        type="button"
        className={appButton({ variant: "destructive", size: "sm" })}
        disabled={processingId === payout.id}
        onClick={() => openDialog("reject", payout.id)}
      >
        <XCircle aria-hidden />
        Reddet
      </button>
    </div>
  );

  const statusCell = (payout: AffiliatePayout) =>
    isPending ? (
      payout.processedBy ? (
        <StatusBadge tone="info" label="Onaylandı" />
      ) : (
        <StatusBadge kind="affiliatePayment" status="PENDING" />
      )
    ) : (
      <StatusBadge kind="affiliatePayment" status={payout.status} />
    );

  const columns: ColumnDef<AffiliatePayout>[] = [
    {
      accessorKey: "affiliateName",
      header: "Ortak",
      cell: ({ row }) => {
        const p = row.original;
        return (
          <div className="min-w-0 max-w-[260px]">
            <Link href={`/yonetim/musteriler/${p.affiliateId}`} className="font-medium hover:underline">
              {p.affiliateName}
            </Link>
            <p className="truncate text-xs text-muted-foreground">{p.affiliateEmail}</p>
            {p.companyName ? <p className="truncate text-xs text-muted-foreground">{p.companyName}</p> : null}
          </div>
        );
      },
    },
    {
      accessorKey: "amount",
      header: "Tutar",
      meta: { align: "right" },
      cell: ({ row }) => <span className="whitespace-nowrap font-medium tabular-nums">{formatPrice(row.original.amount)}</span>,
    },
    {
      accessorKey: "payoutIban",
      header: "IBAN",
      enableSorting: false,
      cell: ({ row }) => (
        <span className="whitespace-nowrap font-mono text-[12px] text-muted-foreground">{row.original.payoutIban || "—"}</span>
      ),
    },
    {
      accessorKey: "referralCount",
      header: "Referans",
      meta: { align: "right" },
      cell: ({ row }) => <span className="tabular-nums text-muted-foreground">{row.original.referralCount} kayıt</span>,
    },
    {
      id: "createdAt",
      accessorFn: (r) => r.createdAt,
      header: "Talep",
      cell: ({ row }) => (
        <div className="whitespace-nowrap tabular-nums">
          <span className="text-muted-foreground">{formatDate(row.original.createdAt)}</span>
          {row.original.paidAt ? (
            <span className="block text-xs text-muted-foreground">Ödeme: {formatDate(row.original.paidAt)}</span>
          ) : null}
        </div>
      ),
    },
    {
      id: "status",
      header: "Durum / not",
      enableSorting: false,
      cell: ({ row }) => (
        <div className="min-w-0 max-w-[220px] space-y-1">
          {statusCell(row.original)}
          {row.original.notes ? <p className="line-clamp-2 text-xs text-muted-foreground">{row.original.notes}</p> : null}
        </div>
      ),
    },
    ...(isPending
      ? [
          {
            id: "actions",
            header: () => <span className="sr-only">İşlemler</span>,
            enableSorting: false,
            meta: { align: "right" as const, className: "w-px" },
            cell: ({ row }: { row: { original: AffiliatePayout } }) => actionButtons(row.original, true),
          },
        ]
      : []),
  ];

  return (
    <>
      <PageHeader title="Affiliate ödemeleri" description="Satış ortaklığı ödeme taleplerini onaylayın, tamamlayın veya reddedin." />

      <StatGrid columns={2} className="grid-cols-1 sm:grid-cols-2">
        <StatCard
          label="Bekleyen toplam"
          value={formatPrice(stats.totalPending)}
          icon={Clock}
          hint={stats.pendingCount > 0 ? `${stats.pendingCount} talep` : "Bekleyen talep yok"}
          tone={stats.pendingCount > 0 ? "warning" : undefined}
        />
        <StatCard label="Bu ay ödenen" value={formatPrice(stats.totalPaidThisMonth)} icon={Wallet} />
      </StatGrid>

      <nav aria-label="Ödeme durumu" className="-mx-1 flex max-w-full gap-1 overflow-x-auto px-1 pb-0.5 [scrollbar-width:none]">
        {statusTabs.map((tab) => {
          const active = statusFilter === tab.value;
          return (
            <Link
              key={tab.value}
              href={tab.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "inline-flex h-10 shrink-0 items-center rounded-md border px-3 text-[13px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:h-8 md:px-2.5",
                active
                  ? "border-foreground bg-foreground text-background"
                  : "border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              {tab.label}
            </Link>
          );
        })}
      </nav>

      <DataTable
        caption="Affiliate ödeme talepleri"
        columns={columns}
        data={payouts}
        initialSort={[{ id: "createdAt", desc: true }]}
        searchFn={(p, q) =>
          p.affiliateName.toLocaleLowerCase("tr-TR").includes(q) ||
          p.affiliateEmail.toLocaleLowerCase("tr-TR").includes(q) ||
          (p.companyName ?? "").toLocaleLowerCase("tr-TR").includes(q)
        }
        searchPlaceholder="Ortak adı, e-posta veya firma ara…"
        mobileCard={(p) => (
          <div className="space-y-3">
            <ListRow
              title={p.affiliateName}
              subtitle={p.payoutIban ? <span className="font-mono text-[12px]">{p.payoutIban}</span> : p.affiliateEmail}
              trailing={formatPrice(p.amount)}
              meta={
                <>
                  {statusCell(p)}
                  <span>{p.referralCount} kayıt</span>
                  <span className="tabular-nums">{formatDate(p.createdAt)}</span>
                  {p.notes ? <span className="w-full line-clamp-2">{p.notes}</span> : null}
                </>
              }
            />
            {isPending ? actionButtons(p) : null}
          </div>
        )}
        emptyState={<EmptyState icon={HandCoins} title={emptyText[statusFilter] ?? emptyText.PENDING} />}
      />

      <Dialog open={dialogType !== null} onOpenChange={(open) => !open && closeDialog()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{dialogType === "reject" ? "Ödeme talebini reddet" : "Ödemeyi tamamla"}</DialogTitle>
            <DialogDescription>
              {dialogType === "reject"
                ? "Red nedeni isteğe bağlıdır. Reddedilen talepteki komisyonlar yeniden kullanılabilir hâle gelir."
                : "Ödeme notu isteğe bağlıdır. Tamamlanan ödemede ortağa e-posta ve SMS bildirimi gönderilir."}
            </DialogDescription>
          </DialogHeader>
          <FormField label={dialogType === "reject" ? "Red nedeni" : "Ödeme notu"} htmlFor="payout-notes">
            <Textarea
              id="payout-notes"
              value={dialogNotes}
              onChange={(e) => setDialogNotes(e.target.value)}
              placeholder={dialogType === "reject" ? "İsteğe bağlı açıklama" : "Havale referansı vb."}
            />
          </FormField>
          <DialogFooter className="gap-2">
            <button type="button" className={appButton({ variant: "outline" })} onClick={closeDialog}>
              İptal
            </button>
            <button
              type="button"
              className={appButton({ variant: dialogType === "reject" ? "destructive" : "primary" })}
              disabled={processingId === activePayoutId}
              onClick={handleDialogConfirm}
            >
              {processingId !== null && processingId === activePayoutId ? <Loader2 aria-hidden className="animate-spin" /> : null}
              {dialogType === "reject" ? "Reddet" : "Tamamla"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
