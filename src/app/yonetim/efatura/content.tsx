"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { AlertTriangle, Ban, Download, FileText, Plug, RefreshCw } from "lucide-react";
import {
  DataTable,
  EmptyState,
  ListRow,
  PageHeader,
  StatCard,
  StatGrid,
  StatusBadge,
  appButton,
  type ColumnDef,
} from "@/components/app";
import { LinkTabs } from "@/components/admin-b/icerik/link-tabs";
import { cn } from "@/lib/utils";
import { formatDateTime } from "@/lib/format/date";
import { formatTRY } from "@/lib/format/price";
import {
  cancelEInvoiceRecordAction,
  retryEInvoiceRecordAction,
  syncEInvoiceStatusesAction,
} from "@/lib/actions/admin/efatura";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/lib/toast";
import type { getEInvoiceRecordsForAdmin, getEInvoiceStats } from "@/lib/dal/e-invoices";

type EInvoiceRecordItem = Awaited<ReturnType<typeof getEInvoiceRecordsForAdmin>>[number];
type EInvoiceStats = Awaited<ReturnType<typeof getEInvoiceStats>>;

interface EfaturaContentProps {
  records: EInvoiceRecordItem[];
  stats: EInvoiceStats;
  statusFilter: string;
  configProblem: string | null;
  testMode: boolean;
}

const money = (n: number) => formatTRY(Number(n), { keepDecimals: true });
const invoiceHref = (r: EInvoiceRecordItem) => `/yonetim/faturalar/${r.invoiceId}`;
const typeLabel = (type: string) => (type === "e-fatura" ? "E-Fatura" : "E-Arşiv");
const canRetry = (status: string) => ["FAILED", "DRAFT", "QUEUED"].includes(status);
const hasPdf = (r: EInvoiceRecordItem) =>
  Boolean(r.documentUuid) && r.provider !== "parasut" && ["SENT", "ACCEPTED", "CANCELLED"].includes(r.status);
const canCancel = (r: EInvoiceRecordItem) => r.type === "e-arsiv" && ["SENT", "ACCEPTED"].includes(r.status);
const pdfHref = (r: EInvoiceRecordItem) => `/api/faturalar/${r.invoiceId}/e-belge`;

function customerName(record: EInvoiceRecordItem) {
  const c = record.invoice.customer;
  return c.companyName || `${c.name} ${c.surname}`.trim();
}

