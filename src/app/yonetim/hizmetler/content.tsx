"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Search,
  Package,
  Server,
  HardDrive,
  Cloud,
  Globe,
  Shield,
  Mail,
  CheckCircle,
  Pause,
  XCircle,
  Plus,
  MoreHorizontal,
  Eye,
  Edit,
  FileText,
  RefreshCcw,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { BlurFade } from "@/components/magicui/blur-fade";
import {
  activateService,
  cancelService,
  suspendService,
} from "@/lib/actions/admin/services";
import { toast } from "@/lib/toast";

interface ServiceItem {
  id: string;
  label: string;
  domain: string | null;
  ipAddress: string | null;
  serverName: string | null;
  status: string;
  amount: number;
  nextDueDate: Date | null;
  createdAt: Date;
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
    category: {
      id: string;
      slug: string;
      name: string;
    };
  };
}

interface ServiceStats {
  total: number;
  active: number;
  suspended: number;
  cancelled: number;
  expired: number;
  monthlyRevenue: number | unknown;
}

interface ServicesContentProps {
  data: ServiceItem[];
  stats: ServiceStats;
}

const categoryConfig: Record<string, { label: string; icon: React.ComponentType<{ className?: string }>; color: string }> = {
  hosting: { label: "Hosting", icon: Server, color: "text-blue-500 bg-blue-500/10" },
  vds: { label: "VDS", icon: HardDrive, color: "text-purple-500 bg-purple-500/10" },
  vps: { label: "VPS", icon: Cloud, color: "text-cyan-500 bg-cyan-500/10" },
  server: { label: "Sunucu", icon: Server, color: "text-orange-500 bg-orange-500/10" },
  domain: { label: "Domain", icon: Globe, color: "text-green-500 bg-green-500/10" },
  ssl: { label: "SSL", icon: Shield, color: "text-yellow-500 bg-yellow-500/10" },
  email: { label: "E-posta", icon: Mail, color: "text-pink-500 bg-pink-500/10" },
};

const statusConfig: Record<string, { label: string; color: string }> = {
  ACTIVE: { label: "Aktif", color: "bg-green-500/10 text-green-500" },
  SUSPENDED: { label: "Askıda", color: "bg-orange-500/10 text-orange-500" },
  CANCELLED: { label: "İptal", color: "bg-red-500/10 text-red-500" },
  EXPIRED: { label: "Süresi Dolmuş", color: "bg-yellow-500/10 text-yellow-500" },
};

const formatPrice = (price: number) => {
  return new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency: "TRY",
    minimumFractionDigits: 2,
  }).format(price);
};

