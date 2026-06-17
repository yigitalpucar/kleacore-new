import Link from "next/link";
import { FileText, Plug } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { BlurFade } from "@/components/magicui/blur-fade";
import { db } from "@/lib/db";
import { cn } from "@/lib/utils";
import type { EInvoiceStatus } from "@prisma/client";

export const dynamic = "force-dynamic";

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

function formatDate(date: Date | null | undefined) {
  if (!date) return "—";
  return new Intl.DateTimeFormat("tr-TR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(date);
}

export default async function EfaturaPage() {
  const records = await db.eInvoiceRecord.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
    include: {
      invoice: {
        select: {
          invoiceNumber: true,
          totalAmount: true,
          customer: {
            select: {
              name: true,
              surname: true,
              companyName: true,
            },
          },
        },
      },
    },
  });

  return (
    <div className="p-6 space-y-6">
      <BlurFade delay={0.05}>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">E-Fatura / E-Arşiv</h1>
            <p className="text-sm text-zinc-500 mt-1">
              Ödenen faturalar için oluşturulan e-fatura ve e-arşiv taslak kayıtları
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

      <BlurFade delay={0.1}>
        <Card className="bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800">
          <CardHeader>
            <CardTitle className="text-zinc-900 dark:text-white">Kayıtlar</CardTitle>
            <CardDescription>
              {records.length} kayıt listeleniyor (son 100)
            </CardDescription>
          </CardHeader>
          <CardContent>
            {records.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <FileText className="h-10 w-10 text-zinc-400 mb-3" />
                <p className="text-sm text-zinc-500">
                  Henüz e-fatura kaydı yok. Ödeme tamamlandığında taslaklar otomatik oluşturulur.
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
                      <th className="py-3 pr-4 font-medium text-zinc-500">Gönderim</th>
                      <th className="py-3 font-medium text-zinc-500">Oluşturulma</th>
                    </tr>
                  </thead>
                  <tbody>
                    {records.map((record) => {
                      const status = statusLabels[record.status];
                      const customerName =
                        record.invoice.customer.companyName ||
                        `${record.invoice.customer.name} ${record.invoice.customer.surname}`.trim();

                      return (
                        <tr
                          key={record.id}
                          className="border-b border-zinc-100 dark:border-zinc-800/80"
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
                          <td className="py-3 pr-4 text-zinc-700 dark:text-zinc-300">
                            {customerName}
                          </td>
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
                          <td className="py-3 pr-4 text-zinc-600 dark:text-zinc-400">
                            {formatDate(record.sentAt)}
                          </td>
                          <td className="py-3 text-zinc-600 dark:text-zinc-400">
                            {formatDate(record.createdAt)}
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