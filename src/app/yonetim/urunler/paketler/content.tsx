"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Plus,
  Search,
  Filter,
  MoreVertical,
  Eye,
  Edit,
  Copy,
  Trash2,
  Package,
  TrendingUp,
  AlertTriangle,
  CheckCircle,
  EyeOff,
  Archive,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { BlurFade } from "@/components/magicui/blur-fade";
import { deleteProduct, updateProduct } from "@/lib/actions/admin/products";
import { toast } from "@/lib/toast";
import {
  categoryConfig,
  productStatusConfig,
} from "@/lib/products/constants";
import type { ProductCategorySlug, ProductStatus } from "@/types/products";

interface ProductData {
  id: string;
  sku: string;
  name: string;
  slug: string;
  shortDescription: string;
  basePrice: number;
  badge: string | null;
  isPopular: boolean;
  displayOrder: number;
  stockQuantity: number;
  isInStock: boolean;
  status: string;
  isVisible: boolean;
  createdAt: Date;
  updatedAt: Date;
  category: {
    id: string;
    slug: string;
    name: string;
  };
  pricingTiers: {
    id: string;
    period: string;
    price: number;
    isDefault: boolean;
    isActive: boolean;
  }[];
}

const categoryOptions = Object.entries(categoryConfig).map(([slug, config]) => ({
  value: slug,
  label: config.name,
}));

const statusMap: Record<string, ProductStatus> = {
  ACTIVE: "active",
  INACTIVE: "inactive",
  DRAFT: "draft",
  ARCHIVED: "archived",
};

interface PackagesContentProps {
  data: ProductData[];
  total: number;
  initialCategory: string;
}

