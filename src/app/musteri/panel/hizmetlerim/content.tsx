"use client";

import { useState } from "react";
import Link from "next/link";
import { BlurFade } from "@/components/magicui/blur-fade";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Package,
  Server,
  Shield,
  Cloud,
  Search,
  MoreVertical,
  RefreshCcw,
  Settings,
  ExternalLink,
  CheckCircle2,
  AlertCircle,
  Clock,
  XCircle,
  ChevronRight,
  Mail,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

const statusConfig: Record<string, {
  label: string;
  color: string;
  bgColor: string;
  icon: typeof CheckCircle2;
}> = {
  ACTIVE: {
    label: "Aktif",
    color: "text-green-500",
    bgColor: "bg-green-500/10",
    icon: CheckCircle2,
  },
  EXPIRED: {
    label: "Süresi Doldu",
    color: "text-red-500",
    bgColor: "bg-red-500/10",
    icon: XCircle,
  },
  SUSPENDED: {
    label: "Askıda",
    color: "text-gray-500",
    bgColor: "bg-gray-500/10",
    icon: Clock,
  },
  CANCELLED: {
    label: "İptal",
    color: "text-orange-500",
    bgColor: "bg-orange-500/10",
    icon: AlertCircle,
  },
};

const categoryIcons: Record<string, typeof Package> = {
  hosting: Package,
  vds: Server,
  vps: Server,
  server: Server,
  ssl: Shield,
  domain: Cloud,
  email: Mail,
};

const filterOptions = [
  { value: "all", label: "Tümü" },
  { value: "hosting", label: "Hosting" },
  { value: "domain", label: "Domain" },
  { value: "vds", label: "VDS" },
  { value: "vps", label: "VPS" },
  { value: "server", label: "Sunucu" },
  { value: "ssl", label: "SSL" },
  { value: "email", label: "E-posta" },
];

interface ServiceItem {
  id: string;
  label: string;
  domain: string | null;
  status: string;
  amount: number;
  billingPeriod: string;
  nextDueDate: string | null;
  createdAt: string;
  product: {
    id: string;
    name: string;
    sku: string;
    category: {
      slug: string;
      name: string;
    };
  };
}

interface HizmetlerimContentProps {
  services: ServiceItem[];
}

const billingPeriodLabels: Record<string, string> = {
  monthly: "ay",
  quarterly: "3 ay",
  semiannual: "6 ay",
  yearly: "yıl",
  biennial: "2 yıl",
  triennial: "3 yıl",
};

const currencyFormatter = new Intl.NumberFormat("tr-TR", {
  style: "currency",
  currency: "TRY",
});

