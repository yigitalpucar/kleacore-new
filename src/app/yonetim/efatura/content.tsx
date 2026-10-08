"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { AlertTriangle, FileText, Plug, RefreshCw } from "lucide-react";
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
import { retryEInvoiceRecordAction } from "@/lib/actions/admin/efatura";
import { toast } from "@/lib/toast";
import type { getEInvoiceRecordsForAdmin, getEInvoiceStats } from "@/lib/dal/e-invoices";

type EInvoiceRecordItem = Awaited<ReturnType<typeof getEInvoiceRecordsForAdmin>>[number];
type EInvoiceStats = Awaited<ReturnType<typeof getEInvoiceStats>>;

interface EfaturaContentProps {
  records: EInvoiceRecordItem[];
  stats: EInvoiceStats;
  statusFilter: string;
}

const money = (n: number) => formatTRY(Number(n), { keepDecimals: true });
const invoiceHref = (r: EInvoiceRecordItem) => `/yonetim/faturalar/${r.invoiceId}`;
const typeLabel = (type: string) => (type === "e-fatura" ? "E-Fatura" : "E-Arşiv");
const canRetry = (status: string) => ["FAILED", "DRAFT", "QUEUED"].includes(status);

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
      <span className="font-mono text-xs text-muted-foreground">{row.original.documentNumber || "—"}</span>
    ),
  },
  {
    id: "error",
    header: "Hata",
    enableSorting: false,
    cell: ({ row }) =>
      row.original.errorMessage ? (
        <ErrorDetails message={row.original.errorMessage} />
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
    cell: ({ row }) => (canRetry(row.original.status) ? <RetryButton recordId={row.original.id} /> : null),
  },
];

export function EfaturaContent({ records, stats, statusFilter }: EfaturaContentProps) {
  const tabs = [
    { value: "all", label: "Tümü", href: "/yonetim/efatura", count: stats.total },
    { value: "FAILED", label: "Başarısız", href: "/yonetim/efatura?status=FAILED", count: stats.failed },
    { value: "QUEUED", label: "Kuyrukta", href: "/yonetim/efatura?status=QUEUED", count: stats.queued },
    { value: "SENT", label: "Gönderildi", href: "/yonetim/efatura?status=SENT", count: stats.sent },
    { value: "DRAFT", label: "Taslak", href: "/yonetim/efatura?status=DRAFT", count: stats.draft },
  ];

  return (
    <>
      <PageHeader
        title="E-Fatura / E-Arşiv"
        description="Ödenen faturalar için oluşturulan e-fatura ve e-arşiv kayıtları."
        actions={
          <Link href="/yonetim/entegrasyonlar?tab=efatura" className={appButton({ variant: "outline" })}>
            <Plug aria-hidden />
            Entegrasyon ayarları
          </Link>
        }
      />

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
              {canRetry(r.status) ? <RetryButton recordId={r.id} /> : null}
            </div>
          )}
          emptyState={
            <EmptyState
              icon={FileText}
              title="Bu filtrede e-fatura kaydı yok"
              description="Ödeme tamamlandığında taslaklar otomatik oluşturulur."
            />
          }
        />
      </div>
    </>
  );
}
