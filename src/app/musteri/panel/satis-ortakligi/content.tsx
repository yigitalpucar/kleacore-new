"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { BlurFade } from "@/components/magicui/blur-fade";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { requestPayout } from "@/lib/actions/customer/affiliate";
import { MIN_PAYOUT_AMOUNT } from "@/lib/affiliate/constants";
import { toast } from "@/lib/toast";
import {
  Users,
  Link2,
  Copy,
  Check,
  Wallet,
  TrendingUp,
  Clock,
  Gift,
  UserPlus,
  CreditCard,
  Share2,
  Globe,
  Server,
  Shield,
  ChevronRight,
  CheckCircle2,
  XCircle,
  Hourglass,
  Info,
} from "lucide-react";
import { cn } from "@/lib/utils";

const commissionRates = [
  {
    category: "Web Hosting",
    icon: Globe,
    rate: 20,
    description: "Tüm hosting paketleri",
  },
  {
    category: "VPS Sunucu",
    icon: Server,
    rate: 15,
    description: "VPS ve VDS paketleri",
  },
  {
    category: "Bulut Sunucu",
    icon: Server,
    rate: 15,
    description: "Cloud sunucu paketleri",
  },
  {
    category: "SSL Sertifikası",
    icon: Shield,
    rate: 10,
    description: "Tüm SSL sertifikaları",
  },
];

const statusConfig = {
  active: {
    label: "Aktif",
    color: "text-green-500",
    bgColor: "bg-green-500/10",
    icon: CheckCircle2,
  },
  pending: {
    label: "Bekliyor",
    color: "text-orange-500",
    bgColor: "bg-orange-500/10",
    icon: Hourglass,
  },
  inactive: {
    label: "Pasif",
    color: "text-gray-500",
    bgColor: "bg-gray-500/10",
    icon: XCircle,
  },
  PENDING: {
    label: "Bekliyor",
    color: "text-orange-500",
    bgColor: "bg-orange-500/10",
    icon: Hourglass,
  },
  PAID: {
    label: "Tamamlandı",
    color: "text-green-500",
    bgColor: "bg-green-500/10",
    icon: CheckCircle2,
  },
  CANCELLED: {
    label: "İptal",
    color: "text-red-500",
    bgColor: "bg-red-500/10",
    icon: XCircle,
  },
};

const steps = [
  {
    step: 1,
    title: "Linkinizi Paylaşın",
    description: "Referans linkinizi sosyal medya, blog veya arkadaşlarınızla paylaşın.",
    icon: Share2,
  },
  {
    step: 2,
    title: "Müşteri Kaydolsun",
    description: "Linkiniz üzerinden gelen ziyaretçiler hesap oluştursun.",
    icon: UserPlus,
  },
  {
    step: 3,
    title: "Alışveriş Yapsın",
    description: "Referansınız herhangi bir hizmet satın alsın.",
    icon: CreditCard,
  },
  {
    step: 4,
    title: "Komisyon Kazanın",
    description: "Her satıştan %10-20 arası komisyon kazanın.",
    icon: Gift,
  },
];

interface Referral {
  id: string;
  referredEmail: string;
  registeredAt: string;
  commission: number;
  isPaid: boolean;
}

interface Payment {
  id: string;
  amount: number;
  status: string;
  createdAt: string;
  paidAt: string | null;
}

interface AffiliateStats {
  totalReferrals: number;
  totalEarnings: number;
  pendingPayments: number;
  paidPayments: number;
  availableBalance: number;
}

interface SatisOrtakligiContentProps {
  referralCode: string;
  referralLink: string;
  referrals: Referral[];
  payments: Payment[];
  stats: AffiliateStats;
}

