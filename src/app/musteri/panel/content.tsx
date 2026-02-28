"use client";

import Link from "next/link";
import { BlurFade } from "@/components/magicui/blur-fade";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Package,
  Headphones,
  ArrowRight,
  ChevronRight,
  CheckCircle2,
  AlertCircle,
  Clock,
  XCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";

// Status map for service badges
const statusMap: Record<string, { label: string; className: string; icon: typeof CheckCircle2 }> = {
  ACTIVE: {
    label: "Aktif",
    className: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
    icon: CheckCircle2,
  },
  SUSPENDED: {
    label: "Askıda",
    className: "bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400",
    icon: Clock,
  },
  EXPIRED: {
    label: "Süresi Doldu",
    className: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
    icon: XCircle,
  },
  CANCELLED: {
    label: "İptal",
    className: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
    icon: AlertCircle,
  },
};

interface DashboardService {
  id: string;
  label: string;
  domain: string | null;
  status: string;
  nextDueDate: string | null;
  product: {
    id: string;
    name: string;
  };
}

interface DashboardContentProps {
  stats: {
    activeServices: number;
    totalInvoices: number;
    unpaidInvoices: number;
    openTickets: number;
  };
  services: DashboardService[];
}

export function DashboardContent({ stats, services }: DashboardContentProps) {
  const statCards = [
    {
      title: "Aktif Hizmetler",
      value: String(stats.activeServices),
      description: "Toplam aktif hizmet sayınız",
      href: "/musteri/panel/hizmetlerim",
      bgColor: "bg-blue-600",
    },
    {
      title: "Aktif Domainler",
      value: "0",
      description: "Toplam aktif domain sayınız",
      href: "/musteri/panel/domainler",
      bgColor: "bg-green-600",
    },
    {
      title: "Destek Talepleri",
      value: String(stats.openTickets),
      description: "Aktif destek talebi sayınız",
      href: "/musteri/panel/destek",
      bgColor: "bg-orange-500",
    },
    {
      title: "Faturalar",
      value: String(stats.unpaidInvoices),
      description: "Ödenmemiş fatura sayınız",
      href: "/musteri/panel/faturalar",
      bgColor: "bg-red-500",
    },
  ];

  return (
    <div className="space-y-6">
      {/* Stat Cards */}
      <BlurFade delay={0.1} inView>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {statCards.map((card) => (
            <Link key={card.title} href={card.href}>
              <Card
                className={cn(
                  "text-white border-0 hover:opacity-90 transition-opacity cursor-pointer h-full",
                  card.bgColor
                )}
              >
                <CardContent className="p-5">
                  <p className="text-sm font-medium text-white/80">{card.title}</p>
                  <p className="text-3xl font-bold mt-1">{card.value}</p>
                  <p className="text-xs text-white/70 mt-2">{card.description}</p>
                  <div className="flex items-center gap-1 mt-3 text-sm text-white/90">
                    Görüntüle
                    <ChevronRight className="h-4 w-4" />
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </BlurFade>

      {/* Active Services Table */}
      <BlurFade delay={0.15} inView>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Package className="h-5 w-5 text-primary" />
              Aktif Hizmetler ({services.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b text-left text-sm text-muted-foreground">
                    <th className="pb-3 font-medium">Ürün/Hizmet</th>
                    <th className="pb-3 font-medium">Domain</th>
                    <th className="pb-3 font-medium">Sonraki Ödeme</th>
                    <th className="pb-3 font-medium">Durum</th>
                    <th className="pb-3 font-medium"></th>
                  </tr>
                </thead>
                <tbody>
                  {services.map((service) => {
                    const statusInfo = statusMap[service.status] || statusMap.ACTIVE;
                    const StatusIcon = statusInfo.icon;
                    return (
                      <tr key={service.id} className="border-b last:border-0">
                        <td className="py-4">
                          <span className="text-primary font-medium">{service.product.name}</span>
                          {service.label && (
                            <span className="text-muted-foreground text-sm ml-2">({service.label})</span>
                          )}
                        </td>
                        <td className="py-4 text-muted-foreground">{service.domain || "-"}</td>
                        <td className="py-4 text-muted-foreground">
                          {service.nextDueDate
                            ? new Date(service.nextDueDate).toLocaleDateString("tr-TR")
                            : "-"}
                        </td>
                        <td className="py-4">
                          <span className={cn(
                            "inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium",
                            statusInfo.className
                          )}>
                            <StatusIcon className="h-3 w-3" />
                            {statusInfo.label}
                          </span>
                        </td>
                        <td className="py-4 text-right">
                          <Button size="sm" asChild>
                            <Link href={`/musteri/panel/hizmetlerim/${service.id}`}>
                              Yönet
                            </Link>
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                  {services.length === 0 && (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-muted-foreground italic">
                        Aktif hizmet bulunmuyor.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <div className="flex justify-end mt-4">
              <Button variant="link" asChild>
                <Link href="/musteri/panel/hizmetlerim">
                  Tüm Hizmetler
                  <ArrowRight className="ml-1 h-4 w-4" />
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </BlurFade>

      {/* Support Tickets Table */}
      <BlurFade delay={0.2} inView>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Headphones className="h-5 w-5 text-red-500" />
              Aktif Destek Talepleri ({stats.openTickets})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b text-left text-sm text-muted-foreground">
                    <th className="pb-3 font-medium">Talep No</th>
                    <th className="pb-3 font-medium">Konu</th>
                    <th className="pb-3 font-medium">Departman</th>
                    <th className="pb-3 font-medium">Son Güncelleme</th>
                    <th className="pb-3 font-medium">Durum</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.openTickets === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-muted-foreground italic">
                        Aktif destek talebi bulunmuyor.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
            <div className="flex justify-end mt-4">
              <Button asChild>
                <Link href="/musteri/panel/destek">
                  Yeni Destek Talebi
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </BlurFade>
    </div>
  );
}
