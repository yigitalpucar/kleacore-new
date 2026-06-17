"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { BlurFade } from "@/components/magicui/blur-fade";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useCartStore } from "@/store/cart-store";
import { checkoutCart } from "@/lib/actions/customer/checkout";
import { ShoppingCart, Trash2, ArrowRight, Globe, Package, WalletCards } from "lucide-react";
import { toast } from "@/lib/toast";
import { redirectToCheckoutUrl } from "@/lib/utils/safe-redirect";

function formatPrice(value: number) {
  return new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency: "TRY",
    maximumFractionDigits: 2,
  }).format(value);
}

export function SepetContent() {
  const router = useRouter();
  const items = useCartStore((state) => state.items);
  const hasHydrated = useCartStore((state) => state.hasHydrated);
  const removeItem = useCartStore((state) => state.removeItem);
  const clearCart = useCartStore((state) => state.clearCart);
  const subtotal = useCartStore((state) => state.getSubtotal());
  const totalItems = useCartStore((state) => state.getTotalItems());
  const [paymentMethod, setPaymentMethod] = useState<"BANK_TRANSFER" | "CREDIT_CARD">("CREDIT_CARD");
  const [promoCode, setPromoCode] = useState("");
  const [isPending, startTransition] = useTransition();

  const handleRemove = (id: string, title: string) => {
    removeItem(id);
    toast.info(`${title} sepetten kaldırıldı.`);
  };

  const handleClear = () => {
    clearCart();
    toast.info("Sepet temizlendi.");
  };

  const handleCheckout = () => {
    startTransition(async () => {
      const result = await checkoutCart({
        paymentMethod,
        promoCode,
        items: items.map((item) => ({
          id: item.id,
          type: item.type,
          quantity: item.quantity,
          metadata: item.metadata,
        })),
      });

      if (!result.success) {
        if (result.code === "LOGIN_REQUIRED") {
          toast.info("Ödeme için giriş yapmalısınız.");
          router.push("/musteri/giris");
          return;
        }

        toast.error(result.error ?? "Sipariş oluşturulurken bir hata oluştu.");
        return;
      }

      clearCart();
      const checkoutUrl =
        result.data && "checkoutUrl" in result.data ? result.data.checkoutUrl : null;
      if (checkoutUrl && redirectToCheckoutUrl(checkoutUrl)) {
        return;
      }

      toast.success(
        paymentMethod === "CREDIT_CARD"
          ? "Ödeme sayfasına yönlendiriliyorsunuz."
          : "Siparişiniz oluşturuldu. Banka havalesi onayı bekleniyor."
      );
      router.push("/musteri/panel/faturalar");
    });
  };

  return (
    <section className="py-16 md:py-24 bg-gradient-to-b from-primary/5 to-background">
      <div className="container">
        <BlurFade delay={0.1} inView>
          <div className="text-center mb-10">
            <div className="inline-flex items-center gap-2 rounded-full border bg-background px-4 py-1.5 text-sm font-medium mb-4">
              <ShoppingCart className="h-4 w-4 text-primary" />
              Sepet
            </div>
            <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
              Alışveriş Sepeti
            </h1>
            <p className="mt-4 text-muted-foreground">
              {hasHydrated
                ? `${totalItems} ürün sepetinizde`
                : "Sepet yükleniyor..."}
            </p>
          </div>
        </BlurFade>

        {!hasHydrated ? null : items.length === 0 ? (
          <BlurFade delay={0.2} inView>
            <Card className="max-w-2xl mx-auto">
              <CardContent className="p-8 text-center">
                <ShoppingCart className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h2 className="text-xl font-semibold mb-2">Sepetiniz boş</h2>
                <p className="text-muted-foreground mb-6">
                  Domain araması yaparak ürün ekleyebilirsiniz.
                </p>
                <Button asChild>
                  <Link href="/domain/kayit">
                    Domain Ara
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              </CardContent>
            </Card>
          </BlurFade>
        ) : (
          <div className="grid gap-6 lg:grid-cols-3">
            <BlurFade delay={0.2} inView className="lg:col-span-2">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle>Sepet Ürünleri</CardTitle>
                  <Button variant="outline" size="sm" onClick={handleClear}>
                    Sepeti Temizle
                  </Button>
                </CardHeader>
                <CardContent className="space-y-3">
                  {items.map((item) => (
                    <div
                      key={item.id}
                      className="rounded-lg border p-4 flex items-start justify-between gap-4"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold">{item.title}</p>
                        {item.metadata?.billingPeriod && (
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {item.metadata.billingPeriod === "yearly" ? "Yıllık" : "Aylık"} faturalandırma
                          </p>
                        )}
                        {item.type === "domain" && item.metadata?.renewPrice ? (
                          <p className="text-sm text-muted-foreground mt-1">
                            Yenileme: {formatPrice(item.metadata.renewPrice)}/yıl
                          </p>
                        ) : null}
                        {item.type === "hosting" && item.metadata?.domainChoice && (
                          <div className="mt-2 space-y-1">
                            {item.metadata.domainChoice.type === "new" && item.metadata.domainChoice.domain && (
                              <p className="text-sm text-muted-foreground flex items-center gap-1.5">
                                <Globe className="h-3.5 w-3.5" />
                                Yeni domain: {item.metadata.domainChoice.domain}
                              </p>
                            )}
                            {item.metadata.domainChoice.type === "existing" && item.metadata.domainChoice.domain && (
                              <p className="text-sm text-muted-foreground flex items-center gap-1.5">
                                <Globe className="h-3.5 w-3.5" />
                                Mevcut domain: {item.metadata.domainChoice.domain}
                              </p>
                            )}
                          </div>
                        )}
                        {item.type === "hosting" && item.metadata?.addons && item.metadata.addons.length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-1.5">
                            {item.metadata.addons.map((addon) => (
                              <span
                                key={addon.sku}
                                className="inline-flex items-center gap-1 text-xs bg-muted px-2 py-0.5 rounded-full"
                              >
                                <Package className="h-3 w-3" />
                                {addon.name}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                      <div className="text-right">
                        <p className="font-semibold">
                          {formatPrice(item.unitPrice * item.quantity)}
                        </p>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="mt-2 text-red-500 hover:text-red-500"
                          onClick={() => handleRemove(item.id, item.title)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </BlurFade>

            <BlurFade delay={0.25} inView>
              <Card>
                <CardHeader>
                  <CardTitle>Özet</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Ürün Sayısı</span>
                    <span>{totalItems}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Ara Toplam</span>
                    <span>{formatPrice(subtotal)}</span>
                  </div>
                  <div className="border-t pt-4 flex items-center justify-between font-semibold">
                    <span>Toplam</span>
                    <span>{formatPrice(subtotal)}</span>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium" htmlFor="promo-code">
                      Promosyon Kodu
                    </label>
                    <Input
                      id="promo-code"
                      value={promoCode}
                      onChange={(event) => setPromoCode(event.target.value.toUpperCase())}
                      placeholder="Kupon kodu"
                    />
                    <p className="text-xs text-muted-foreground">
                      Kupon ödeme sırasında doğrulanır.
                    </p>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Ödeme Yöntemi</label>
                    <Select
                      value={paymentMethod}
                      onValueChange={(value) =>
                        setPaymentMethod(value as "BANK_TRANSFER" | "CREDIT_CARD")
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="CREDIT_CARD">Kredi Kartı</SelectItem>
                        <SelectItem value="BANK_TRANSFER">Banka Havalesi</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <Button className="w-full" onClick={handleCheckout} disabled={isPending}>
                    {isPending ? (
                      "Sipariş oluşturuluyor..."
                    ) : (
                      <>
                        <WalletCards className="mr-2 h-4 w-4" />
                        Ödemeye Geç
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </>
                    )}
                  </Button>
                </CardContent>
              </Card>
            </BlurFade>
          </div>
        )}
      </div>
    </section>
  );
}
