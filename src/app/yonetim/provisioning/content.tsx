"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { AlertTriangle, CheckCircle2, RefreshCw, Server } from "lucide-react";
import {
  DataTable,
  EmptyState,
  ListRow,
  PageHeader,
  StatCard,
  StatGrid,
  StatusBadge,
  appButton,
  getStatusMeta,
  type ColumnDef,
} from "@/components/app";
import { LinkTabs } from "@/components/admin-b/icerik/link-tabs";
import { cn } from "@/lib/utils";
import { formatDateTime } from "@/lib/format/date";
import { retryProvisioningJobAction } from "@/lib/actions/admin/provisioning";
import { toast } from "@/lib/toast";
import type { getProvisioningJobsForAdmin, getProvisioningJobStats } from "@/lib/dal/provisioning-jobs";

type ProvisioningJobItem = Awaited<ReturnType<typeof getProvisioningJobsForAdmin>>[number];
type ProvisioningStats = Awaited<ReturnType<typeof getProvisioningJobStats>>;

interface ProvisioningContentProps {
  jobs: ProvisioningJobItem[];
  stats: ProvisioningStats;
  statusFilter: string;
}

function customerName(job: ProvisioningJobItem) {
  const customer = job.order.customer;
  return customer.companyName || `${customer.name} ${customer.surname}`.trim() || customer.email;
}

const orderHref = (job: ProvisioningJobItem) => `/yonetim/siparisler/${job.orderId}`;

function RetryButton({ jobId, disabled }: { jobId: string; disabled?: boolean }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [activeJobId, setActiveJobId] = useState<string | null>(null);

  const handleRetry = () => {
    setActiveJobId(jobId);
    startTransition(async () => {
      try {
        const result = await retryProvisioningJobAction(jobId);
        if (!result.success) {
          toast.error(result.error || "Yeniden deneme başarısız");
          return;
        }

        toast.success("Provisioning başarıyla tamamlandı");
        router.refresh();
      } finally {
        setActiveJobId(null);
      }
    });
  };

  const loading = isPending && activeJobId === jobId;

  return (
    <button
      type="button"
      disabled={disabled || loading}
      onClick={handleRetry}
      className={appButton({ variant: "outline", size: "sm" })}
    >
      <RefreshCw aria-hidden className={cn(loading && "animate-spin")} />
      {loading ? "Deneniyor…" : "Yeniden dene"}
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
      <pre className="mt-2 whitespace-pre-wrap break-words rounded-md border bg-muted/40 p-2 font-mono text-xs text-muted-foreground">
        {message}
      </pre>
    </details>
  );
}

function ServiceLink({ job }: { job: ProvisioningJobItem }) {
  const serviceId = job.serviceId ?? job.order.serviceId;
  if (!serviceId) return <span className="text-muted-foreground">—</span>;
  return (
    <Link href={`/yonetim/hizmetler/${serviceId}`} className="hover:underline">
      {job.service?.label || job.service?.domain || serviceId.slice(0, 8)}
    </Link>
  );
}

const columns: ColumnDef<ProvisioningJobItem>[] = [
  {
    id: "order",
    accessorFn: (j) => new Date(j.createdAt).getTime(),
    header: "Sipariş",
    cell: ({ row }) => (
      <div className="min-w-0">
        <Link href={orderHref(row.original)} className="font-mono text-[13px] font-medium hover:underline">
          {row.original.order.orderNumber}
        </Link>
        <p className="whitespace-nowrap text-xs tabular-nums text-muted-foreground">
          {formatDateTime(row.original.createdAt)}
        </p>
      </div>
    ),
  },
  {
    id: "customer",
    accessorFn: (j) => customerName(j),
    header: "Müşteri",
    cell: ({ row }) => (
      <Link
        href={`/yonetim/musteriler/${row.original.order.customer.id}`}
        className="block max-w-[180px] truncate hover:underline"
      >
        {customerName(row.original)}
      </Link>
    ),
  },
  {
    id: "product",
    accessorFn: (j) => j.order.product.name,
    header: "Ürün",
    cell: ({ row }) => (
      <div className="min-w-0">
        <p>{row.original.order.product.name}</p>
        <p className="text-xs text-muted-foreground">{row.original.order.product.category.name}</p>
      </div>
    ),
  },
  {
    id: "service",
    header: "Hizmet",
    enableSorting: false,
    cell: ({ row }) => <ServiceLink job={row.original} />,
  },
  {
    accessorKey: "status",
    header: "Durum",
    enableSorting: false,
    cell: ({ row }) => <StatusBadge kind="provisioning" status={row.original.status} />,
  },
  {
    id: "attempts",
    accessorFn: (j) => j.attempts,
    header: "Deneme",
    meta: { align: "right" },
    cell: ({ row }) => (
      <span className="font-mono text-xs tabular-nums">
        {row.original.attempts}/{row.original.maxAttempts}
      </span>
    ),
  },
  {
    id: "nextRetryAt",
    accessorFn: (j) => new Date(j.nextRetryAt).getTime(),
    header: "Sonraki deneme",
    cell: ({ row }) => (
      <span className="whitespace-nowrap tabular-nums text-muted-foreground">
        {formatDateTime(row.original.nextRetryAt)}
      </span>
    ),
  },
  {
    id: "error",
    header: "Hata",
    enableSorting: false,
    cell: ({ row }) =>
      row.original.lastError ? (
        <ErrorDetails message={row.original.lastError} />
      ) : (
        <span className="text-muted-foreground">—</span>
      ),
  },
  {
    id: "action",
    header: () => <span className="sr-only">İşlem</span>,
    enableSorting: false,
    meta: { align: "right", className: "w-px" },
    cell: ({ row }) => <RetryButton jobId={row.original.id} disabled={row.original.status === "PROCESSING"} />,
  },
];

