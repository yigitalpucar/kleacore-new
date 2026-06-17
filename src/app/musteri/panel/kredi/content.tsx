"use client";

import { useState } from "react";
import { BlurFade } from "@/components/magicui/blur-fade";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Wallet,
  CreditCard,
  Plus,
  Check,
  ArrowUpRight,
  ArrowDownRight,
  Clock,
  Gift,
  Percent,
  Info,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { initiateBalanceTopUp } from "@/lib/actions/customer/balance";
import { redirectToCheckoutUrl } from "@/lib/utils/safe-redirect";
import { toast } from "sonner";

const creditPackages = [
  { id: 1, amount: 100, bonus: 0, popular: false },
  { id: 2, amount: 250, bonus: 10, popular: false },
  { id: 3, amount: 500, bonus: 30, popular: true },
  { id: 4, amount: 1000, bonus: 75, popular: false },
  { id: 5, amount: 2500, bonus: 250, popular: false },
  { id: 6, amount: 5000, bonus: 600, popular: false },
];

const paymentMethods = [
  {
    id: "credit-card",
    name: "Kredi Karti",
    description: "Visa, Mastercard, Troy ile güvenli ödeme",
    icon: CreditCard,
  },
];

const currencyFormatter = new Intl.NumberFormat("tr-TR", {
  style: "currency",
  currency: "TRY",
});

const transactionTypeConfig = {
  DEPOSIT: {
    label: "Kredi Yukleme",
    color: "text-green-500",
    bgColor: "bg-green-500/10",
    icon: ArrowDownRight,
  },
  PAYMENT: {
    label: "Fatura Odemesi",
    color: "text-red-500",
    bgColor: "bg-red-500/10",
    icon: ArrowUpRight,
  },
  REFUND: {
    label: "Iade",
    color: "text-blue-500",
    bgColor: "bg-blue-500/10",
    icon: ArrowDownRight,
  },
  ADJUSTMENT: {
    label: "Duzeltme",
    color: "text-purple-500",
    bgColor: "bg-purple-500/10",
    icon: Gift,
  },
};

interface SerializedTransaction {
  id: string;
  type: string;
  amount: number;
  balanceBefore: number;
  balanceAfter: number;
  description: string;
  referenceId: string | null;
  createdAt: string;
}

interface KrediContentProps {
  transactions: SerializedTransaction[];
  balance: number;
}

