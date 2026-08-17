"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Loader2,
  RefreshCw,
  Server,
  XCircle,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { BlurFade } from "@/components/magicui/blur-fade";
import { cn } from "@/lib/utils";
import { retryProvisioningJobAction } from "@/lib/actions/admin/provisioning";
import { toast } from "@/lib/toast";
import type { ProvisioningJobStatus } from "@prisma/client";
import type { getProvisioningJobsForAdmin, getProvisioningJobStats } from "@/lib/dal/provisioning-jobs";

type ProvisioningJobItem = Awaited<ReturnType<typeof getProvisioningJobsForAdmin>>[number];
type ProvisioningStats = Awaited<ReturnType<typeof getProvisioningJobStats>>;

interface ProvisioningContentProps {
  jobs: ProvisioningJobItem[];
  stats: ProvisioningStats;
  statusFilter: string;
}

const statusLabels: Record<
  ProvisioningJobStatus,
  { label: string; className: string; icon: React.ComponentType<{ className?: string }> }
> = {
  PENDING: {
    label: "Bekliyor",
    className: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
    icon: Clock,
  },
  PROCESSING: {
    label: "İşleniyor",
    className: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20",
    icon: Loader2,
  },
  COMPLETED: {
    label: "Tamamlandı",
    className: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
    icon: CheckCircle2,
  },
  FAILED: {
    label: "Başarısız",
    className: "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20",
    icon: XCircle,
  },
};

function formatDate(date: Date | null | undefined) {
  if (!date) return "—";
  return new Intl.DateTimeFormat("tr-TR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(date);
}

function customerName(job: ProvisioningJobItem) {
  const customer = job.order.customer;
  return (
    customer.companyName || `${customer.name} ${customer.surname}`.trim() || customer.email
  );
}

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
    <Button
      size="sm"
      variant="outline"
      disabled={disabled || loading}
      onClick={handleRetry}
    >
      <RefreshCw className={cn("h-4 w-4 mr-2", loading && "animate-spin")} />
      {loading ? "Deneniyor..." : "Yeniden Dene"}
    </Button>
  );
}

const statusTabs = [
  { value: "active", label: "Aktif", href: "/yonetim/provisioning" },
  { value: "FAILED", label: "Başarısız", href: "/yonetim/provisioning?status=FAILED" },
  { value: "PENDING", label: "Bekleyen", href: "/yonetim/provisioning?status=PENDING" },
  { value: "PROCESSING", label: "İşleniyor", href: "/yonetim/provisioning?status=PROCESSING" },
  { value: "COMPLETED", label: "Tamamlanan", href: "/yonetim/provisioning?status=COMPLETED" },
  { value: "all", label: "Tümü", href: "/yonetim/provisioning?status=all" },
];

