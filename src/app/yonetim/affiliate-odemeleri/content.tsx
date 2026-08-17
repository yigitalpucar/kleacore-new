"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Building2,
  CheckCircle,
  Clock,
  Wallet,
  XCircle,
  Users,
} from "lucide-react";
import { BlurFade } from "@/components/magicui/blur-fade";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  approvePayout,
  completePayout,
  rejectPayout,
} from "@/lib/actions/admin/affiliate-payouts";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";

interface AffiliatePayout {
  id: string;
  affiliateId: string;
  affiliateName: string;
  affiliateEmail: string;
  companyName: string | null;
  amount: number;
  status: string;
  notes: string | null;
  processedBy: string | null;
  referralCount: number;
  payoutIban: string | null;
  createdAt: string;
  paidAt: string | null;
}

interface AffiliatePayoutStats {
  totalPending: number;
  pendingCount: number;
  totalPaidThisMonth: number;
}

interface AffiliateOdemeleriContentProps {
  payouts: AffiliatePayout[];
  stats: AffiliatePayoutStats;
  statusFilter: string;
}

const statusTabs = [
  { value: "PENDING", label: "Bekleyen", href: "/yonetim/affiliate-odemeleri" },
  {
    value: "PAID",
    label: "Ödenen",
    href: "/yonetim/affiliate-odemeleri?status=PAID",
  },
  {
    value: "CANCELLED",
    label: "Reddedilen",
    href: "/yonetim/affiliate-odemeleri?status=CANCELLED",
  },
];

const formatPrice = (price: number) =>
  new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency: "TRY",
    minimumFractionDigits: 2,
  }).format(price);

