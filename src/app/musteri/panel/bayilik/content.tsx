"use client";

import Link from "next/link";
import { BlurFade } from "@/components/magicui/blur-fade";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Users,
  Package,
  TrendingUp,
  Percent,
  ChevronRight,
  Store,
  Globe,
  FileText,
  Headphones,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface ResellerCustomer {
  id: string;
  name: string;
  email: string;
  status: string;
  registeredAt: string;
  activeServices: number;
  orderCount: number;
}

interface ResellerStats {
  customerCount: number;
  activeServices: number;
  monthlyRevenue: number;
}

interface BayilikContentProps {
  discountPercent: number;
  customers: ResellerCustomer[];
  stats: ResellerStats;
}

const statusConfig: Record<string, { label: string; color: string; bgColor: string }> = {
  ACTIVE: {
    label: "Aktif",
    color: "text-green-500",
    bgColor: "bg-green-500/10",
  },
  SUSPENDED: {
    label: "Askıda",
    color: "text-orange-500",
    bgColor: "bg-orange-500/10",
  },
  CLOSED: {
    label: "Kapalı",
    color: "text-red-500",
    bgColor: "bg-red-500/10",
  },
};

const quickLinks = [
  {
    title: "Hizmetlerim",
    description: "Bayi hesabınızdaki aktif hizmetleri görüntüleyin",
    href: "/musteri/panel/hizmetlerim",
    icon: Package,
  },
  {
    title: "Faturalarım",
    description: "Ödeme ve fatura geçmişinizi takip edin",
    href: "/musteri/panel/faturalar",
    icon: FileText,
  },
  {
    title: "Alan Adlarım",
    description: "Domain portföyünüzü yönetin",
    href: "/musteri/panel/domainler",
    icon: Globe,
  },
  {
    title: "Destek Talepleri",
    description: "Bayi destek ekibiyle iletişime geçin",
    href: "/musteri/panel/destek",
    icon: Headphones,
  },
];

export function BayilikContent({
  discountPercent,
  customers,
  stats,
}: BayilikContentProps) {
  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY" }).format(amount);

  return (
    <div className="space-y-6">
      <BlurFade delay={0.1} inView>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Bayilik Paneli</h1>
            <p className="text-muted-foreground">
              Alt müşterilerinizi ve bayi performansınızı takip edin.
            </p>
          </div>
          <div className="flex items-center gap-2 rounded-lg border bg-primary/5 px-4 py-2">
            <Percent className="h-4 w-4 text-primary" />
            <span className="text-sm text-muted-foreground">Toptan indirim oranınız</span>
            <span className="text-lg font-bold text-primary">%{discountPercent}</span>
          </div>
        </div>
      </BlurFade>

      <BlurFade delay={0.15} inView>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-blue-500/10">
                  <Users className="h-5 w-5 text-blue-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Alt Müşteri Sayısı</p>
                  <p className="text-2xl font-bold">{stats.customerCount}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-green-500/10">
                  <Package className="h-5 w-5 text-green-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Aktif Hizmetler</p>
                  <p className="text-2xl font-bold">{stats.activeServices}</p>
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
                  <p className="text-sm text-muted-foreground">Aylık Ciro</p>
                  <p className="text-2xl font-bold">{formatCurrency(stats.monthlyRevenue)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </BlurFade>

      <BlurFade delay={0.2} inView>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Store className="h-5 w-5 text-primary" />
              Hızlı Bağlantılar
            </CardTitle>
            <CardDescription>
              Bayi hesabınız için sık kullanılan sayfalara hızlı erişim.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-2">
              {quickLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="flex items-center gap-4 rounded-lg border p-4 transition-shadow hover:shadow-sm"
                >
                  <div className="rounded-lg bg-muted p-2">
                    <link.icon className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium">{link.title}</p>
                    <p className="text-sm text-muted-foreground">{link.description}</p>
                  </div>
                  <ChevronRight className="h-5 w-5 text-muted-foreground" />
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      </BlurFade>

      <BlurFade delay={0.25} inView>
        <Card>
          <CardHeader>
            <CardTitle>Alt Müşteriler</CardTitle>
            <CardDescription>
              Hesabınıza bağlı müşteriler ve hizmet özetleri.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {customers.map((customer) => {
                const status = statusConfig[customer.status] ?? statusConfig.ACTIVE;

                return (
                  <div
                    key={customer.id}
                    className="flex items-center gap-4 rounded-lg border p-4 hover:shadow-sm transition-shadow"
                  >
                    <div className="rounded-full bg-muted p-2">
                      <Users className="h-5 w-5 text-muted-foreground" />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-medium">{customer.name}</p>
                        <span
                          className={cn(
                            "px-2 py-0.5 rounded-full text-xs font-medium",
                            status.bgColor,
                            status.color
                          )}
                        >
                          {status.label}
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground mt-0.5">{customer.email}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Kayıt: {new Date(customer.registeredAt).toLocaleDateString("tr-TR")}
                      </p>
                    </div>

                    <div className="text-right text-sm">
                      <p>
                        <span className="text-muted-foreground">Aktif hizmet: </span>
                        <span className="font-medium">{customer.activeServices}</span>
                      </p>
                      <p>
                        <span className="text-muted-foreground">Sipariş: </span>
                        <span className="font-medium">{customer.orderCount}</span>
                      </p>
                    </div>
                  </div>
                );
              })}

              {customers.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  Henüz alt müşteri bulunmuyor. Yönetici tarafından müşteri ataması yapıldığında burada listelenecektir.
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </BlurFade>

      <BlurFade delay={0.3} inView>
        <Card className="border-dashed">
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">
              Alt müşterileriniz ödeme yaparken tanımlı bayi indirim oranınız (%{discountPercent}) otomatik olarak uygulanır.
              Yeni müşteri atamaları için destek ekibiyle iletişime geçebilirsiniz.
            </p>
            <Button asChild variant="outline" className="mt-4">
              <Link href="/musteri/panel/destek/yeni">Destek Talebi Oluştur</Link>
            </Button>
          </CardContent>
        </Card>
      </BlurFade>
    </div>
  );
}