export function ProvisioningContent({ jobs, stats, statusFilter }: ProvisioningContentProps) {
  return (
    <div className="space-y-6">
      <BlurFade delay={0.05}>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">
              Provisioning Kuyruğu
            </h1>
            <p className="text-sm text-zinc-500 mt-1">
              Başarısız veya bekleyen provisioning işlerini görüntüleyin ve manuel yeniden deneyin
            </p>
          </div>
          <Button asChild variant="outline">
            <Link href="/yonetim/entegrasyonlar?tab=provisioning">
              <Server className="h-4 w-4 mr-2" />
              Entegrasyon Ayarları
            </Link>
          </Button>
        </div>
      </BlurFade>

      <BlurFade delay={0.08}>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card className="bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800">
            <CardHeader className="pb-2">
              <CardDescription>Başarısız</CardDescription>
              <CardTitle className="text-2xl text-red-600 dark:text-red-400">{stats.failed}</CardTitle>
            </CardHeader>
          </Card>
          <Card className="bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800">
            <CardHeader className="pb-2">
              <CardDescription>Bekleyen</CardDescription>
              <CardTitle className="text-2xl text-amber-600 dark:text-amber-400">
                {stats.pending}
              </CardTitle>
            </CardHeader>
          </Card>
          <Card className="bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800">
            <CardHeader className="pb-2">
              <CardDescription>İşleniyor</CardDescription>
              <CardTitle className="text-2xl text-blue-600 dark:text-blue-400">
                {stats.processing}
              </CardTitle>
            </CardHeader>
          </Card>
          <Card className="bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800">
            <CardHeader className="pb-2">
              <CardDescription>Tamamlanan</CardDescription>
              <CardTitle className="text-2xl text-emerald-600 dark:text-emerald-400">
                {stats.completed}
              </CardTitle>
            </CardHeader>
          </Card>
        </div>
      </BlurFade>

      <BlurFade delay={0.09}>
        <div className="flex flex-wrap gap-2">
          {statusTabs.map((tab) => (
            <Button
              key={tab.value}
              asChild
              size="sm"
              variant={statusFilter === tab.value ? "default" : "outline"}
            >
              <Link href={tab.href}>{tab.label}</Link>
            </Button>
          ))}
        </div>
      </BlurFade>

      <BlurFade delay={0.1}>
        <Card className="bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800">
          <CardHeader>
            <CardTitle className="text-zinc-900 dark:text-white">Provisioning İşleri</CardTitle>
            <CardDescription>
              {jobs.length} kayıt listeleniyor
              {statusFilter !== "all" ? ` (${statusFilter})` : " (başarısız, bekleyen, işleniyor)"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {jobs.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <CheckCircle2 className="h-10 w-10 text-emerald-500 mb-3" />
                <p className="text-sm text-zinc-500">
                  Bekleyen veya başarısız provisioning işi yok.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-zinc-200 dark:border-zinc-800 text-left">
                      <th className="py-3 pr-4 font-medium text-zinc-500">Sipariş</th>
                      <th className="py-3 pr-4 font-medium text-zinc-500">Müşteri</th>
                      <th className="py-3 pr-4 font-medium text-zinc-500">Ürün</th>
                      <th className="py-3 pr-4 font-medium text-zinc-500">Hizmet</th>
                      <th className="py-3 pr-4 font-medium text-zinc-500">Durum</th>
                      <th className="py-3 pr-4 font-medium text-zinc-500">Deneme</th>
                      <th className="py-3 pr-4 font-medium text-zinc-500">Sonraki Deneme</th>
                      <th className="py-3 pr-4 font-medium text-zinc-500">Hata</th>
                      <th className="py-3 font-medium text-zinc-500">İşlem</th>
                    </tr>
                  </thead>
                  <tbody>
                    {jobs.map((job) => {
                      const status = statusLabels[job.status];
                      const StatusIcon = status.icon;
                      const serviceId = job.serviceId ?? job.order.serviceId;

                      return (
                        <tr
                          key={job.id}
                          className="border-b border-zinc-100 dark:border-zinc-800/80 align-top"
                        >
                          <td className="py-3 pr-4">
                            <Link
                              href={`/yonetim/siparisler/${job.orderId}`}
                              className="font-medium text-primary hover:underline"
                            >
                              {job.order.orderNumber}
                            </Link>
                            <p className="text-xs text-zinc-500">{formatDate(job.createdAt)}</p>
                          </td>
                          <td className="py-3 pr-4 text-zinc-700 dark:text-zinc-300">
                            <Link
                              href={`/yonetim/musteriler/${job.order.customer.id}`}
                              className="hover:underline"
                            >
                              {customerName(job)}
                            </Link>
                          </td>
                          <td className="py-3 pr-4">
                            <p className="text-zinc-700 dark:text-zinc-300">{job.order.product.name}</p>
                            <Badge variant="outline" className="mt-1">
                              {job.order.product.category.name}
                            </Badge>
                          </td>
                          <td className="py-3 pr-4">
                            {serviceId ? (
                              <Link
                                href={`/yonetim/hizmetler/${serviceId}`}
                                className="text-primary hover:underline"
                              >
                                {job.service?.label || job.service?.domain || serviceId.slice(0, 8)}
                              </Link>
                            ) : (
                              <span className="text-zinc-500">—</span>
                            )}
                          </td>
                          <td className="py-3 pr-4">
                            <Badge variant="outline" className={cn(status.className)}>
                              <StatusIcon
                                className={cn(
                                  "h-3 w-3 mr-1",
                                  job.status === "PROCESSING" && "animate-spin"
                                )}
                              />
                              {status.label}
                            </Badge>
                          </td>
                          <td className="py-3 pr-4 text-zinc-600 dark:text-zinc-400">
                            {job.attempts}/{job.maxAttempts}
                          </td>
                          <td className="py-3 pr-4 text-zinc-600 dark:text-zinc-400">
                            {formatDate(job.nextRetryAt)}
                          </td>
                          <td className="py-3 pr-4 max-w-xs">
                            {job.lastError ? (
                              <details className="group">
                                <summary className="cursor-pointer list-none flex items-center gap-1 text-red-600 dark:text-red-400">
                                  <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                                  <span className="truncate">{job.lastError}</span>
                                </summary>
                                <pre className="mt-2 whitespace-pre-wrap break-words rounded-md bg-zinc-100 dark:bg-zinc-800 p-2 text-xs text-zinc-700 dark:text-zinc-300">
                                  {job.lastError}
                                </pre>
                              </details>
                            ) : (
                              <span className="text-zinc-500">—</span>
                            )}
                          </td>
                          <td className="py-3">
                            <RetryButton
                              jobId={job.id}
                              disabled={job.status === "PROCESSING"}
                            />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </BlurFade>
    </div>
  );
}