export function ServicesContent({ data, stats }: ServicesContentProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const router = useRouter();

  const handleSuspendService = async (serviceId: string) => {
    const reason =
      prompt("Askıya alma nedeni:", "Yonetim tarafindan askiya alindi")?.trim() ??
      "";
    if (!reason) return;

    const result = await suspendService(serviceId, reason);
    if (!result.success) {
      toast.error(result.error ?? "Hizmet askıya alınamadı");
      return;
    }
    toast.success("Hizmet askıya alındı");
    router.refresh();
  };

  const handleActivateService = async (serviceId: string) => {
    const result = await activateService(serviceId);
    if (!result.success) {
      toast.error(result.error ?? "Hizmet aktifleştirilemedi");
      return;
    }
    toast.success("Hizmet aktifleştirildi");
    router.refresh();
  };

  const handleCancelService = async (serviceId: string) => {
    const confirmed = window.confirm(
      "Bu hizmeti iptal etmek istediğinize emin misiniz?"
    );
    if (!confirmed) return;

    const result = await cancelService(serviceId);
    if (!result.success) {
      toast.error(result.error ?? "Hizmet iptal edilemedi");
      return;
    }
    toast.success("Hizmet iptal edildi");
    router.refresh();
  };

  const filteredServices = data.filter((service) => {
    const fullName = `${service.customer.name} ${service.customer.surname}`.toLowerCase();
    const matchesSearch =
      fullName.includes(searchQuery.toLowerCase()) ||
      (service.domain && service.domain.toLowerCase().includes(searchQuery.toLowerCase())) ||
      service.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      service.product.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === "all" || service.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const statCards = [
    {
      title: "Toplam Hizmet",
      value: stats.total.toLocaleString("tr-TR"),
      icon: Package,
      color: "text-blue-500",
      bgColor: "bg-blue-500/10",
    },
    {
      title: "Aktif",
      value: stats.active.toLocaleString("tr-TR"),
      icon: CheckCircle,
      color: "text-green-500",
      bgColor: "bg-green-500/10",
    },
    {
      title: "Askıda",
      value: stats.suspended.toLocaleString("tr-TR"),
      icon: Pause,
      color: "text-orange-500",
      bgColor: "bg-orange-500/10",
    },
    {
      title: "İptal",
      value: stats.cancelled.toLocaleString("tr-TR"),
      icon: XCircle,
      color: "text-red-500",
      bgColor: "bg-red-500/10",
    },
  ];

  const statusFilters = [
    { value: "all", label: "Tümü", count: stats.total },
    { value: "ACTIVE", label: "Aktif", count: stats.active, color: "text-green-500" },
    { value: "SUSPENDED", label: "Askıda", count: stats.suspended, color: "text-orange-500" },
    { value: "CANCELLED", label: "İptal", count: stats.cancelled, color: "text-red-500" },
    { value: "EXPIRED", label: "Süresi Dolmuş", count: stats.expired, color: "text-yellow-500" },
  ];

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <BlurFade delay={0}>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">Hizmetler</h1>
            <p className="text-zinc-600 dark:text-zinc-400">Tüm hizmetleri yönetin</p>
          </div>
          <Link href="/yonetim/hizmet-ekle">
            <Button className="bg-primary hover:bg-primary/90">
              <Plus className="mr-2 h-4 w-4" />
              Yeni Hizmet
            </Button>
          </Link>
        </div>
      </BlurFade>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {statCards.map((stat, index) => (
          <BlurFade key={stat.title} delay={0.05 + index * 0.05}>
            <Card className="bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 transition-colors">
              <CardContent className="p-4">
                <div className="flex items-center gap-4">
                  <div className={cn("p-3 rounded-lg", stat.bgColor)}>
                    <stat.icon className={cn("h-6 w-6", stat.color)} />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-zinc-900 dark:text-white">{stat.value}</p>
                    <p className="text-sm text-zinc-600 dark:text-zinc-400">{stat.title}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </BlurFade>
        ))}
      </div>

      {/* Status Filter Buttons */}
      <BlurFade delay={0.25}>
        <div className="flex flex-wrap gap-2">
          {statusFilters.map((filter) => (
            <Button
              key={filter.value}
              variant={statusFilter === filter.value ? "default" : "outline"}
              size="sm"
              onClick={() => setStatusFilter(filter.value)}
              className={cn(
                statusFilter === filter.value
                  ? "bg-primary hover:bg-primary/90"
                  : "bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800"
              )}
            >
              {filter.label}
              <span className={cn(
                "ml-2 px-1.5 py-0.5 rounded text-xs font-medium",
                statusFilter === filter.value
                  ? "bg-white dark:bg-zinc-900 text-primary"
                  : filter.color || "bg-zinc-200 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-400"
              )}>
                {filter.count}
              </span>
            </Button>
          ))}
        </div>
      </BlurFade>

      {/* Search */}
      <BlurFade delay={0.3}>
        <Card className="bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800">
          <CardContent className="p-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
              <Input
                type="search"
                placeholder="Hizmet ID, müşteri, domain veya paket ara..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 bg-zinc-100 dark:bg-zinc-800 border-zinc-300 dark:border-zinc-700 text-zinc-900 dark:text-white placeholder:text-zinc-500"
              />
            </div>
          </CardContent>
        </Card>
      </BlurFade>

      {/* Table */}
      <BlurFade delay={0.35}>
        <Card className="bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-zinc-200 dark:border-zinc-800">
                    <th className="text-left p-4 text-sm font-medium text-zinc-600 dark:text-zinc-400">Hizmet ID</th>
                    <th className="text-left p-4 text-sm font-medium text-zinc-600 dark:text-zinc-400">Müşteri</th>
                    <th className="text-left p-4 text-sm font-medium text-zinc-600 dark:text-zinc-400">Domain</th>
                    <th className="text-left p-4 text-sm font-medium text-zinc-600 dark:text-zinc-400">Kategori / Paket</th>
                    <th className="text-left p-4 text-sm font-medium text-zinc-600 dark:text-zinc-400">Fiyat</th>
                    <th className="text-left p-4 text-sm font-medium text-zinc-600 dark:text-zinc-400">Yenileme</th>
                    <th className="text-left p-4 text-sm font-medium text-zinc-600 dark:text-zinc-400">Durum</th>
                    <th className="text-right p-4 text-sm font-medium text-zinc-600 dark:text-zinc-400">İşlemler</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredServices.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="p-8 text-center">
                        <div className="flex flex-col items-center gap-2">
                          <Package className="h-12 w-12 text-zinc-300 dark:text-zinc-700" />
                          <p className="text-zinc-500 dark:text-zinc-400">Hizmet bulunamadı</p>
                          <p className="text-sm text-zinc-400 dark:text-zinc-500">Arama kriterlerinizi değiştirmeyi deneyin</p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    filteredServices.map((service) => {
                      const slug = service.product.category?.slug || "hosting";
                      const CategoryIcon = categoryConfig[slug]?.icon || Package;
                      return (
                        <tr
                          key={service.id}
                          className="border-b border-zinc-200 dark:border-zinc-800 last:border-0 hover:bg-zinc-100 dark:hover:bg-zinc-800/50 transition-colors"
                        >
                          <td className="p-4">
                            <span className="text-sm font-mono text-zinc-900 dark:text-white">{service.id.slice(0, 8)}</span>
                          </td>
                          <td className="p-4">
                            <div>
                              <p className="text-sm font-medium text-zinc-900 dark:text-white">
                                {service.customer.name} {service.customer.surname}
                              </p>
                            </div>
                          </td>
                          <td className="p-4">
                            <span className="text-sm text-zinc-600 dark:text-zinc-400">{service.domain || "-"}</span>
                          </td>
                          <td className="p-4">
                            <div className="flex items-center gap-2">
                              <div className={cn("p-1.5 rounded", categoryConfig[slug]?.color.split(" ")[1])}>
                                <CategoryIcon className={cn("h-3.5 w-3.5", categoryConfig[slug]?.color.split(" ")[0])} />
                              </div>
                              <div>
                                <p className="text-sm font-medium text-zinc-900 dark:text-white">{categoryConfig[slug]?.label}</p>
                                <p className="text-xs text-zinc-500">{service.product.name}</p>
                              </div>
                            </div>
                          </td>
                          <td className="p-4">
                            <span className="text-sm font-medium text-zinc-900 dark:text-white">
                              {formatPrice(Number(service.amount))}
                              <span className="text-xs font-normal text-zinc-500">/ay</span>
                            </span>
                          </td>
                          <td className="p-4">
                            <span className="text-sm text-zinc-600 dark:text-zinc-400">
                              {service.nextDueDate
                                ? new Date(service.nextDueDate).toLocaleDateString("tr-TR")
                                : "-"}
                            </span>
                          </td>
                          <td className="p-4">
                            <span className={cn(
                              "inline-flex px-2 py-0.5 rounded text-xs font-medium",
                              statusConfig[service.status]?.color || "bg-zinc-500/10 text-zinc-500"
                            )}>
                              {statusConfig[service.status]?.label || service.status}
                            </span>
                          </td>
                          <td className="p-4 text-right">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-8 w-8 p-0 text-zinc-500 hover:text-zinc-900 dark:hover:text-white"
                                >
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-48 bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800">
                                <DropdownMenuItem asChild>
                                  <Link href={`/yonetim/hizmetler/${service.id}`} className="flex items-center cursor-pointer">
                                    <Eye className="mr-2 h-4 w-4" />
                                    Detayları Görüntüle
                                  </Link>
                                </DropdownMenuItem>
                                <DropdownMenuItem asChild>
                                  <Link href={`/yonetim/hizmetler/${service.id}/duzenle`} className="flex items-center cursor-pointer">
                                    <Edit className="mr-2 h-4 w-4" />
                                    Düzenle
                                  </Link>
                                </DropdownMenuItem>
                                <DropdownMenuItem asChild>
                                  <Link href="/yonetim/faturalar/olustur" className="flex items-center cursor-pointer">
                                    <FileText className="mr-2 h-4 w-4" />
                                    Fatura Oluştur
                                  </Link>
                                </DropdownMenuItem>
                                <DropdownMenuSeparator className="bg-zinc-200 dark:bg-zinc-800" />
                                <DropdownMenuItem asChild>
                                  <Link href={`/yonetim/hizmetler/${service.id}#yenileme`} className="flex items-center cursor-pointer">
                                    <RefreshCcw className="mr-2 h-4 w-4" />
                                    Yenileme Geçmişi
                                  </Link>
                                </DropdownMenuItem>
                                {service.status === "ACTIVE" && (
                                  <DropdownMenuItem
                                    onClick={() => {
                                      void handleSuspendService(service.id);
                                    }}
                                    className="flex items-center cursor-pointer text-orange-600 dark:text-orange-500"
                                  >
                                    <Pause className="mr-2 h-4 w-4" />
                                    Askıya Al
                                  </DropdownMenuItem>
                                )}
                                {service.status === "SUSPENDED" && (
                                  <DropdownMenuItem
                                    onClick={() => {
                                      void handleActivateService(service.id);
                                    }}
                                    className="flex items-center cursor-pointer text-green-600 dark:text-green-500"
                                  >
                                    <CheckCircle className="mr-2 h-4 w-4" />
                                    Aktif Et
                                  </DropdownMenuItem>
                                )}
                                {service.status !== "CANCELLED" && (
                                  <DropdownMenuItem
                                    onClick={() => {
                                      void handleCancelService(service.id);
                                    }}
                                    className="flex items-center cursor-pointer text-red-600 dark:text-red-500"
                                  >
                                    <XCircle className="mr-2 h-4 w-4" />
                                    İptal Et
                                  </DropdownMenuItem>
                                )}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </td>
                        </tr>
                      );
                    })
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
