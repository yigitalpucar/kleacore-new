"use client";

import Link from "next/link";
import {
  Search,
  Puzzle,
  Building2,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { BlurFade } from "@/components/magicui/blur-fade";

interface AddonItem {
  id: string;
  customer: string;
  customerId: string;
  companyName: string | null;
  orderId: string;
  mainProduct: string;
  addonName: string;
  price: number;
  period: string;
  status: string;
  createdAt: string;
}

interface EklentilerContentProps {
  addons: AddonItem[];
}

const statusConfig: Record<string, { label: string; color: string }> = {
  active: { label: "Aktif", color: "bg-green-500/10 text-green-500" },
  pending: { label: "Beklemede", color: "bg-yellow-500/10 text-yellow-500" },
  cancelled: { label: "İptal", color: "bg-red-500/10 text-red-500" },
};

const formatPrice = (price: number) => {
  return new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency: "TRY",
    minimumFractionDigits: 2,
  }).format(price);
};

export function EklentilerContent({ addons }: EklentilerContentProps) {
  return (
    <div className="space-y-6">
      {/* Page Header */}
      <BlurFade delay={0}>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">Sipariş Eklentileri</h1>
            <p className="text-zinc-600 dark:text-zinc-400">Siparişlere eklenen ek hizmetler</p>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-cyan-500/10">
            <Puzzle className="h-5 w-5 text-cyan-500" />
            <span className="text-sm font-medium text-cyan-500">{addons.length} Eklenti</span>
          </div>
        </div>
      </BlurFade>

      {/* Table */}
      <BlurFade delay={0.1}>
        <Card className="bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-zinc-200 dark:border-zinc-800">
                    <th className="text-left p-4 text-sm font-medium text-zinc-600 dark:text-zinc-400">Müşteri</th>
                    <th className="text-left p-4 text-sm font-medium text-zinc-600 dark:text-zinc-400">Ana Ürün</th>
                    <th className="text-left p-4 text-sm font-medium text-zinc-600 dark:text-zinc-400">Eklenti</th>
                    <th className="text-left p-4 text-sm font-medium text-zinc-600 dark:text-zinc-400">Fiyat</th>
                    <th className="text-left p-4 text-sm font-medium text-zinc-600 dark:text-zinc-400">Dönem</th>
                    <th className="text-left p-4 text-sm font-medium text-zinc-600 dark:text-zinc-400">Durum</th>
                    <th className="text-left p-4 text-sm font-medium text-zinc-600 dark:text-zinc-400">Tarih</th>
                    <th className="text-right p-4 text-sm font-medium text-zinc-600 dark:text-zinc-400">İncele</th>
                  </tr>
                </thead>
                <tbody>
                  {addons.map((addon) => (
                    <tr
                      key={addon.id}
                      className="border-b border-zinc-200 dark:border-zinc-800 last:border-0 hover:bg-zinc-100 dark:hover:bg-zinc-800/50 transition-colors"
                    >
                      <td className="p-4">
                        <div>
                          <Link
                            href={`/yonetim/musteriler/${addon.customerId}`}
                            className="text-sm font-medium text-zinc-900 dark:text-white hover:text-primary"
                          >
                            {addon.customer}
                          </Link>
                          {addon.companyName && (
                            <p className="text-xs text-zinc-500 flex items-center gap-1 mt-0.5">
                              <Building2 className="h-3 w-3" />
                              {addon.companyName}
                            </p>
                          )}
                        </div>
                      </td>
                      <td className="p-4">
                        <span className="text-sm text-zinc-600 dark:text-zinc-400">{addon.mainProduct}</span>
                      </td>
                      <td className="p-4">
                        <div className="flex items-center gap-2">
                          <Puzzle className="h-4 w-4 text-cyan-500" />
                          <span className="text-sm text-zinc-900 dark:text-white">{addon.addonName}</span>
                        </div>
                      </td>
                      <td className="p-4">
                        <span className="text-sm font-medium text-zinc-900 dark:text-white">
                          {formatPrice(addon.price)}
                        </span>
                      </td>
                      <td className="p-4">
                        <span className="text-sm text-zinc-600 dark:text-zinc-400">{addon.period}</span>
                      </td>
                      <td className="p-4">
                        <span className={cn(
                          "inline-flex px-2 py-0.5 rounded text-xs font-medium",
                          statusConfig[addon.status]?.color ?? "bg-zinc-500/10 text-zinc-500"
                        )}>
                          {statusConfig[addon.status]?.label ?? addon.status}
                        </span>
                      </td>
                      <td className="p-4">
                        <span className="text-sm text-zinc-600 dark:text-zinc-400">
                          {new Date(addon.createdAt).toLocaleDateString("tr-TR")}
                        </span>
                      </td>
                      <td className="p-4 text-right">
                        <Link
                          href={`/yonetim/siparisler/${addon.orderId}`}
                          className="inline-flex items-center justify-center h-8 w-8 rounded-lg bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors"
                        >
                          <Search className="h-4 w-4" />
                        </Link>
                      </td>
                    </tr>
                  ))}
                  {addons.length === 0 && (
                    <tr>
                      <td colSpan={8} className="p-8 text-center text-sm text-zinc-500">
                        Eklenti bulunamadı
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </BlurFade>
    </div>
  );
}