export function HizmetlerimContent({ services }: HizmetlerimContentProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [filter, setFilter] = useState("all");

  const filteredServices = services.filter((service) => {
    const matchesSearch =
      service.product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (service.domain || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
      service.label.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesFilter =
      filter === "all" || service.product.category.slug === filter;
    return matchesSearch && matchesFilter;
  });

  const stats = {
    total: services.length,
    active: services.filter((s) => s.status === "ACTIVE").length,
    expired: services.filter((s) => s.status === "EXPIRED").length,
    suspended: services.filter((s) => s.status === "SUSPENDED").length,
  };

  const hasServices = services.length > 0;
  const isFilteredEmpty = hasServices && filteredServices.length === 0;

  return (
    <div className="space-y-6">
      <BlurFade delay={0.1} inView>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Hizmetlerim</h1>
            <p className="text-muted-foreground">
              Tüm aktif hizmetlerinizi görüntüleyin ve yönetin.
            </p>
          </div>
          <Button asChild>
            <Link href="/hosting">Yeni Hizmet Al</Link>
          </Button>
        </div>
      </BlurFade>

      <BlurFade delay={0.15} inView>
        <div className="grid gap-4 sm:grid-cols-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-blue-500/10">
                  <Package className="h-5 w-5 text-blue-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Toplam Hizmet</p>
                  <p className="text-2xl font-bold">{stats.total}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-green-500/10">
                  <CheckCircle2 className="h-5 w-5 text-green-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Aktif</p>
                  <p className="text-2xl font-bold text-green-500">{stats.active}</p>
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
                  <p className="text-sm text-muted-foreground">Askıda</p>
                  <p className="text-2xl font-bold text-orange-500">{stats.suspended}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-red-500/10">
                  <XCircle className="h-5 w-5 text-red-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Süresi Doldu</p>
                  <p className="text-2xl font-bold text-red-500">{stats.expired}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </BlurFade>

      <BlurFade delay={0.2} inView>
        <Card>
          <CardContent className="p-4">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex flex-wrap gap-2">
                {filterOptions.map((option) => (
                  <Button
                    key={option.value}
                    variant={filter === option.value ? "default" : "outline"}
                    size="sm"
                    onClick={() => setFilter(option.value)}
                  >
                    {option.label}
                  </Button>
                ))}
              </div>
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Hizmet veya domain ara..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
          </CardContent>
        </Card>
      </BlurFade>

      <BlurFade delay={0.25} inView>
        <Card>
          <CardHeader>
            <CardTitle>Hizmetler ({filteredServices.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {filteredServices.map((service) => {
                const status = statusConfig[service.status] || statusConfig.ACTIVE;
                const StatusIcon = status.icon;
                const CategoryIcon = categoryIcons[service.product.category.slug] || Package;
                const detailHref = `/musteri/panel/hizmetlerim/${service.id}`;
                const renewHref = `/musteri/panel/hizmetlerim/${service.id}/yenile`;
                const showCpanel = service.product.category.slug === "hosting";

                return (
                  <div
                    key={service.id}
                    className="flex items-center gap-4 p-4 rounded-lg border hover:shadow-sm transition-shadow group"
                  >
                    <Link href={detailHref} className="flex items-center gap-4 flex-1 min-w-0">
                      <div className={cn("p-3 rounded-lg shrink-0", status.bgColor)}>
                        <CategoryIcon className={cn("h-6 w-6", status.color)} />
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-semibold truncate">{service.product.name}</p>
                          <span className="text-xs px-2 py-0.5 rounded-full bg-muted">
                            {service.product.category.name}
                          </span>
                          <span
                            className={cn(
                              "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium md:hidden",
                              status.bgColor,
                              status.color
                            )}
                          >
                            <StatusIcon className="h-3 w-3" />
                            {status.label}
                          </span>
                        </div>
                        <p className="text-sm text-muted-foreground truncate">
                          {service.domain || service.label || "-"}
                        </p>
                      </div>

                      <div className="hidden md:block text-right shrink-0">
                        <p className="text-sm font-medium">
                          {currencyFormatter.format(Number(service.amount))}/
                          {billingPeriodLabels[service.billingPeriod] || service.billingPeriod}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Bitiş:{" "}
                          {service.nextDueDate
                            ? new Date(service.nextDueDate).toLocaleDateString("tr-TR")
                            : "-"}
                        </p>
                      </div>

                      <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-foreground transition-colors shrink-0" />
                    </Link>

                    <div className="hidden sm:flex items-center gap-2 shrink-0">
                      <div
                        className={cn(
                          "flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium",
                          status.bgColor,
                          status.color
                        )}
                      >
                        <StatusIcon className="h-3 w-3" />
                        {status.label}
                      </div>

                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem asChild>
                            <Link href={detailHref}>
                              <Settings className="mr-2 h-4 w-4" />
                              Yönet
                            </Link>
                          </DropdownMenuItem>
                          <DropdownMenuItem asChild>
                            <Link href={renewHref}>
                              <RefreshCcw className="mr-2 h-4 w-4" />
                              Yenile
                            </Link>
                          </DropdownMenuItem>
                          {showCpanel && (
                            <DropdownMenuItem asChild>
                              <Link href={detailHref}>
                                <ExternalLink className="mr-2 h-4 w-4" />
                                cPanel
                              </Link>
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                );
              })}

              {!hasServices && (
                <div className="text-center py-10">
                  <Package className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
                  <p className="text-muted-foreground mb-4">Henüz hizmetiniz bulunmuyor.</p>
                  <Button asChild>
                    <Link href="/hosting">Hizmetleri İncele</Link>
                  </Button>
                </div>
              )}

              {isFilteredEmpty && (
                <div className="text-center py-8 text-muted-foreground">
                  Aramanızla eşleşen hizmet bulunamadı.
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </BlurFade>
    </div>
  );
}