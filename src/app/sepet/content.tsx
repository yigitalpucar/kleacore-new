"use client";

import Link from "next/link";
import { BlurFade } from "@/components/magicui/blur-fade";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useCartStore } from "@/store/cart-store";
import { ShoppingCart, Trash2, ArrowRight } from "lucide-react";
import { toast } from "@/lib/toast";

function formatPrice(value: number) {
  return new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency: "TRY",
    maximumFractionDigits: 2,
  }).format(value);
}

export function SepetContent() {
  const items = useCartStore((state) => state.items);
  const hasHydrated = useCartStore((state) => state.hasHydrated);
  const removeItem = useCartStore((state) => state.removeItem);
  const clearCart = useCartStore((state) => state.clearCart);
  const subtotal = useCartStore((state) => state.getSubtotal());
  const totalItems = useCartStore((state) => state.getTotalItems());

  const handleRemove = (id: string, title: string) => {
    removeItem(id);
    toast.info(`${title} sepetten kaldırıldı.`);
  };

  const handleClear = () => {
    clearCart();
    toast.info("Sepet temizlendi.");
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
                      <div>
                        <p className="font-semibold">{item.title}</p>
                        {item.type === "domain" && item.metadata?.renewPrice ? (
                          <p className="text-sm text-muted-foreground mt-1">
                            Yenileme: {formatPrice(item.metadata.renewPrice)}/yıl
                          </p>
                        ) : null}
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
                  <Button className="w-full" asChild>
                    <Link href="/musteri/giris">
                      Ödemeye Geç
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Link>
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