export function SatisOrtakligiContent({
  referralCode,
  referralLink,
  referrals,
  payments,
  stats,
}: SatisOrtakligiContentProps) {
  const router = useRouter();
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<"referrals" | "payments">("referrals");
  const [payoutDialogOpen, setPayoutDialogOpen] = useState(false);
  const [payoutAmount, setPayoutAmount] = useState("");
  const [isSubmittingPayout, setIsSubmittingPayout] = useState(false);

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY" }).format(amount);

  const handleRequestPayout = async () => {
    const amount = Number(payoutAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      toast.error("Geçerli bir tutar girin");
      return;
    }

    setIsSubmittingPayout(true);
    const result = await requestPayout(amount);
    setIsSubmittingPayout(false);

    if (!result.success) {
      toast.error(result.error || "Ödeme talebi oluşturulamadı");
      return;
    }

    toast.success("Ödeme talebiniz alındı");
    setPayoutDialogOpen(false);
    setPayoutAmount("");
    setActiveTab("payments");
    router.refresh();
  };

  const availableBalance = stats.availableBalance;
  const canRequestPayout = availableBalance >= MIN_PAYOUT_AMOUNT;
  const conversionRate = stats.totalReferrals > 0
    ? Math.round((referrals.filter((r) => r.commission > 0).length / stats.totalReferrals) * 100)
    : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <BlurFade delay={0.1} inView>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Satış Ortaklığı</h1>
            <p className="text-muted-foreground">
              Referans linkinizi paylaşarak komisyon kazanın.
            </p>
          </div>
          <Button
            onClick={() => {
              setPayoutAmount(canRequestPayout ? String(availableBalance) : "");
              setPayoutDialogOpen(true);
            }}
            disabled={!canRequestPayout}
          >
            <Wallet className="mr-2 h-4 w-4" />
            Ödeme Talep Et
          </Button>
        </div>
      </BlurFade>

      {/* Stats */}
      <BlurFade delay={0.15} inView>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-green-500/10">
                  <Wallet className="h-5 w-5 text-green-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Toplam Kazanç</p>
                  <p className="text-2xl font-bold">{formatCurrency(stats.totalEarnings)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-emerald-500/10">
                  <Wallet className="h-5 w-5 text-emerald-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Kullanılabilir Bakiye</p>
                  <p className="text-2xl font-bold">{formatCurrency(availableBalance)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-orange-500/10">
                  <Clock className="h-5 w-5 text-orange-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Bekleyen Ödemeler</p>
                  <p className="text-2xl font-bold">{formatCurrency(stats.pendingPayments)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-blue-500/10">
                  <Users className="h-5 w-5 text-blue-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Toplam Referans</p>
                  <p className="text-2xl font-bold">{stats.totalReferrals}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-purple-500/10">
                  <TrendingUp className="h-5 w-5 text-purple-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Dönüşüm Oranı</p>
                  <p className="text-2xl font-bold">%{conversionRate}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </BlurFade>

      {/* Referral Link */}
      <BlurFade delay={0.2} inView>
        <Card className="border-primary/20 bg-primary/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Link2 className="h-5 w-5 text-primary" />
              Referans Linkiniz
            </CardTitle>
            <CardDescription>
              Bu linki paylaşarak yeni müşteriler kazandırın ve komisyon alın.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="flex-1">
                <Input
                  value={referralLink}
                  readOnly
                  className="bg-background"
                />
              </div>
              <Button onClick={() => handleCopy(referralLink)}>
                {copied ? (
                  <>
                    <Check className="mr-2 h-4 w-4" />
                    Kopyalandı
                  </>
                ) : (
                  <>
                    <Copy className="mr-2 h-4 w-4" />
                    Kopyala
                  </>
                )}
              </Button>
            </div>
            <div className="flex items-center gap-4 text-sm">
              <span className="text-muted-foreground">Referans Kodu:</span>
              <code className="px-2 py-1 rounded bg-muted font-mono">
                {referralCode}
              </code>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleCopy(referralCode)}
              >
                <Copy className="h-3 w-3" />
              </Button>
            </div>
          </CardContent>
        </Card>
      </BlurFade>

      {/* How it works */}
      <BlurFade delay={0.25} inView>
        <Card>
          <CardHeader>
            <CardTitle>Nasıl Çalışır?</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {steps.map((step, index) => (
                <div key={step.step} className="relative">
                  {index < steps.length - 1 && (
                    <div className="hidden lg:block absolute top-8 left-[60%] w-[80%] border-t-2 border-dashed border-muted-foreground/30" />
                  )}
                  <div className="flex flex-col items-center text-center">
                    <div className="flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mb-4">
                      <step.icon className="h-7 w-7 text-primary" />
                    </div>
                    <span className="text-xs font-medium text-primary mb-1">Adım {step.step}</span>
                    <h4 className="font-semibold mb-1">{step.title}</h4>
                    <p className="text-sm text-muted-foreground">{step.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </BlurFade>

      {/* Commission Rates */}
      <BlurFade delay={0.3} inView>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Gift className="h-5 w-5 text-primary" />
              Komisyon Oranları
            </CardTitle>
            <CardDescription>
              Her kategoride farklı komisyon oranları uygulanmaktadır.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {commissionRates.map((item) => (
                <div
                  key={item.category}
                  className="p-4 rounded-lg border bg-muted/30 text-center"
                >
                  <div className="flex items-center justify-center w-12 h-12 rounded-lg bg-primary/10 mx-auto mb-3">
                    <item.icon className="h-6 w-6 text-primary" />
                  </div>
                  <p className="font-medium">{item.category}</p>
                  <p className="text-3xl font-bold text-primary mt-1">%{item.rate}</p>
                  <p className="text-xs text-muted-foreground mt-1">{item.description}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </BlurFade>

      {/* Tabs for Referrals & Payments */}
      <BlurFade delay={0.35} inView>
        <Card>
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <CardTitle>Detaylar</CardTitle>
              <div className="flex gap-2">
                <Button
                  variant={activeTab === "referrals" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setActiveTab("referrals")}
                >
                  <Users className="mr-2 h-4 w-4" />
                  Referanslar
                </Button>
                <Button
                  variant={activeTab === "payments" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setActiveTab("payments")}
                >
                  <Wallet className="mr-2 h-4 w-4" />
                  Ödemeler
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {activeTab === "referrals" ? (
              <div className="space-y-3">
                {referrals.map((referral) => {
                  const statusKey = referral.isPaid ? "active" : referral.commission > 0 ? "pending" : "inactive";
                  const status = statusConfig[statusKey as keyof typeof statusConfig];
                  const StatusIcon = status.icon;

                  return (
                    <div
                      key={referral.id}
                      className="flex items-center gap-4 p-4 rounded-lg border hover:shadow-sm transition-shadow"
                    >
                      <div className="p-2 rounded-full bg-muted">
                        <Users className="h-5 w-5 text-muted-foreground" />
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-medium">{referral.referredEmail}</p>
                          <span className={cn(
                            "flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium",
                            status.bgColor,
                            status.color
                          )}>
                            <StatusIcon className="h-3 w-3" />
                            {status.label}
                          </span>
                        </div>
                        <p className="text-sm text-muted-foreground mt-0.5">
                          Kayıt: {new Date(referral.registeredAt).toLocaleDateString("tr-TR")}
                        </p>
                      </div>

                      <div className="text-right">
                        <p className="text-sm text-muted-foreground">Komisyon</p>
                        <p className="font-bold text-green-500">+{formatCurrency(Number(referral.commission))}</p>
                      </div>

                      <ChevronRight className="h-5 w-5 text-muted-foreground" />
                    </div>
                  );
                })}

                {referrals.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    Henüz referans bulunmuyor.
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                {payments.map((payment) => {
                  const status = statusConfig[payment.status as keyof typeof statusConfig] || statusConfig.PENDING;
                  const StatusIcon = status.icon;

                  return (
                    <div
                      key={payment.id}
                      className="flex items-center gap-4 p-4 rounded-lg border hover:shadow-sm transition-shadow"
                    >
                      <div className={cn("p-2 rounded-lg", status.bgColor)}>
                        <Wallet className={cn("h-5 w-5", status.color)} />
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-medium">{payment.id}</p>
                          <span className={cn(
                            "flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium",
                            status.bgColor,
                            status.color
                          )}>
                            <StatusIcon className="h-3 w-3" />
                            {status.label}
                          </span>
                        </div>
                        <p className="text-sm text-muted-foreground mt-0.5">
                          Talep: {new Date(payment.createdAt).toLocaleDateString("tr-TR")}
                        </p>
                      </div>

                      <div className="text-right">
                        <p className="text-lg font-bold">{formatCurrency(Number(payment.amount))}</p>
                        {payment.paidAt && (
                          <p className="text-xs text-muted-foreground">
                            Ödendi: {new Date(payment.paidAt).toLocaleDateString("tr-TR")}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}

                {payments.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    Henüz ödeme talebi bulunmuyor.
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </BlurFade>

      <Dialog open={payoutDialogOpen} onOpenChange={setPayoutDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ödeme Talep Et</DialogTitle>
            <DialogDescription>
              Kullanılabilir bakiyeniz: {formatCurrency(availableBalance)}. Minimum talep tutarı{" "}
              {formatCurrency(MIN_PAYOUT_AMOUNT)}&apos;dir.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="payout-amount">Talep Tutarı (TL)</Label>
            <Input
              id="payout-amount"
              type="number"
              min={MIN_PAYOUT_AMOUNT}
              max={availableBalance}
              step="0.01"
              value={payoutAmount}
              onChange={(event) => setPayoutAmount(event.target.value)}
              placeholder={String(MIN_PAYOUT_AMOUNT)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPayoutDialogOpen(false)}>
              İptal
            </Button>
            <Button onClick={handleRequestPayout} disabled={isSubmittingPayout}>
              {isSubmittingPayout ? "Gönderiliyor..." : "Talep Oluştur"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Info Note */}
      <BlurFade delay={0.4} inView>
        <Card className="border-dashed">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-lg bg-muted">
                <Info className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="text-sm text-muted-foreground">
                <p className="font-medium text-foreground mb-1">Ödeme Koşulları</p>
                <ul className="space-y-1">
                  <li>- Minimum ödeme talep tutarı 100 TL&apos;dir.</li>
                  <li>- Komisyonlar, referansın ödemesi onaylandıktan 30 gün sonra kullanılabilir hale gelir.</li>
                  <li>- Ödemeler havale/EFT veya bakiye transferi olarak yapılabilir.</li>
                  <li>- Ödeme talepleri 3-5 iş günü içinde işleme alınır.</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      </BlurFade>
    </div>
  );
}