function RetryButton({ recordId }: { recordId: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const handleRetry = () => {
    startTransition(async () => {
      const result = await retryEInvoiceRecordAction(recordId);
      if (!result.success) {
        toast.error(result.error || "Yeniden gönderim başarısız");
        return;
      }
      toast.success("E-fatura yeniden gönderildi");
      router.refresh();
    });
  };

  return (
    <button
      type="button"
      disabled={isPending}
      onClick={handleRetry}
      className={appButton({ variant: "outline", size: "sm" })}
    >
      <RefreshCw aria-hidden className={cn(isPending && "animate-spin")} />
      {isPending ? "Gönderiliyor…" : "Yeniden gönder"}
    </button>
  );
}

function PdfLink({ record }: { record: EInvoiceRecordItem }) {
  return (
    <a
      href={pdfHref(record)}
      className={appButton({ variant: "ghost", size: "icon-sm" })}
      aria-label={`${record.documentNumber ?? "E-belge"} PDF indir`}
    >
      <Download aria-hidden />
    </a>
  );
}

function CancelButton({ record }: { record: EInvoiceRecordItem }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [isPending, startTransition] = useTransition();

  const handleCancel = () => {
    startTransition(async () => {
      const result = await cancelEInvoiceRecordAction(record.id, reason);
      if (!result.success) {
        toast.error(result.error || "E-Arşiv iptal edilemedi");
        return;
      }
      toast.success("E-Arşiv fatura iptal edildi");
      setOpen(false);
      router.refresh();
    });
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={appButton({ variant: "ghost", size: "icon-sm" })}
        aria-label={`${record.documentNumber ?? "E-Arşiv"} iptal et`}
      >
        <Ban aria-hidden />
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>E-Arşiv faturayı iptal et</DialogTitle>
            <DialogDescription>
              {record.documentNumber} numaralı belge GİB&apos;e iptal olarak bildirilir. Bu işlem geri alınamaz; KLEACORE
              faturası ve ödeme kaydı değişmez.
            </DialogDescription>
          </DialogHeader>
          <label htmlFor={`cancel-${record.id}`} className="text-sm font-medium">
            İptal nedeni
          </label>
          <Textarea
            id={`cancel-${record.id}`}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="Ör. hatalı alıcı bilgisi"
            className="min-h-20"
          />
          <DialogFooter>
            <button type="button" onClick={() => setOpen(false)} className={appButton({ variant: "outline" })}>
              Vazgeç
            </button>
            <button
              type="button"
              disabled={isPending || reason.trim().length < 3}
              onClick={handleCancel}
              className={appButton({ variant: "destructive" })}
            >
              {isPending ? "İptal ediliyor…" : "İptal et"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function SyncStatusesButton() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const handleSync = () => {
    startTransition(async () => {
      const result = await syncEInvoiceStatusesAction();
      if (!result.success) {
        toast.error(result.error || "Durumlar güncellenemedi");
        return;
      }
      toast.success(
        result.checked
          ? `${result.checked.toLocaleString("tr-TR")} belge sorgulandı, ${result.changed.toLocaleString("tr-TR")} durum değişti`
          : "Sorgulanacak belge yok"
      );
      router.refresh();
    });
  };

  return (
    <button type="button" disabled={isPending} onClick={handleSync} className={appButton({ variant: "outline" })}>
      <RefreshCw aria-hidden className={cn(isPending && "animate-spin")} />
      {isPending ? "Sorgulanıyor…" : "Durumları güncelle"}
    </button>
  );
}

function RowActions({ record }: { record: EInvoiceRecordItem }) {
  return (
    <div className="flex items-center justify-end gap-1">
      {hasPdf(record) ? <PdfLink record={record} /> : null}
      {canCancel(record) ? <CancelButton record={record} /> : null}
      {canRetry(record.status) ? <RetryButton recordId={record.id} /> : null}
    </div>
  );
}

function ErrorDetails({ message }: { message: string }) {
  return (
    <details className="group max-w-xs">
      <summary className="flex cursor-pointer list-none items-center gap-1.5 text-red-600 dark:text-red-400 [&::-webkit-details-marker]:hidden">
        <AlertTriangle aria-hidden className="size-3.5 shrink-0" />
        <span className="truncate text-[13px]">{message}</span>
      </summary>
      <p className="mt-2 whitespace-pre-wrap break-words rounded-md border bg-muted/40 p-2 font-mono text-xs text-muted-foreground">
        {message}
      </p>
    </details>
  );
}

const columns: ColumnDef<EInvoiceRecordItem>[] = [
  {
    id: "invoice",
    accessorFn: (r) => r.invoice.invoiceNumber,
    header: "Fatura",
    cell: ({ row }) => (
      <div className="min-w-0">
        <Link href={invoiceHref(row.original)} className="font-mono text-[13px] font-medium hover:underline">
          {row.original.invoice.invoiceNumber}
        </Link>
        <p className="text-xs tabular-nums text-muted-foreground">{money(row.original.invoice.totalAmount)}</p>
      </div>
    ),
  },
  {
    id: "customer",
    accessorFn: (r) => customerName(r),
    header: "Müşteri",
    cell: ({ row }) => <span className="block max-w-[200px] truncate">{customerName(row.original)}</span>,
  },
  {
    accessorKey: "type",
    header: "Tür",
    cell: ({ row }) => <span className="text-muted-foreground">{typeLabel(row.original.type)}</span>,
  },
  {
    accessorKey: "status",
    header: "Durum",
    enableSorting: false,
    cell: ({ row }) => <StatusBadge kind="eInvoice" status={row.original.status} />,
  },
  {
    accessorKey: "documentNumber",
    header: "Belge no",
    cell: ({ row }) => (
      <div className="min-w-0">
        <span className="font-mono text-xs text-muted-foreground">{row.original.documentNumber || "—"}</span>
        {row.original.attempts > 1 ? (
          <p className="text-xs tabular-nums text-muted-foreground">{row.original.attempts}. deneme</p>
        ) : null}
      </div>
    ),
  },
  {
    id: "error",
    header: "Hata",
    enableSorting: false,
    cell: ({ row }) =>
      row.original.errorMessage ? (
        <ErrorDetails message={row.original.errorMessage} />
      ) : row.original.cancelReason ? (
        <span className="text-[13px] text-muted-foreground">İptal: {row.original.cancelReason}</span>
      ) : (
        <span className="text-muted-foreground">—</span>
      ),
  },
  {
    id: "sentAt",
    accessorFn: (r) => (r.sentAt ? new Date(r.sentAt).getTime() : 0),
    header: "Gönderim",
    cell: ({ row }) => (
      <span className="whitespace-nowrap tabular-nums text-muted-foreground">{formatDateTime(row.original.sentAt)}</span>
    ),
  },
  {
    id: "action",
    header: () => <span className="sr-only">İşlem</span>,
    enableSorting: false,
    meta: { align: "right", className: "w-px" },
    cell: ({ row }) => <RowActions record={row.original} />,
  },
];

export function EfaturaContent({ records, stats, statusFilter, configProblem, testMode }: EfaturaContentProps) {
  const tabs = [
    { value: "all", label: "Tümü", href: "/yonetim/efatura", count: stats.total },
    { value: "FAILED", label: "Başarısız", href: "/yonetim/efatura?status=FAILED", count: stats.failed },
    { value: "QUEUED", label: "Kuyrukta", href: "/yonetim/efatura?status=QUEUED", count: stats.queued },
    { value: "SENT", label: "Gönderildi", href: "/yonetim/efatura?status=SENT", count: stats.sent },
    { value: "ACCEPTED", label: "Onaylandı", href: "/yonetim/efatura?status=ACCEPTED", count: stats.accepted },
    { value: "REJECTED", label: "Reddedildi", href: "/yonetim/efatura?status=REJECTED", count: stats.rejected },
    { value: "CANCELLED", label: "İptal", href: "/yonetim/efatura?status=CANCELLED", count: stats.cancelled },
  ];

  return (
    <>
      <PageHeader
        title="E-Fatura / E-Arşiv"
        description={
          testMode
            ? "Ödenen faturalar için kesilen e-belgeler. Uyumsoft test ortamı açık: belgelerin yasal geçerliliği yok."
            : "Ödenen faturalar için kesilen e-fatura ve e-arşiv belgeleri."
        }
        actions={
          <>
            <SyncStatusesButton />
            <Link href="/yonetim/entegrasyonlar?tab=efatura" prefetch={false} className={appButton({ variant: "outline" })}>
              <Plug aria-hidden />
              Entegrasyon ayarları
            </Link>
          </>
        }
      />

      {configProblem ? (
        <p className="flex items-center gap-2 rounded-md border bg-muted/40 px-3 py-2 text-sm">
          <AlertTriangle aria-hidden className="size-4 shrink-0 text-muted-foreground" />
          Yeni e-belge kesilmiyor: {configProblem}
        </p>
      ) : null}

      <StatGrid columns={4}>
        <StatCard
          label="Gönderildi"
          value={(stats.sent + stats.accepted).toLocaleString("tr-TR")}
          hint={`${stats.accepted.toLocaleString("tr-TR")} kabul edildi`}
          tone={stats.sent + stats.accepted ? "success" : undefined}
        />
        <StatCard
          label="Kuyrukta"
          value={stats.queued.toLocaleString("tr-TR")}
          hint="Gönderim sırası bekleyen"
          tone={stats.queued ? "info" : undefined}
        />
        <StatCard
          label="Başarısız"
          value={stats.failed.toLocaleString("tr-TR")}
          hint={stats.failed ? "Yeniden gönderim gerekiyor" : "Hatalı kayıt yok"}
          tone={stats.failed ? "danger" : undefined}
        />
        <StatCard label="Toplam kayıt" value={stats.total.toLocaleString("tr-TR")} icon={FileText} />
      </StatGrid>

      <div className="space-y-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <LinkTabs label="Durum filtresi" tabs={tabs} active={statusFilter} />
          <p className="shrink-0 text-xs text-muted-foreground">
            {records.length.toLocaleString("tr-TR")} kayıt listeleniyor (son 100)
          </p>
        </div>

        <DataTable
          caption="E-fatura kayıtları"
          columns={columns}
          data={records}
          getRowId={(r) => r.id}
          searchFn={(r, q) =>
            r.invoice.invoiceNumber.toLocaleLowerCase("tr-TR").includes(q) ||
            customerName(r).toLocaleLowerCase("tr-TR").includes(q) ||
            (r.documentNumber ?? "").toLocaleLowerCase("tr-TR").includes(q)
          }
          searchPlaceholder="Fatura, müşteri, belge no ara…"
          rowHref={invoiceHref}
          mobileCard={(r) => (
            <div className="space-y-3">
              <ListRow
                title={<span className="font-mono">{r.invoice.invoiceNumber}</span>}
                subtitle={`${customerName(r)} · ${typeLabel(r.type)}`}
                trailing={money(r.invoice.totalAmount)}
                meta={
                  <>
                    <StatusBadge kind="eInvoice" status={r.status} />
                    {r.documentNumber ? <span className="font-mono">{r.documentNumber}</span> : null}
                    {r.sentAt ? <span className="tabular-nums">{formatDateTime(r.sentAt)}</span> : null}
                  </>
                }
              />
              {r.errorMessage ? <ErrorDetails message={r.errorMessage} /> : null}
              <RowActions record={r} />
            </div>
          )}
          emptyState={
            <EmptyState
              icon={FileText}
              title="Bu filtrede e-fatura kaydı yok"
              description="Ödeme tamamlandığında e-belge otomatik kesilir."
            />
          }
        />
      </div>
    </>
  );
}
