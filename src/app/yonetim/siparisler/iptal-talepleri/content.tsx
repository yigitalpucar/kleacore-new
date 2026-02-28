"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Search,
  CheckCircle,
  XCircle,
  Building2,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { BlurFade } from "@/components/magicui/blur-fade";
import {
  approveCancellationRequest,
  rejectCancellationRequest,
} from "@/lib/actions/admin/cancellation-requests";
import { toast } from "@/lib/toast";

interface CancellationRequest {
  id: string;
  customer: string;
  customerId: string;
  companyName: string | null;
  orderId: string;
  product: string;
  reason: string;
  requestedAt: string;
  status: string;
  refundAmount: number;
}

interface IptalTalepleriContentProps {
  requests: CancellationRequest[];
}

const statusConfig: Record<string, { label: string; color: string }> = {
  pending: { label: "Beklemede", color: "bg-yellow-500/10 text-yellow-500" },
  approved: { label: "Onaylandı", color: "bg-green-500/10 text-green-500" },
  rejected: { label: "Reddedildi", color: "bg-red-500/10 text-red-500" },
};

const formatPrice = (price: number) => {
  return new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency: "TRY",
    minimumFractionDigits: 2,
  }).format(price);
};

export function IptalTalepleriContent({ requests: initialRequests }: IptalTalepleriContentProps) {
  const [requests, setRequests] = useState(initialRequests);

  const handleApprove = async (orderId: string) => {
    const result = await approveCancellationRequest(orderId);
    if (!result.success) {
      toast.error(result.error || "Talep onaylanamadı");
      return;
    }

    setRequests((prev) =>
      prev.map((req) =>
        req.orderId === orderId ? { ...req, status: "approved" } : req
      )
    );
    toast.success("İptal talebi onaylandı");
  };

  const handleReject = async (orderId: string) => {
    const reason = prompt("Red nedeni (opsiyonel):") ?? "";
    const result = await rejectCancellationRequest(orderId, reason);

    if (!result.success) {
      toast.error(result.error || "Talep reddedilemedi");
      return;
    }

    setRequests((prev) =>
      prev.map((req) =>
        req.orderId === orderId ? { ...req, status: "rejected" } : req
      )
    );
    toast.success("İptal talebi reddedildi");
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <BlurFade delay={0}>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">İptal Talepleri</h1>
            <p className="text-zinc-600 dark:text-zinc-400">Müşterilerden gelen iptal talepleri</p>
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
                    <th className="text-left p-4 text-sm font-medium text-zinc-600 dark:text-zinc-400">Ürün/Hizmet</th>
                    <th className="text-left p-4 text-sm font-medium text-zinc-600 dark:text-zinc-400">İptal Nedeni</th>
                    <th className="text-left p-4 text-sm font-medium text-zinc-600 dark:text-zinc-400">İade Tutarı</th>
                    <th className="text-left p-4 text-sm font-medium text-zinc-600 dark:text-zinc-400">Durum</th>
                    <th className="text-left p-4 text-sm font-medium text-zinc-600 dark:text-zinc-400">Tarih</th>
                    <th className="text-right p-4 text-sm font-medium text-zinc-600 dark:text-zinc-400">İşlemler</th>
                  </tr>
                </thead>
                <tbody>
                  {requests.map((req) => (
                    <tr
                      key={req.id}
                      className="border-b border-zinc-200 dark:border-zinc-800 last:border-0 hover:bg-zinc-100 dark:hover:bg-zinc-800/50 transition-colors"
                    >
                      <td className="p-4">
                        <div>
                          <Link
                            href={`/yonetim/musteriler/${req.customerId}`}
                            className="text-sm font-medium text-zinc-900 dark:text-white hover:text-primary"
                          >
                            {req.customer}
                          </Link>
                          {req.companyName && (
                            <p className="text-xs text-zinc-500 flex items-center gap-1 mt-0.5">
                              <Building2 className="h-3 w-3" />
                              {req.companyName}
                            </p>
                          )}
                        </div>
                      </td>
                      <td className="p-4">
                        <span className="text-sm text-zinc-900 dark:text-white">{req.product}</span>
                      </td>
                      <td className="p-4">
                        <span className="text-sm text-zinc-600 dark:text-zinc-400">{req.reason}</span>
                      </td>
                      <td className="p-4">
                        <span className="text-sm font-medium text-zinc-900 dark:text-white">
                          {req.refundAmount > 0 ? formatPrice(req.refundAmount) : "-"}
                        </span>
                      </td>
                      <td className="p-4">
                        <span className={cn(
                          "inline-flex px-2 py-0.5 rounded text-xs font-medium",
                          statusConfig[req.status]?.color ?? "bg-zinc-500/10 text-zinc-500"
                        )}>
                          {statusConfig[req.status]?.label ?? req.status}
                        </span>
                      </td>
                      <td className="p-4">
                        <span className="text-sm text-zinc-600 dark:text-zinc-400">
                          {new Date(req.requestedAt).toLocaleDateString("tr-TR")}
                        </span>
                      </td>
                      <td className="p-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {req.status === "pending" && (
                            <>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-8 w-8 p-0 text-green-500 hover:text-green-600 hover:bg-green-500/10"
                                title="Onayla"
                                onClick={() => handleApprove(req.orderId)}
                              >
                                <CheckCircle className="h-4 w-4" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-8 w-8 p-0 text-red-500 hover:text-red-600 hover:bg-red-500/10"
                                title="Reddet"
                                onClick={() => handleReject(req.orderId)}
                              >
                                <XCircle className="h-4 w-4" />
                              </Button>
                            </>
                          )}
                          <Link
                            href={`/yonetim/siparisler/${req.orderId}`}
                            className="inline-flex items-center justify-center h-8 w-8 rounded-lg bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors"
                          >
                            <Search className="h-4 w-4" />
                          </Link>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {requests.length === 0 && (
                    <tr>
                      <td colSpan={7} className="p-8 text-center text-sm text-zinc-500">
                        İptal talebi bulunamadı
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
