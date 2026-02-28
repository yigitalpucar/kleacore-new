"use client";

import Link from "next/link";
import {
  ArrowLeft,
  Edit,
  Copy,
  Trash2,
  MoreVertical,
  Package,
  ShoppingCart,
  Users,
  TrendingUp,
  CheckCircle,
  HardDrive,
  RefreshCcw,
  Mail,
  Globe,
  Shield,
  Server,
  ExternalLink,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  categoryConfig,
  productStatusConfig,
  billingPeriodConfig,
} from "@/lib/products/constants";
import type { ProductCategorySlug, ProductStatus } from "@/types/products";

interface ProductFeatureValue {
  featureId: string;
  featureName: string;
  value: string | number;
  displayValue: string;
  isUnlimited: boolean;
}

interface ProductWithRelations {
  id: string;
  sku: string;
  name: string;
  slug: string;
  shortDescription: string;
  longDescription: string;
  features: unknown;
  includedFeatures: unknown;
  resourceLimits: unknown;
  basePrice: number;
  badge: string | null;
  isPopular: boolean;
  displayOrder: number;
  stockQuantity: number;
  isInStock: boolean;
  status: string;
  isVisible: boolean;
  metaTitle: string | null;
  metaDescription: string | null;
  createdAt: Date;
  updatedAt: Date;
  category: {
    id: string;
    slug: string;
    name: string;
  };
  pricingTiers: {
    id: string;
    productId: string;
    period: string;
    price: number;
    discountedPrice: number | null;
    setupFee: number;
    renewalPrice: number;
    isDefault: boolean;
    isActive: boolean;
  }[];
}

const statusMap: Record<string, ProductStatus> = {
  ACTIVE: "active",
  INACTIVE: "inactive",
  DRAFT: "draft",
  ARCHIVED: "archived",
};

const resourceIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  diskSpace: HardDrive,
  bandwidth: RefreshCcw,
  emailAccounts: Mail,
  databases: Package,
  domains: Globe,
  sslCertificates: Shield,
  cpuCores: Server,
  ram: Server,
};

interface PackageDetailContentProps {
  product: ProductWithRelations;
}

