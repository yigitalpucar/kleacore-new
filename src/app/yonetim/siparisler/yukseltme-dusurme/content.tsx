"use client";

import Link from "next/link";
import {
  Search,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Building2,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { BlurFade } from "@/components/magicui/blur-fade";

interface OperationItem {
  id: string;
  customer: string;
  customerId: string;
  companyName: string | null;
  orderId: string;
  type: "upgrade" | "downgrade";
  fromProduct: string;
  toProduct: string;
  priceDiff: number;
  status: string;
  date: string;
}

interface YukseltmeDusurmeContentProps {
  operations: OperationItem[];
}

const typeConfig: Record<string, { label: string; color: string; icon: typeof ArrowUp }> = {
  upgrade: { label: "Yükseltme", color: "bg-green-500/10 text-green-500", icon: ArrowUp },
  downgrade: { label: "Düşürme", color: "bg-orange-500/10 text-orange-500", icon: ArrowDown },
};

const statusConfig: Record<string, { label: string; color: string }> = {
  completed: { label: "Tamamlandı", color: "bg-green-500/10 text-green-500" },
  pending: { label: "Beklemede", color: "bg-yellow-500/10 text-yellow-500" },
};

const formatPriceDiff = (price: number) => {
  const absPrice = Math.abs(price);
  const prefix = price >= 0 ? "+" : "-";
  return `${prefix}${new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency: "TRY",
    minimumFractionDigits: 2,
  }).format(absPrice)}`;
};

export function YukseltmeDusurmeContent({ operations }: YukseltmeDusurmeContentProps) {
  return (
    <div className="space-y-6">
      {/* Page Header */}
      <BlurFade delay={0}>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">Yükseltme & Düşürme</h1>
            <p className="text-zinc-600 dark:text-zinc-400">Paket değişiklik işlemleri</p>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-indigo-500/10">
            <ArrowUpDown className="h-5 w-5 text-indigo-500" />
            <span className="text-sm font-medium text-indigo-500">{operations.length} İşlem</span>
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
                    <th className="text-left p-4 text-sm font-medium text-zinc-600 dark:text-zinc-400">Tip</th>
                    <th className="text-left p-4 text-sm font-medium text-zinc-600 dark:text-zinc-400">Önceki Paket</th>
                    <th className="text-left p-4 text-sm font-medium text-zinc-600 dark:text-zinc-400">Yeni Paket</th>
                    <th className="text-left p-4 text-sm font-medium text-zinc-600 dark:text-zinc-400">Fark</th>
                    <th className="text-left p-4 text-sm font-medium text-zinc-600 dark:text-zinc-400">Durum</th>
                    <th className="text-left p-4 text-sm font-medium text-zinc-600 dark:text-zinc-400">Tarih</th>
                    <th className="text-right p-4 text-sm font-medium text-zinc-600 dark:text-zinc-400">İncele</th>
                  </tr>
                </thead>
                <tbody>
                  {operations.map((op) => {
                    const TypeIcon = typeConfig[op.type]?.icon ?? ArrowUpDown;
                    return (
                      <tr
                        key={op.id}
                        className="border-b border-zinc-200 dark:border-zinc-800 last:border-0 hover:bg-zinc-100 dark:hover:bg-zinc-800/50 transition-colors"
                      >
                        <td className="p-4">
                          <div>
                            <Link
                              href={`/yonetim/musteriler/${op.customerId}`}
                              className="text-sm font-medium text-zinc-900 dark:text-white hover:text-primary"
                            >
                              {op.customer}
                            </Link>
                            {op.companyName && (
                              <p className="text-xs text-zinc-500 flex items-center gap-1 mt-0.5">
                                <Building2 className="h-3 w-3" />
                                {op.companyName}
                              </p>
                            )}
                          </div>
                        </td>
                        <td className="p-4">
                          <span className={cn(
                            "inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium",
                            typeConfig[op.type]?.color ?? "bg-zinc-500/10 text-zinc-500"
                          )}>
                            <TypeIcon className="h-3 w-3" />
                            {typeConfig[op.type]?.label ?? op.type}
                          </span>
                        </td>
                        <td className="p-4">
                          <span className="text-sm text-zinc-600 dark:text-zinc-400">{op.fromProduct}</span>
                        </td>
                        <td className="p-4">
                          <span className="text-sm text-zinc-900 dark:text-white">{op.toProduct}</span>
                        </td>
                        <td className="p-4">
                          <span className={cn(
                            "text-sm font-medium",
                            op.priceDiff >= 0 ? "text-green-500" : "text-orange-500"
                          )}>
                            {formatPriceDiff(op.priceDiff)}
                          </span>
                        </td>
                        <td className="p-4">
                          <span className={cn(
                            "inline-flex px-2 py-0.5 rounded text-xs font-medium",
                            statusConfig[op.status]?.color ?? "bg-zinc-500/10 text-zinc-500"
                          )}>
                            {statusConfig[op.status]?.label ?? op.status}
                          </span>
                        </td>
                        <td className="p-4">
                          <span className="text-sm text-zinc-600 dark:text-zinc-400">
                            {new Date(op.date).toLocaleDateString("tr-TR")}
                          </span>
                        </td>
                        <td className="p-4 text-right">
                          <Link
                            href={`/yonetim/siparisler/${op.orderId}`}
                            className="inline-flex items-center justify-center h-8 w-8 rounded-lg bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors"
                          >
                            <Search className="h-4 w-4" />
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                  {operations.length === 0 && (
                    <tr>
                      <td colSpan={8} className="p-8 text-center text-sm text-zinc-500">
                        Yükseltme/düşürme işlemi bulunamadı
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