export function KrediContent({ transactions, balance }: KrediContentProps) {
  const [selectedPackage, setSelectedPackage] = useState<number | null>(null);
  const [customAmount, setCustomAmount] = useState("");
  const [selectedPayment, setSelectedPayment] = useState("credit-card");
  const [loading, setLoading] = useState(false);

  const selectedPkg = creditPackages.find((p) => p.id === selectedPackage);
  const finalAmount = selectedPkg
    ? selectedPkg.amount
    : customAmount
    ? parseFloat(customAmount)
    : 0;
  const bonusAmount = selectedPkg ? selectedPkg.bonus : 0;

  const handlePackageSelect = (id: number) => {
    setSelectedPackage(id);
    setCustomAmount("");
  };

  const handleCustomAmountChange = (value: string) => {
    setCustomAmount(value);
    setSelectedPackage(null);
  };

  const handleLoadBalance = async () => {
    if (finalAmount < 50) return;
    setLoading(true);

    const result = await initiateBalanceTopUp(finalAmount);
    if (!result.success) {
      toast.error(result.error ?? "Ödeme başlatılamadı");
      setLoading(false);
      return;
    }

    if (result.data?.checkoutUrl && redirectToCheckoutUrl(result.data.checkoutUrl)) {
      return;
    }

    toast.error("Ödeme sayfası oluşturulamadı");
    setLoading(false);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <BlurFade delay={0.1} inView>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Kredi Ekle</h1>
            <p className="text-muted-foreground">
              Hesabiniza bakiye yukleyerek hizmetlerinizi kolayca odeyin.
            </p>
          </div>
        </div>
      </BlurFade>

      {/* Current Balance */}
      <BlurFade delay={0.15} inView>
        <Card className="bg-gradient-to-br from-primary to-primary/80 text-primary-foreground border-0">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-primary-foreground/80">Mevcut Bakiye</p>
                <p className="text-4xl font-bold mt-1">{currencyFormatter.format(balance)}</p>
                <p className="text-sm text-primary-foreground/70 mt-2">
                  Bakiyenizi kullanarak faturalarinizi otomatik odeyebilirsiniz.
                </p>
              </div>
              <div className="p-4 rounded-full bg-white/10">
                <Wallet className="h-8 w-8" />
              </div>
            </div>
          </CardContent>
        </Card>
      </BlurFade>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Credit Packages */}
        <div className="lg:col-span-2 space-y-6">
          <BlurFade delay={0.2} inView>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Gift className="h-5 w-5 text-primary" />
                  Kredi Paketleri
                </CardTitle>
                <CardDescription>
                  Paket secerek bonus kredi kazanin
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {creditPackages.map((pkg) => (
                    <div
                      key={pkg.id}
                      onClick={() => handlePackageSelect(pkg.id)}
                      className={cn(
                        "relative p-4 rounded-lg border-2 cursor-pointer transition-all",
                        selectedPackage === pkg.id
                          ? "border-primary bg-primary/5"
                          : "border-border hover:border-primary/50"
                      )}
                    >
                      {pkg.popular && (
                        <span className="absolute -top-2 left-1/2 -translate-x-1/2 px-2 py-0.5 text-xs font-medium bg-primary text-primary-foreground rounded-full">
                          Populer
                        </span>
                      )}
                      <div className="text-center">
                        <p className="text-2xl font-bold">{currencyFormatter.format(pkg.amount)}</p>
                        {pkg.bonus > 0 && (
                          <p className="text-sm text-green-500 font-medium mt-1">
                            +{currencyFormatter.format(pkg.bonus)} Bonus
                          </p>
                        )}
                        {pkg.bonus > 0 && (
                          <p className="text-xs text-muted-foreground mt-1">
                            Toplam: {currencyFormatter.format(pkg.amount + pkg.bonus)}
                          </p>
                        )}
                      </div>
                      {selectedPackage === pkg.id && (
                        <div className="absolute top-2 right-2">
                          <Check className="h-5 w-5 text-primary" />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </BlurFade>

          {/* Custom Amount */}
          <BlurFade delay={0.25} inView>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Plus className="h-5 w-5 text-primary" />
                  Ozel Tutar
                </CardTitle>
                <CardDescription>
                  Istediginiz tutari manuel olarak girin (minimum 50 TL)
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex gap-4">
                  <div className="flex-1">
                    <Label htmlFor="custom-amount" className="sr-only">
                      Tutar
                    </Label>
                    <div className="relative">
                      <Input
                        id="custom-amount"
                        type="number"
                        placeholder="Tutar girin..."
                        value={customAmount}
                        onChange={(e) => handleCustomAmountChange(e.target.value)}
                        min={50}
                        className="pr-12"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                        TL
                      </span>
                    </div>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
                  <Info className="h-3 w-3" />
                  Ozel tutarlarda bonus uygulanmaz.
                </p>
              </CardContent>
            </Card>
          </BlurFade>

          {/* Payment Methods */}
          <BlurFade delay={0.3} inView>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CreditCard className="h-5 w-5 text-primary" />
                  Ödeme Yöntemi
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-3 sm:grid-cols-2">
                  {paymentMethods.map((method) => (
                    <div
                      key={method.id}
                      onClick={() => setSelectedPayment(method.id)}
                      className={cn(
                        "flex items-center gap-4 p-4 rounded-lg border-2 cursor-pointer transition-all",
                        selectedPayment === method.id
                          ? "border-primary bg-primary/5"
                          : "border-border hover:border-primary/50"
                      )}
                    >
                      <div className={cn(
                        "p-3 rounded-lg",
                        selectedPayment === method.id ? "bg-primary/10" : "bg-muted"
                      )}>
                        <method.icon className={cn(
                          "h-6 w-6",
                          selectedPayment === method.id ? "text-primary" : "text-muted-foreground"
                        )} />
                      </div>
                      <div className="flex-1">
                        <p className="font-medium">{method.name}</p>
                        <p className="text-sm text-muted-foreground">{method.description}</p>
                      </div>
                      {selectedPayment === method.id && (
                        <Check className="h-5 w-5 text-primary" />
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </BlurFade>
        </div>

        {/* Summary & Actions */}
        <div className="space-y-6">
          <BlurFade delay={0.35} inView>
            <Card className="sticky top-4">
              <CardHeader>
                <CardTitle>Ozet</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Yuklenecek Tutar</span>
                    <span className="font-medium">{currencyFormatter.format(finalAmount)}</span>
                  </div>
                  {bonusAmount > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground flex items-center gap-1">
                        <Gift className="h-3 w-3 text-green-500" />
                        Bonus
                      </span>
                      <span className="font-medium text-green-500">+{currencyFormatter.format(bonusAmount)}</span>
                    </div>
                  )}
                  <div className="border-t pt-3">
                    <div className="flex justify-between">
                      <span className="font-medium">Toplam Bakiye</span>
                      <span className="font-bold text-lg">
                        {currencyFormatter.format(finalAmount + bonusAmount)}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="space-y-3 pt-2">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <CreditCard className="h-4 w-4" />
                    <span>
                      {paymentMethods.find((m) => m.id === selectedPayment)?.name}
                    </span>
                  </div>
                </div>

                <Button
                  className="w-full"
                  size="lg"
                  disabled={finalAmount < 50 || loading}
                  onClick={handleLoadBalance}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  {loading
                    ? "Yukleniyor..."
                    : finalAmount >= 50
                    ? `${currencyFormatter.format(finalAmount)} Yukle`
                    : "Tutar Secin"}
                </Button>

                {finalAmount > 0 && finalAmount < 50 && (
                  <p className="text-xs text-red-500 text-center">
                    Minimum yukleme tutari 50 TL&apos;dir.
                  </p>
                )}
              </CardContent>
            </Card>
          </BlurFade>

          {/* Bonus Info */}
          <BlurFade delay={0.4} inView>
            <Card className="border-dashed">
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-lg bg-green-500/10">
                    <Percent className="h-4 w-4 text-green-500" />
                  </div>
                  <div className="text-sm">
                    <p className="font-medium text-foreground mb-1">Bonus Kazanin!</p>
                    <p className="text-muted-foreground">
                      Paket secerek %10&apos;a varan bonus kredi kazanabilirsiniz.
                      Ne kadar yuklerseniz o kadar bonus!
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </BlurFade>
        </div>
      </div>

      {/* Recent Transactions */}
      <BlurFade delay={0.45} inView>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-primary" />
              Son İşlemler
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {transactions.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  Henüz işlem bulunmuyor.
                </div>
              )}
              {transactions.map((transaction) => {
                const config = transactionTypeConfig[transaction.type as keyof typeof transactionTypeConfig] ?? transactionTypeConfig.ADJUSTMENT;
                const TransactionIcon = config.icon;
                const isPositive = transaction.type === "DEPOSIT" || transaction.type === "REFUND";

                return (
                  <div
                    key={transaction.id}
                    className="flex items-center gap-4 p-3 rounded-lg border hover:shadow-sm transition-shadow"
                  >
                    <div className={cn("p-2 rounded-lg", config.bgColor)}>
                      <TransactionIcon className={cn("h-5 w-5", config.color)} />
                    </div>

                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{transaction.description}</p>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                        <span>{new Date(transaction.createdAt).toLocaleDateString("tr-TR")}</span>
                        <span>-</span>
                        <span>{new Date(transaction.createdAt).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })}</span>
                      </div>
                    </div>

                    <div className="text-right">
                      <p className={cn(
                        "font-bold",
                        isPositive ? "text-green-500" : "text-red-500"
                      )}>
                        {isPositive ? "+" : "-"}{currencyFormatter.format(Math.abs(transaction.amount))}
                      </p>
                    </div>

                    <ChevronRight className="h-5 w-5 text-muted-foreground" />
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </BlurFade>
    </div>
  );
}