export function ProvisioningContent({ jobs, stats, statusFilter }: ProvisioningContentProps) {
  const tabs = [
    { value: "active", label: "Aktif", href: "/yonetim/provisioning", count: stats.failed + stats.pending + stats.processing },
    { value: "FAILED", label: "Başarısız", href: "/yonetim/provisioning?status=FAILED", count: stats.failed },
    { value: "PENDING", label: "Sırada", href: "/yonetim/provisioning?status=PENDING", count: stats.pending },
    { value: "PROCESSING", label: "İşleniyor", href: "/yonetim/provisioning?status=PROCESSING", count: stats.processing },
    { value: "COMPLETED", label: "Tamamlanan", href: "/yonetim/provisioning?status=COMPLETED", count: stats.completed },
    { value: "all", label: "Tümü", href: "/yonetim/provisioning?status=all" },
  ];

  const scopeLabel =
    statusFilter === "active" || statusFilter === "all"
      ? statusFilter === "all"
        ? "tüm durumlar"
        : "başarısız, bekleyen, işleniyor"
      : getStatusMeta("provisioning", statusFilter).label.toLocaleLowerCase("tr-TR");

  return (
    <>
      <PageHeader
        title="Provisioning kuyruğu"
        description="Başarısız veya bekleyen kurulum işlerini görüntüleyin ve elle yeniden deneyin."
        actions={
          <Link href="/yonetim/entegrasyonlar?tab=provisioning" className={appButton({ variant: "outline" })}>
            <Server aria-hidden />
            Entegrasyon ayarları
          </Link>
        }
      />

      <StatGrid columns={4}>
        <StatCard
          label="Başarısız"
          value={stats.failed.toLocaleString("tr-TR")}
          hint={stats.failed ? "Müdahale gerekiyor" : "Başarısız iş yok"}
          tone={stats.failed ? "danger" : undefined}
        />
        <StatCard
          label="Sırada"
          value={stats.pending.toLocaleString("tr-TR")}
          hint="Otomatik yeniden denenecek"
          tone={stats.pending ? "warning" : undefined}
        />
        <StatCard
          label="İşleniyor"
          value={stats.processing.toLocaleString("tr-TR")}
          hint="Şu anda çalışan işler"
          tone={stats.processing ? "info" : undefined}
        />
        <StatCard
          label="Tamamlanan"
          value={stats.completed.toLocaleString("tr-TR")}
          tone={stats.completed ? "success" : undefined}
          hint="Başarıyla kurulan"
        />
      </StatGrid>

      <div className="space-y-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <LinkTabs label="Durum filtresi" tabs={tabs} active={statusFilter} />
          <p className="shrink-0 text-xs text-muted-foreground">
            {jobs.length.toLocaleString("tr-TR")} kayıt · {scopeLabel}
          </p>
        </div>

        <DataTable
          caption="Provisioning işleri"
          columns={columns}
          data={jobs}
          getRowId={(j) => j.id}
          initialSort={[{ id: "order", desc: true }]}
          searchFn={(j, q) =>
            j.order.orderNumber.toLocaleLowerCase("tr-TR").includes(q) ||
            customerName(j).toLocaleLowerCase("tr-TR").includes(q) ||
            j.order.product.name.toLocaleLowerCase("tr-TR").includes(q)
          }
          searchPlaceholder="Sipariş, müşteri, ürün ara…"
          rowHref={orderHref}
          mobileCard={(j) => (
            <div className="space-y-3">
              <ListRow
                title={<span className="font-mono">{j.order.orderNumber}</span>}
                subtitle={`${customerName(j)} · ${j.order.product.name}`}
                trailing={
                  <span className="font-mono text-xs font-normal text-muted-foreground">
                    {j.attempts}/{j.maxAttempts} deneme
                  </span>
                }
                meta={
                  <>
                    <StatusBadge kind="provisioning" status={j.status} />
                    <span className="tabular-nums">Sonraki: {formatDateTime(j.nextRetryAt)}</span>
                  </>
                }
              />
              {j.lastError ? <ErrorDetails message={j.lastError} /> : null}
              <RetryButton jobId={j.id} disabled={j.status === "PROCESSING"} />
            </div>
          )}
          emptyState={
            <EmptyState
              icon={CheckCircle2}
              title="Bekleyen veya başarısız iş yok"
              description="Tüm provisioning işleri tamamlandı."
            />
          }
        />
      </div>
    </>
  );
}
