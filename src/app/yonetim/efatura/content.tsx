"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { AlertTriangle, FileText, Plug, RefreshCw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { BlurFade } from "@/components/magicui/blur-fade";
import { cn } from "@/lib/utils";
import { retryEInvoiceRecordAction } from "@/lib/actions/admin/efatura";
import { toast } from "@/lib/toast";
import type { EInvoiceStatus } from "@prisma/client";
import type { getEInvoiceRecordsForAdmin, getEInvoiceStats } from "@/lib/dal/e-invoices";

type EInvoiceRecordItem = Awaited<ReturnType<typeof getEInvoiceRecordsForAdmin>>[number];
type EInvoiceStats = Awaited<ReturnType<typeof getEInvoiceStats>>;

interface EfaturaContentProps {
  records: EInvoiceRecordItem[];
  stats: EInvoiceStats;
  statusFilter: string;
}

const statusLabels: Record<EInvoiceStatus, { label: string; className: string }> = {
  DRAFT: {
    label: "Taslak",
    className: "bg-zinc-500/10 text-zinc-600 dark:text-zinc-400 border-zinc-500/20",
  },
  QUEUED: {
    label: "Kuyrukta",
    className: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20",
  },
  SENT: {
    label: "Gönderildi",
    className: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
  },
  ACCEPTED: {
    label: "Kabul Edildi",
    className: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
  },
  REJECTED: {
    label: "Reddedildi",
    className: "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20",
  },
  FAILED: {
    label: "Başarısız",
    className: "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20",
  },
};

const statusTabs = [
  { value: "all", label: "Tümü", href: "/yonetim/efatura" },
  { value: "FAILED", label: "Başarısız", href: "/yonetim/efatura?status=FAILED" },
  { value: "QUEUED", label: "Kuyrukta", href: "/yonetim/efatura?status=QUEUED" },
  { value: "SENT", label: "Gönderildi", href: "/yonetim/efatura?status=SENT" },
  { value: "DRAFT", label: "Taslak", href: "/yonetim/efatura?status=DRAFT" },
];

function formatDate(date: Date | null | undefined) {
  if (!date) return "—";
  return new Intl.DateTimeFormat("tr-TR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(date);
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
    <Button size="sm" variant="outline" disabled={isPending} onClick={handleRetry}>
      <RefreshCw className={cn("h-4 w-4 mr-2", isPending && "animate-spin")} />
      {isPending ? "Gönderiliyor..." : "Yeniden Gönder"}
    </Button>
  );
}