export function PackageDetailContent({ product }: PackageDetailContentProps) {
  const mappedStatus = statusMap[product.status] || product.status.toLowerCase();
  const statusConf = productStatusConfig[mappedStatus as ProductStatus];
  const catSlug = product.category.slug as ProductCategorySlug;
  const catConf = categoryConfig[catSlug as keyof typeof categoryConfig];
  const StatusIcon = statusConf?.icon;
  const CategoryIcon = catConf?.icon;

  const features = (Array.isArray(product.features) ? product.features : []) as ProductFeatureValue[];
  const includedFeatures = (Array.isArray(product.includedFeatures) ? product.includedFeatures : []) as string[];

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat("tr-TR", {
      style: "currency",
      currency: "TRY",
      minimumFractionDigits: 0,
    }).format(price);
  };

  const formatDate = (date: Date | string) => {
    return new Date(date).toLocaleDateString("tr-TR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <BlurFade delay={0}>
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-4">
            <Link href="/yonetim/urunler/paketler">
              <Button variant="ghost" size="icon" className="text-zinc-400 hover:text-white">
                <ArrowLeft className="h-5 w-5" />
              </Button>
            </Link>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">{product.name}</h1>
                {product.badge && (
                  <Badge variant="outline" className="border-primary text-primary">
                    {product.badge}
                  </Badge>
                )}
                <Badge
                  variant={statusConf?.variant || "secondary"}
                  className={cn(
                    "gap-1",
                    mappedStatus === "active" && "bg-green-500/10 text-green-500"
                  )}
                >
                  {StatusIcon && <StatusIcon className="h-3 w-3" />}
                  {statusConf?.label}
                </Badge>
              </div>
              <div className="flex items-center gap-2 mt-1">
                <code className="text-xs text-zinc-400 bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 rounded">
                  {product.sku}
                </code>
                <span className="text-zinc-600">-</span>
                <div className="flex items-center gap-1.5">
                  {CategoryIcon && (
                    <div className={cn("p-1 rounded", catConf?.color)}>
                      <CategoryIcon className="h-3 w-3" />
                    </div>
                  )}
                  <span className="text-sm text-zinc-400">{product.category.name}</span>
                </div>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button asChild variant="outline" className="border-zinc-300 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800">
              <Link href={`/yonetim/urunler/paketler/${product.id}/duzenle`}>
                <Edit className="mr-2 h-4 w-4" />
                Düzenle
              </Link>
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="text-zinc-400 hover:text-white">
                  <MoreVertical className="h-5 w-5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800">
                <DropdownMenuItem className="cursor-pointer">
                  <Copy className="mr-2 h-4 w-4" />
                  Kopyala
                </DropdownMenuItem>
                <DropdownMenuItem className="cursor-pointer">
                  <ExternalLink className="mr-2 h-4 w-4" />
                  Sitede Görüntüle
                </DropdownMenuItem>
                <DropdownMenuSeparator className="bg-zinc-200 dark:bg-zinc-800" />
                <DropdownMenuItem className="cursor-pointer text-red-400">
                  <Trash2 className="mr-2 h-4 w-4" />
                  Arşivle
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </BlurFade>

      {/* Info Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <BlurFade delay={0.1}>
          <Card className="bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 transition-colors">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <Package className="h-5 w-5 text-zinc-500" />
                <span className="text-xs text-zinc-500">Taban Fiyat</span>
              </div>
              <p className="mt-2 text-2xl font-bold text-zinc-900 dark:text-white">{formatPrice(product.basePrice)}</p>
              <p className="text-sm text-zinc-600 dark:text-zinc-400">Aylık</p>
            </CardContent>
          </Card>
        </BlurFade>
        <BlurFade delay={0.15}>
          <Card className="bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 transition-colors">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <ShoppingCart className="h-5 w-5 text-zinc-500" />
                <span className="text-xs text-zinc-500">Fiyat Dönemleri</span>
              </div>
              <p className="mt-2 text-2xl font-bold text-zinc-900 dark:text-white">{product.pricingTiers.length}</p>
              <p className="text-sm text-zinc-600 dark:text-zinc-400">Aktif Dönem</p>
            </CardContent>
          </Card>
        </BlurFade>
        <BlurFade delay={0.2}>
          <Card className="bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 transition-colors">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <TrendingUp className="h-5 w-5 text-zinc-500" />
                <span className="text-xs text-zinc-500">Stok</span>
              </div>
              <p className="mt-2 text-2xl font-bold text-zinc-900 dark:text-white">
                {product.stockQuantity === -1 ? "Sınırsız" : product.stockQuantity}
              </p>
              <p className="text-sm text-zinc-600 dark:text-zinc-400">Mevcut</p>
            </CardContent>
          </Card>
        </BlurFade>
      </div>

      {/* Tabs */}
      <BlurFade delay={0.3}>
        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList className="bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
            <TabsTrigger value="overview" className="data-[state=active]:bg-white dark:data-[state=active]:bg-zinc-800">
              Genel Bakış
            </TabsTrigger>
            <TabsTrigger value="pricing" className="data-[state=active]:bg-white dark:data-[state=active]:bg-zinc-800">
              Fiyatlandırma
            </TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-6">
            <div className="grid gap-6 md:grid-cols-2">
              {/* Description */}
              <Card className="bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800">
                <CardHeader>
                  <CardTitle className="text-zinc-900 dark:text-white">Açıklama</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-4">
                    {product.shortDescription}
                  </p>
                  {product.longDescription && (
                    <p className="text-sm text-zinc-500">
                      {product.longDescription}
                    </p>
                  )}
                </CardContent>
              </Card>

              {/* Resource Limits */}
              <Card className="bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800">
                <CardHeader>
                  <CardTitle className="text-zinc-900 dark:text-white">Kaynak Limitleri</CardTitle>
                </CardHeader>
                <CardContent>
                  {features.length > 0 ? (
                    <div className="space-y-3">
                      {features.map((feature) => {
                        const Icon = resourceIcons[feature.featureId.replace("f", "")] || Package;
                        return (
                          <div
                            key={feature.featureId}
                            className="flex items-center justify-between py-2 border-b border-zinc-200 dark:border-zinc-800 last:border-0"
                          >
                            <div className="flex items-center gap-2">
                              <Icon className="h-4 w-4 text-zinc-500" />
                              <span className="text-sm text-zinc-700 dark:text-zinc-300">
                                {feature.featureName}
                              </span>
                            </div>
                            <span
                              className={cn(
                                "text-sm font-medium",
                                feature.isUnlimited ? "text-green-500" : "text-zinc-900 dark:text-white"
                              )}
                            >
                              {feature.displayValue}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-sm text-zinc-500">Henüz özellik tanımlanmadı.</p>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Included Features */}
            {includedFeatures.length > 0 && (
              <Card className="bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800">
                <CardHeader>
                  <CardTitle className="text-zinc-900 dark:text-white">Dahil Özellikler</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    {includedFeatures.map((feature, index) => (
                      <Badge
                        key={index}
                        variant="secondary"
                        className="bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 gap-1"
                      >
                        <CheckCircle className="h-3 w-3 text-green-500" />
                        {feature}
                      </Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Meta Info */}
            <Card className="bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800">
              <CardHeader>
                <CardTitle className="text-zinc-900 dark:text-white">Detaylar</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 md:grid-cols-2 text-sm">
                  <div className="flex justify-between py-2 border-b border-zinc-200 dark:border-zinc-800">
                    <span className="text-zinc-500">Oluşturulma</span>
                    <span className="text-zinc-900 dark:text-white">{formatDate(product.createdAt)}</span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-zinc-200 dark:border-zinc-800">
                    <span className="text-zinc-500">Son Güncelleme</span>
                    <span className="text-zinc-900 dark:text-white">{formatDate(product.updatedAt)}</span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-zinc-200 dark:border-zinc-800">
                    <span className="text-zinc-500">Slug</span>
                    <code className="text-zinc-600 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 rounded text-xs font-mono">{product.slug}</code>
                  </div>
                  <div className="flex justify-between py-2 border-b border-zinc-200 dark:border-zinc-800">
                    <span className="text-zinc-500">Popüler</span>
                    <span className="text-zinc-900 dark:text-white">{product.isPopular ? "Evet" : "Hayır"}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Pricing Tab */}
          <TabsContent value="pricing" className="space-y-6">
            <Card className="bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800">
              <CardHeader>
                <CardTitle className="text-zinc-900 dark:text-white">Fiyat Tablosu</CardTitle>
                <CardDescription className="text-zinc-400">
                  Farklı dönemler için fiyatlandırma
                </CardDescription>
              </CardHeader>
              <CardContent>
                {product.pricingTiers.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-zinc-200 dark:border-zinc-800">
                          <th className="text-left p-3 text-sm font-medium text-zinc-600 dark:text-zinc-400">Dönem</th>
                          <th className="text-left p-3 text-sm font-medium text-zinc-600 dark:text-zinc-400">Fiyat</th>
                          <th className="text-left p-3 text-sm font-medium text-zinc-600 dark:text-zinc-400">Aylık</th>
                          <th className="text-left p-3 text-sm font-medium text-zinc-600 dark:text-zinc-400">Kurulum</th>
                          <th className="text-left p-3 text-sm font-medium text-zinc-600 dark:text-zinc-400">Yenileme</th>
                          <th className="text-left p-3 text-sm font-medium text-zinc-600 dark:text-zinc-400">Durum</th>
                        </tr>
                      </thead>
                      <tbody>
                        {product.pricingTiers.map((tier) => {
                          const periodConf = billingPeriodConfig[tier.period as keyof typeof billingPeriodConfig];
                          const monthlyPrice = periodConf ? tier.price / periodConf.months : tier.price;

                          return (
                            <tr
                              key={tier.id}
                              className="border-b border-zinc-200 dark:border-zinc-800 last:border-0 hover:bg-zinc-100 dark:hover:bg-zinc-800/50"
                            >
                              <td className="p-3">
                                <div className="flex items-center gap-2">
                                  <span className="text-sm font-medium text-zinc-900 dark:text-white">
                                    {periodConf?.label || tier.period}
                                  </span>
                                  {tier.isDefault && (
                                    <Badge variant="outline" className="text-xs border-primary text-primary">
                                      Varsayılan
                                    </Badge>
                                  )}
                                  {periodConf && periodConf.discount > 0 && (
                                    <Badge className="text-xs bg-green-500/10 text-green-500">
                                      %{periodConf.discount} İndirim
                                    </Badge>
                                  )}
                                </div>
                              </td>
                              <td className="p-3">
                                <span className="text-sm font-medium text-zinc-900 dark:text-white">
                                  {formatPrice(tier.price)}
                                </span>
                              </td>
                              <td className="p-3">
                                <span className="text-sm text-zinc-600 dark:text-zinc-400">
                                  {formatPrice(Math.round(monthlyPrice))}/ay
                                </span>
                              </td>
                              <td className="p-3">
                                <span className="text-sm text-zinc-600 dark:text-zinc-400">
                                  {tier.setupFee > 0 ? formatPrice(tier.setupFee) : "Ücretsiz"}
                                </span>
                              </td>
                              <td className="p-3">
                                <span className="text-sm text-zinc-600 dark:text-zinc-400">
                                  {formatPrice(tier.renewalPrice)}
                                </span>
                              </td>
                              <td className="p-3">
                                <Badge
                                  className={cn(
                                    tier.isActive
                                      ? "bg-green-500/10 text-green-500"
                                      : "bg-zinc-200 dark:bg-zinc-800 text-zinc-500"
                                  )}
                                >
                                  {tier.isActive ? "Aktif" : "Pasif"}
                                </Badge>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-sm text-zinc-500 text-center py-6">Henüz fiyatlandırma tanımlanmadı.</p>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </BlurFade>
    </div>
  );
}