export function PackagesContent({ data, total, initialCategory }: PackagesContentProps) {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState(initialCategory);
  const [statusFilter, setStatusFilter] = useState("all");
  const [visibilityState, setVisibilityState] = useState<Record<string, boolean>>({});
  const [isMutating, setIsMutating] = useState(false);

  const getVisibility = (product: ProductData) => {
    return visibilityState[product.id] ?? product.isVisible;
  };

  const filteredProducts = data.filter((product) => {
    const matchesSearch =
      product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      product.sku.toLowerCase().includes(searchQuery.toLowerCase()) ||
      product.shortDescription.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory =
      categoryFilter === "all" || product.category.slug === categoryFilter;
    const mappedStatus = statusMap[product.status] || product.status.toLowerCase();
    const matchesStatus =
      statusFilter === "all" || mappedStatus === statusFilter;
    return matchesSearch && matchesCategory && matchesStatus;
  });

  const handleToggleVisible = async (productId: string, currentVisible: boolean) => {
    if (isMutating) return;
    setIsMutating(true);
    const result = await updateProduct(productId, { isVisible: !currentVisible });
    if (!result.success) {
      toast.error(result.error ?? "Görünürlük güncellenemedi");
      setIsMutating(false);
      return;
    }

    setVisibilityState((prev) => ({
      ...prev,
      [productId]: !currentVisible,
    }));
    toast.success(!currentVisible ? "Paket görünür yapıldı" : "Paket gizlendi");
    setIsMutating(false);
  };

  const handleArchiveProduct = async (productId: string) => {
    if (isMutating) return;
    const approved = window.confirm(
      "Bu paketi arşivlemek istediğinize emin misiniz?"
    );
    if (!approved) return;

    setIsMutating(true);
    const result = await updateProduct(productId, { status: "ARCHIVED" });
    if (!result.success) {
      toast.error(result.error ?? "Paket arşivlenemedi");
      setIsMutating(false);
      return;
    }

    toast.success("Paket arşivlendi");
    setIsMutating(false);
    router.refresh();
  };

  const handleDeleteProduct = async (productId: string) => {
    if (isMutating) return;
    const approved = window.confirm(
      "Bu paketi silmek istediğinize emin misiniz?"
    );
    if (!approved) return;

    setIsMutating(true);
    const result = await deleteProduct(productId);
    if (!result.success) {
      toast.error(result.error ?? "Paket silinemedi");
      setIsMutating(false);
      return;
    }

    toast.success("Paket silindi");
    setIsMutating(false);
    router.refresh();
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat("tr-TR", {
      style: "currency",
      currency: "TRY",
      minimumFractionDigits: 0,
    }).format(price);
  };

  const activeCount = data.filter((p) => p.status === "ACTIVE").length;
  const lowStockCount = data.filter((p) => p.stockQuantity > 0 && p.stockQuantity <= 5).length;

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <BlurFade delay={0}>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">Paketler</h1>
            <p className="text-zinc-600 dark:text-zinc-400">Ürün ve paketlerinizi yönetin</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-primary/10">
              <Package className="h-5 w-5 text-primary" />
              <span className="text-sm font-medium text-primary">{total} Paket</span>
            </div>
            <Button asChild className="bg-primary hover:bg-primary/90">
              <Link href="/yonetim/urunler/paketler/yeni">
                <Plus className="mr-2 h-4 w-4" />
                Yeni Paket
              </Link>
            </Button>
          </div>
        </div>
      </BlurFade>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <BlurFade delay={0.05}>
          <Card className="bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <Package className="h-5 w-5 text-zinc-500" />
                <span className="text-xs text-zinc-500">Tümü</span>
              </div>
              <p className="mt-2 text-2xl font-bold text-zinc-900 dark:text-white">{total}</p>
              <p className="text-sm text-zinc-600 dark:text-zinc-400">Toplam Paket</p>
            </CardContent>
          </Card>
        </BlurFade>
        <BlurFade delay={0.1}>
          <Card className="bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <CheckCircle className="h-5 w-5 text-green-500" />
                <span className="text-xs text-green-500">
                  %{total > 0 ? ((activeCount / total) * 100).toFixed(0) : 0}
                </span>
              </div>
              <p className="mt-2 text-2xl font-bold text-zinc-900 dark:text-white">{activeCount}</p>
              <p className="text-sm text-zinc-600 dark:text-zinc-400">Aktif Paket</p>
            </CardContent>
          </Card>
        </BlurFade>
        <BlurFade delay={0.15}>
          <Card className="bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <AlertTriangle className="h-5 w-5 text-orange-500" />
                <span className="text-xs text-orange-500">Uyari</span>
              </div>
              <p className="mt-2 text-2xl font-bold text-zinc-900 dark:text-white">{lowStockCount}</p>
              <p className="text-sm text-zinc-600 dark:text-zinc-400">Düşük Stok</p>
            </CardContent>
          </Card>
        </BlurFade>
        <BlurFade delay={0.2}>
          <Card className="bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <TrendingUp className="h-5 w-5 text-blue-500" />
                <span className="text-xs text-blue-500">Toplam</span>
              </div>
              <p className="mt-2 text-2xl font-bold text-zinc-900 dark:text-white">
                {data.filter((p) => p.status === "DRAFT").length}
              </p>
              <p className="text-sm text-zinc-600 dark:text-zinc-400">Taslak</p>
            </CardContent>
          </Card>
        </BlurFade>
      </div>

      {/* Filters */}
      <BlurFade delay={0.25}>
        <Card className="bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800">
          <CardContent className="p-4">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex items-center gap-2">
                <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                  <SelectTrigger className="w-[160px] bg-zinc-100 dark:bg-zinc-800 border-zinc-300 dark:border-zinc-700 text-zinc-900 dark:text-white">
                    <Filter className="mr-2 h-4 w-4" />
                    <SelectValue placeholder="Kategori" />
                  </SelectTrigger>
                  <SelectContent className="bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800">
                    <SelectItem value="all">Tüm Kategoriler</SelectItem>
                    {categoryOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-[140px] bg-zinc-100 dark:bg-zinc-800 border-zinc-300 dark:border-zinc-700 text-zinc-900 dark:text-white">
                    <SelectValue placeholder="Durum" />
                  </SelectTrigger>
                  <SelectContent className="bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800">
                    <SelectItem value="all">Tüm Durumlar</SelectItem>
                    <SelectItem value="active">Aktif</SelectItem>
                    <SelectItem value="inactive">Pasif</SelectItem>
                    <SelectItem value="draft">Taslak</SelectItem>
                    <SelectItem value="archived">Arşivlenmiş</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
                <Input
                  type="search"
                  placeholder="Paket adı, SKU veya açıklama ara..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 bg-zinc-100 dark:bg-zinc-800 border-zinc-300 dark:border-zinc-700 text-zinc-900 dark:text-white placeholder:text-zinc-500"
                />
              </div>
            </div>
          </CardContent>
        </Card>
      </BlurFade>

      {/* Products Table */}
      <BlurFade delay={0.3}>
        <Card className="bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-zinc-200 dark:border-zinc-800">
                    <th className="text-left p-4 text-sm font-medium text-zinc-600 dark:text-zinc-400">SKU</th>
                    <th className="text-left p-4 text-sm font-medium text-zinc-600 dark:text-zinc-400">Paket</th>
                    <th className="text-left p-4 text-sm font-medium text-zinc-600 dark:text-zinc-400">Kategori</th>
                    <th className="text-left p-4 text-sm font-medium text-zinc-600 dark:text-zinc-400">Fiyat</th>
                    <th className="text-left p-4 text-sm font-medium text-zinc-600 dark:text-zinc-400">Stok</th>
                    <th className="text-left p-4 text-sm font-medium text-zinc-600 dark:text-zinc-400">Durum</th>
                    <th className="text-left p-4 text-sm font-medium text-zinc-600 dark:text-zinc-400">Görünür</th>
                    <th className="text-right p-4 text-sm font-medium text-zinc-600 dark:text-zinc-400">İşlemler</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredProducts.map((product) => {
                    const mappedStatus = statusMap[product.status] || product.status.toLowerCase();
                    const statusConf = productStatusConfig[mappedStatus as ProductStatus];
                    const catSlug = product.category.slug as ProductCategorySlug;
                    const catConf = categoryConfig[catSlug as keyof typeof categoryConfig];
                    const StatusIcon = statusConf?.icon;
                    const isVisible = getVisibility(product);

                    return (
                      <tr
                        key={product.id}
                        className={cn(
                          "border-b border-zinc-200 dark:border-zinc-800 last:border-0 hover:bg-zinc-100 dark:hover:bg-zinc-800/50 transition-colors",
                          !isVisible && "opacity-60"
                        )}
                      >
                        <td className="p-4">
                          <code className="text-xs text-zinc-600 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-800 px-2 py-1 rounded font-mono">
                            {product.sku}
                          </code>
                        </td>
                        <td className="p-4">
                          <div className="flex items-center gap-3">
                            <div>
                              <Link
                                href={`/yonetim/urunler/paketler/${product.id}`}
                                className="text-sm font-medium text-zinc-900 dark:text-white hover:text-primary flex items-center gap-2"
                              >
                                {product.name}
                                {product.badge && (
                                  <Badge
                                    variant="outline"
                                    className="text-xs border-primary text-primary"
                                  >
                                    {product.badge}
                                  </Badge>
                                )}
                              </Link>
                              <p className="text-xs text-zinc-500 line-clamp-1 max-w-[200px]">
                                {product.shortDescription}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="p-4">
                          <div className="flex items-center gap-2">
                            <div
                              className={cn(
                                "p-1.5 rounded",
                                catConf?.color || "bg-zinc-200 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400"
                              )}
                            >
                              {catConf?.icon && <catConf.icon className="h-3.5 w-3.5" />}
                            </div>
                            <span className="text-sm text-zinc-600 dark:text-zinc-400">
                              {product.category.name}
                            </span>
                          </div>
                        </td>
                        <td className="p-4">
                          <span className="text-sm font-medium text-zinc-900 dark:text-white">
                            {formatPrice(product.basePrice)}
                            <span className="text-zinc-500 font-normal">/ay</span>
                          </span>
                        </td>
                        <td className="p-4">
                          {product.stockQuantity === -1 ? (
                            <span className="text-sm text-zinc-500">Sınırsız</span>
                          ) : (
                            <Badge
                              className={cn(
                                product.stockQuantity <= 3
                                  ? "bg-red-500/10 text-red-600 dark:text-red-500"
                                  : product.stockQuantity <= 10
                                  ? "bg-yellow-500/10 text-yellow-600 dark:text-yellow-500"
                                  : "bg-green-500/10 text-green-600 dark:text-green-500"
                              )}
                            >
                              {product.stockQuantity} adet
                            </Badge>
                          )}
                        </td>
                        <td className="p-4">
                          <Badge
                            className={cn(
                              "gap-1",
                              mappedStatus === "active" && "bg-green-500/10 text-green-600 dark:text-green-500",
                              mappedStatus === "draft" && "bg-yellow-500/10 text-yellow-600 dark:text-yellow-500",
                              mappedStatus === "inactive" && "bg-zinc-200 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400",
                              mappedStatus === "archived" && "bg-zinc-200 dark:bg-zinc-800 text-zinc-500"
                            )}
                          >
                            {StatusIcon && <StatusIcon className="h-3 w-3" />}
                            {statusConf?.label}
                          </Badge>
                        </td>
                        <td className="p-4">
                          <Switch
                            checked={isVisible}
                            onCheckedChange={() => {
                              void handleToggleVisible(product.id, isVisible);
                            }}
                            className="data-[state=checked]:bg-primary"
                          />
                        </td>
                        <td className="p-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-8 w-8 p-0 text-blue-500 hover:text-blue-600 hover:bg-blue-500/10"
                              asChild
                              title="Düzenle"
                            >
                              <Link href={`/yonetim/urunler/paketler/${product.id}`}>
                                <Edit className="h-4 w-4" />
                              </Link>
                            </Button>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-8 w-8 p-0 text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
                                >
                                  <MoreVertical className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent
                                align="end"
                                className="bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800"
                              >
                                <DropdownMenuItem asChild className="cursor-pointer">
                                  <Link href={`/yonetim/urunler/paketler/${product.id}`}>
                                    <Eye className="mr-2 h-4 w-4" />
                                    Detayları Gör
                                  </Link>
                                </DropdownMenuItem>
                                <DropdownMenuItem className="cursor-pointer">
                                  <Copy className="mr-2 h-4 w-4" />
                                  Kopyala
                                </DropdownMenuItem>
                                <DropdownMenuSeparator className="bg-zinc-200 dark:bg-zinc-800" />
                                <DropdownMenuItem
                                  className="cursor-pointer"
                                  onClick={() => {
                                    void handleToggleVisible(product.id, isVisible);
                                  }}
                                >
                                  {isVisible ? (
                                    <>
                                      <EyeOff className="mr-2 h-4 w-4" />
                                      Gizle
                                    </>
                                  ) : (
                                    <>
                                      <Eye className="mr-2 h-4 w-4" />
                                      Göster
                                    </>
                                  )}
                                </DropdownMenuItem>
                                <DropdownMenuSeparator className="bg-zinc-200 dark:bg-zinc-800" />
                                <DropdownMenuItem
                                  onClick={() => {
                                    void handleArchiveProduct(product.id);
                                  }}
                                  className="cursor-pointer text-orange-500 focus:text-orange-500"
                                >
                                  <Archive className="mr-2 h-4 w-4" />
                                  Arşivle
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => {
                                    void handleDeleteProduct(product.id);
                                  }}
                                  className="cursor-pointer text-red-500 focus:text-red-500"
                                >
                                  <Trash2 className="mr-2 h-4 w-4" />
                                  Sil
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {filteredProducts.length === 0 && (
              <div className="p-8 text-center">
                <Package className="h-12 w-12 text-zinc-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-zinc-900 dark:text-white mb-2">
                  Paket bulunamadı
                </h3>
                <p className="text-zinc-600 dark:text-zinc-400">
                  Arama kriterlerinize uygun paket bulunmuyor.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </BlurFade>
    </div>
  );
}