export function EfaturaContent({ records, stats, statusFilter }: EfaturaContentProps) {
  return (
    <div className="p-6 space-y-6">
      <BlurFade delay={0.05}>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">E-Fatura / E-Arşiv</h1>
            <p className="text-sm text-zinc-500 mt-1">
              Ödenen faturalar için oluşturulan e-fatura ve e-arşiv kayıtları
            </p>
          </div>
          <Button asChild variant="outline">
            <Link href="/yonetim/entegrasyonlar?tab=efatura">
              <Plug className="h-4 w-4 mr-2" />
              Entegrasyon Ayarları
            </Link>
          </Button>
        </div>
      </BlurFade>

      <BlurFade delay={0.08}>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card className="bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800">
            <CardHeader className="pb-2">
              <CardDescription>Gönderildi</CardDescription>
              <CardTitle className="text-2xl text-emerald-600 dark:text-emerald-400">
                {stats.sent + stats.accepted}
              </CardTitle>
            </CardHeader>
          </Card>
          <Card className="bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800">
            <CardHeader className="pb-2">
              <CardDescription>Kuyrukta</CardDescription>
              <CardTitle className="text-2xl text-blue-600 dark:text-blue-400">{stats.queued}</CardTitle>
            </CardHeader>
          </Card>
          <Card className="bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800">
            <CardHeader className="pb-2">
              <CardDescription>Başarısız</CardDescription>
              <CardTitle className="text-2xl text-red-600 dark:text-red-400">{stats.failed}</CardTitle>
            </CardHeader>
          </Card>
          <Card className="bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800">
            <CardHeader className="pb-2">
              <CardDescription>Toplam Kayıt</CardDescription>
              <CardTitle className="text-2xl">{stats.total}</CardTitle>
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
            <CardTitle className="text-zinc-900 dark:text-white">Kayıtlar</CardTitle>
            <CardDescription>{records.length} kayıt listeleniyor (son 100)</CardDescription>
          </CardHeader>
          <CardContent>
            {records.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <FileText className="h-10 w-10 text-zinc-400 mb-3" />
                <p className="text-sm text-zinc-500">
                  Bu filtrede e-fatura kaydı yok. Ödeme tamamlandığında taslaklar otomatik oluşturulur.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-zinc-200 dark:border-zinc-800 text-left">
                      <th className="py-3 pr-4 font-medium text-zinc-500">Fatura</th>
                      <th className="py-3 pr-4 font-medium text-zinc-500">Müşteri</th>
                      <th className="py-3 pr-4 font-medium text-zinc-500">Tür</th>
                      <th className="py-3 pr-4 font-medium text-zinc-500">Durum</th>
                      <th className="py-3 pr-4 font-medium text-zinc-500">Belge No</th>
                      <th className="py-3 pr-4 font-medium text-zinc-500">Hata</th>
                      <th className="py-3 pr-4 font-medium text-zinc-500">Gönderim</th>
                      <th className="py-3 font-medium text-zinc-500">İşlem</th>
                    </tr>
                  </thead>
                  <tbody>
                    {records.map((record) => {
                      const status = statusLabels[record.status];
                      const customerName =
                        record.invoice.customer.companyName ||
                        `${record.invoice.customer.name} ${record.invoice.customer.surname}`.trim();
                      const canRetry = ["FAILED", "DRAFT", "QUEUED"].includes(record.status);

                      return (
                        <tr
                          key={record.id}
                          className="border-b border-zinc-100 dark:border-zinc-800/80 align-top"
                        >
                          <td className="py-3 pr-4">
                            <Link
                              href={`/yonetim/faturalar/${record.invoiceId}`}
                              className="font-medium text-primary hover:underline"
                            >
                              {record.invoice.invoiceNumber}
                            </Link>
                            <p className="text-xs text-zinc-500">
                              {record.invoice.totalAmount.toLocaleString("tr-TR")} ₺
                            </p>
                          </td>
                          <td className="py-3 pr-4 text-zinc-700 dark:text-zinc-300">{customerName}</td>
                          <td className="py-3 pr-4">
                            <Badge variant="outline">
                              {record.type === "e-fatura" ? "E-Fatura" : "E-Arşiv"}
                            </Badge>
                          </td>
                          <td className="py-3 pr-4">
                            <Badge variant="outline" className={cn(status.className)}>
                              {status.label}
                            </Badge>
                          </td>
                          <td className="py-3 pr-4 text-zinc-600 dark:text-zinc-400">
                            {record.documentNumber || "—"}
                          </td>
                          <td className="py-3 pr-4 max-w-xs">
                            {record.errorMessage ? (
                              <details>
                                <summary className="cursor-pointer list-none flex items-center gap-1 text-red-600 dark:text-red-400">
                                  <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                                  <span className="truncate">{record.errorMessage}</span>
                                </summary>
                                <p className="mt-2 text-xs text-zinc-600 dark:text-zinc-400 break-words">
                                  {record.errorMessage}
                                </p>
                              </details>
                            ) : (
                              <span className="text-zinc-500">—</span>
                            )}
                          </td>
                          <td className="py-3 pr-4 text-zinc-600 dark:text-zinc-400">
                            {formatDate(record.sentAt)}
                          </td>
                          <td className="py-3">
                            {canRetry ? <RetryButton recordId={record.id} /> : <span className="text-zinc-500">—</span>}
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