"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Search,
  CheckCircle,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { BlurFade } from "@/components/magicui/blur-fade";

interface OrderItem {
  id: string;
  orderNumber: string;
  status: string;
  totalAmount: number;
  createdAt: string | Date;
  customer: {
    id: string;
    name: string;
    surname: string;
    email: string;
  };
  product: {
    id: string;
    name: string;
    sku: string;
    category: { name: string } | null;
  };
}

interface ActiveOrdersContentProps {
  orders: OrderItem[];
  total: number;
  page: number;
  perPage: number;
  totalPages: number;
  activeCount: number;
}

const formatPrice = (price: number) => {
  return new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency: "TRY",
    minimumFractionDigits: 2,
  }).format(price);
};

export function ActiveOrdersContent({
  orders,
  total,
  page,
  perPage,
  totalPages,
  activeCount,
}: ActiveOrdersContentProps) {
  const router = useRouter();
  const searchParamsHook = useSearchParams();

  const currentSearch = searchParamsHook.get("search") ?? "";

  const updateParams = (key: string, value: string) => {
    const params = new URLSearchParams(searchParamsHook.toString());
    if (value) {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    params.set("page", "1");
    router.push(`?${params.toString()}`);
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <BlurFade delay={0}>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">Aktif Siparişler</h1>
            <p className="text-zinc-600 dark:text-zinc-400">Aktif durumdaki tüm siparişler</p>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-green-500/10">
            <CheckCircle className="h-5 w-5 text-green-500" />
            <span className="text-sm font-medium text-green-500">{activeCount.toLocaleString("tr-TR")} Aktif</span>
          </div>
        </div>
      </BlurFade>

      {/* Filters */}
      <BlurFade delay={0.1}>
        <Card className="bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800">
          <CardContent className="p-4">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
                <Input
                  type="search"
                  placeholder="Sipariş no, müşteri veya e-posta ara..."
                  defaultValue={currentSearch}
                  onChange={(e) => {
                    const timeout = setTimeout(() => {
                      updateParams("search", e.target.value);
                    }, 500);
                    return () => clearTimeout(timeout);
                  }}
                  className="pl-10 bg-zinc-100 dark:bg-zinc-800 border-zinc-300 dark:border-zinc-700 text-zinc-900 dark:text-white placeholder:text-zinc-500"
                />
              </div>
            </div>
          </CardContent>
        </Card>
      </BlurFade>

      {/* Table */}
      <BlurFade delay={0.2}>
        <Card className="bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-zinc-200 dark:border-zinc-800">
                    <th className="text-left p-4 text-sm font-medium text-zinc-600 dark:text-zinc-400">Sipariş No</th>
                    <th className="text-left p-4 text-sm font-medium text-zinc-600 dark:text-zinc-400">Müşteri</th>
                    <th className="text-left p-4 text-sm font-medium text-zinc-600 dark:text-zinc-400">Ürün/Hizmet</th>
                    <th className="text-left p-4 text-sm font-medium text-zinc-600 dark:text-zinc-400">Tutar</th>
                    <th className="text-left p-4 text-sm font-medium text-zinc-600 dark:text-zinc-400">Tarih</th>
                    <th className="text-right p-4 text-sm font-medium text-zinc-600 dark:text-zinc-400">İncele</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((order) => (
                    <tr
                      key={order.id}
                      className="border-b border-zinc-200 dark:border-zinc-800 last:border-0 hover:bg-zinc-100 dark:hover:bg-zinc-800/50 transition-colors"
                    >
                      <td className="p-4">
                        <span className="text-sm font-mono text-zinc-900 dark:text-white">{order.orderNumber}</span>
                      </td>
                      <td className="p-4">
                        <Link
                          href={`/yonetim/musteriler/${order.customer.id}`}
                          className="text-sm font-medium text-zinc-900 dark:text-white hover:text-primary"
                        >
                          {order.customer.name} {order.customer.surname}
                        </Link>
                      </td>
                      <td className="p-4">
                        <span className="text-sm text-zinc-900 dark:text-white">{order.product.name}</span>
                      </td>
                      <td className="p-4">
                        <span className="text-sm font-medium text-zinc-900 dark:text-white">
                          {formatPrice(Number(order.totalAmount))}
                        </span>
                      </td>
                      <td className="p-4">
                        <span className="text-sm text-zinc-600 dark:text-zinc-400">
                          {new Date(order.createdAt).toLocaleDateString("tr-TR")}
                        </span>
                      </td>
                      <td className="p-4 text-right">
                        <Link
                          href={`/yonetim/siparisler/${order.id}`}
                          className="inline-flex items-center justify-center h-8 w-8 rounded-lg bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors"
                        >
                          <Search className="h-4 w-4" />
                        </Link>
                      </td>
                    </tr>
                  ))}
                  {orders.length === 0 && (
                    <tr>
                      <td colSpan={6} className="p-8 text-center text-sm text-zinc-500">
                        Aktif sipariş bulunamadı
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between p-4 border-t border-zinc-200 dark:border-zinc-800">
                <p className="text-sm text-zinc-500">
                  Toplam {total} sipariş, sayfa {page}/{totalPages}
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page <= 1}
                    onClick={() => updateParams("page", String(page - 1))}
                    className="border-zinc-300 dark:border-zinc-700"
                  >
                    Önceki
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page >= totalPages}
                    onClick={() => updateParams("page", String(page + 1))}
                    className="border-zinc-300 dark:border-zinc-700"
                  >
                    Sonraki
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </BlurFade>
    </div>
  );
}