export function AffiliateOdemeleriContent({
  payouts: initialPayouts,
  stats,
  statusFilter,
}: AffiliateOdemeleriContentProps) {
  const router = useRouter();
  const [payouts, setPayouts] = useState(initialPayouts);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [dialogType, setDialogType] = useState<"reject" | "complete" | null>(null);
  const [activePayoutId, setActivePayoutId] = useState<string | null>(null);
  const [dialogNotes, setDialogNotes] = useState("");

  const runAction = async (
    payoutId: string,
    action: () => Promise<{ success: boolean; error?: string }>,
    onSuccess: () => void
  ) => {
    setProcessingId(payoutId);
    const result = await action();
    setProcessingId(null);

    if (!result.success) {
      toast.error(result.error || "İşlem tamamlanamadı");
      return;
    }

    onSuccess();
    router.refresh();
  };

  const handleApprove = async (payoutId: string) => {
    await runAction(
      payoutId,
      () => approvePayout(payoutId),
      () => {
        setPayouts((prev) =>
          prev.map((payout) =>
            payout.id === payoutId
              ? {
                  ...payout,
                  processedBy: "approved",
                  notes: payout.notes ?? "Yönetici tarafından onaylandı",
                }
              : payout
          )
        );
        toast.success("Ödeme talebi onaylandı");
      }
    );
  };

  const openDialog = (type: "reject" | "complete", payoutId: string) => {
    setDialogType(type);
    setActivePayoutId(payoutId);
    setDialogNotes("");
  };

  const closeDialog = () => {
    setDialogType(null);
    setActivePayoutId(null);
    setDialogNotes("");
  };

  const handleDialogConfirm = async () => {
    if (!activePayoutId || !dialogType) return;

    if (dialogType === "reject") {
      await runAction(
        activePayoutId,
        () => rejectPayout(activePayoutId, dialogNotes),
        () => {
          setPayouts((prev) => prev.filter((payout) => payout.id !== activePayoutId));
          toast.success("Ödeme talebi reddedildi");
          closeDialog();
        }
      );
      return;
    }

    await runAction(
      activePayoutId,
      () => completePayout(activePayoutId, dialogNotes || undefined),
      () => {
        setPayouts((prev) => prev.filter((payout) => payout.id !== activePayoutId));
        toast.success("Ödeme tamamlandı");
        closeDialog();
      }
    );
  };

  return (
    <div className="space-y-6">
      <BlurFade delay={0}>
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">
            Affiliate Ödemeleri
          </h1>
          <p className="text-zinc-600 dark:text-zinc-400">
            Satış ortaklığı ödeme taleplerini yönetin
          </p>
        </div>
      </BlurFade>

      <BlurFade delay={0.05}>
        <div className="grid gap-4 sm:grid-cols-2">
          <Card className="bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-orange-500/10">
                  <Clock className="h-5 w-5 text-orange-500" />
                </div>
                <div>
                  <p className="text-sm text-zinc-600 dark:text-zinc-400">Bekleyen Toplam</p>
                  <p className="text-2xl font-bold text-zinc-900 dark:text-white">
                    {formatPrice(stats.totalPending)}
                  </p>
                  <p className="text-xs text-zinc-500">{stats.pendingCount} talep</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-green-500/10">
                  <Wallet className="h-5 w-5 text-green-500" />
                </div>
                <div>
                  <p className="text-sm text-zinc-600 dark:text-zinc-400">Bu Ay Ödenen</p>
                  <p className="text-2xl font-bold text-zinc-900 dark:text-white">
                    {formatPrice(stats.totalPaidThisMonth)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </BlurFade>

      <BlurFade delay={0.08}>
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
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-zinc-200 dark:border-zinc-800">
                    <th className="text-left p-4 text-sm font-medium text-zinc-600 dark:text-zinc-400">
                      Ortak
                    </th>
                    <th className="text-left p-4 text-sm font-medium text-zinc-600 dark:text-zinc-400">
                      Tutar
                    </th>
                    <th className="text-left p-4 text-sm font-medium text-zinc-600 dark:text-zinc-400">
                      IBAN
                    </th>
                    <th className="text-left p-4 text-sm font-medium text-zinc-600 dark:text-zinc-400">
                      Referans
                    </th>
                    <th className="text-left p-4 text-sm font-medium text-zinc-600 dark:text-zinc-400">
                      Talep Tarihi
                    </th>
                    <th className="text-left p-4 text-sm font-medium text-zinc-600 dark:text-zinc-400">
                      Durum / Not
                    </th>
                    {statusFilter === "PENDING" && (
                      <th className="text-right p-4 text-sm font-medium text-zinc-600 dark:text-zinc-400">
                        İşlemler
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {payouts.map((payout) => (
                    <tr
                      key={payout.id}
                      className="border-b border-zinc-200 dark:border-zinc-800 last:border-0 hover:bg-zinc-100 dark:hover:bg-zinc-800/50 transition-colors"
                    >
                      <td className="p-4">
                        <div>
                          <Link
                            href={`/yonetim/musteriler/${payout.affiliateId}`}
                            className="text-sm font-medium text-zinc-900 dark:text-white hover:text-primary"
                          >
                            {payout.affiliateName}
                          </Link>
                          <p className="text-xs text-zinc-500">{payout.affiliateEmail}</p>
                          {payout.companyName && (
                            <p className="text-xs text-zinc-500 flex items-center gap-1 mt-0.5">
                              <Building2 className="h-3 w-3" />
                              {payout.companyName}
                            </p>
                          )}
                        </div>
                      </td>
                      <td className="p-4">
                        <span className="text-sm font-medium text-zinc-900 dark:text-white">
                          {formatPrice(payout.amount)}
                        </span>
                      </td>
                      <td className="p-4">
                        <span className="text-sm font-mono text-zinc-600 dark:text-zinc-400">
                          {payout.payoutIban || "—"}
                        </span>
                      </td>
                      <td className="p-4">
                        <span className="text-sm text-zinc-600 dark:text-zinc-400 flex items-center gap-1">
                          <Users className="h-3.5 w-3.5" />
                          {payout.referralCount} kayıt
                        </span>
                      </td>
                      <td className="p-4">
                        <span className="text-sm text-zinc-600 dark:text-zinc-400">
                          {new Date(payout.createdAt).toLocaleDateString("tr-TR")}
                        </span>
                        {payout.paidAt && (
                          <p className="text-xs text-zinc-500">
                            Ödeme: {new Date(payout.paidAt).toLocaleDateString("tr-TR")}
                          </p>
                        )}
                      </td>
                      <td className="p-4">
                        <div className="space-y-1">
                          {payout.processedBy && statusFilter === "PENDING" && (
                            <Badge
                              variant="outline"
                              className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20"
                            >
                              Onaylandı
                            </Badge>
                          )}
                          <p className="text-sm text-zinc-600 dark:text-zinc-400">
                            {payout.notes || "-"}
                          </p>
                        </div>
                      </td>
                      {statusFilter === "PENDING" && (
                        <td className="p-4">
                          <div className="flex items-center justify-end gap-2">
                            {!payout.processedBy && (
                              <Button
                                size="sm"
                                variant="outline"
                                disabled={processingId === payout.id}
                                onClick={() => handleApprove(payout.id)}
                              >
                                <CheckCircle className="h-4 w-4 mr-1" />
                                Onayla
                              </Button>
                            )}
                            <Button
                              size="sm"
                              disabled={processingId === payout.id || !payout.processedBy}
                              onClick={() => openDialog("complete", payout.id)}
                            >
                              <Wallet className="h-4 w-4 mr-1" />
                              Tamamla
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              disabled={processingId === payout.id}
                              onClick={() => openDialog("reject", payout.id)}
                            >
                              <XCircle className="h-4 w-4 mr-1" />
                              Reddet
                            </Button>
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {payouts.length === 0 && (
              <div className="p-8 text-center text-zinc-500">
                {statusFilter === "PENDING"
                  ? "Bekleyen affiliate ödeme talebi bulunmuyor."
                  : statusFilter === "PAID"
                    ? "Ödenmiş affiliate kaydı bulunmuyor."
                    : "Reddedilmiş affiliate kaydı bulunmuyor."}
              </div>
            )}
          </CardContent>
        </Card>
      </BlurFade>

      <Dialog open={dialogType !== null} onOpenChange={(open) => !open && closeDialog()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {dialogType === "reject" ? "Ödeme Talebini Reddet" : "Ödemeyi Tamamla"}
            </DialogTitle>
            <DialogDescription>
              {dialogType === "reject"
                ? "Red nedeni opsiyoneldir. Reddedilen talepte komisyonlar tekrar kullanılabilir hale gelir."
                : "Ödeme notu opsiyoneldir. Tamamlanan ödemede ortağa e-posta ve SMS bildirimi gönderilir."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="payout-notes">
              {dialogType === "reject" ? "Red nedeni" : "Ödeme notu"}
            </Label>
            <Textarea
              id="payout-notes"
              value={dialogNotes}
              onChange={(e) => setDialogNotes(e.target.value)}
              placeholder={dialogType === "reject" ? "Opsiyonel açıklama" : "Havale referansı vb."}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeDialog}>
              İptal
            </Button>
            <Button
              variant={dialogType === "reject" ? "destructive" : "default"}
              disabled={processingId === activePayoutId}
              onClick={handleDialogConfirm}
              className={cn(dialogType === "complete" && "")}
            >
              {dialogType === "reject" ? "Reddet" : "Tamamla"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}