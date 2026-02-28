"use client";

import { useState } from "react";
import {
  Plus,
  Search,
  Filter,
  Edit,
  Trash2,
  MoreVertical,
  Eye,
  EyeOff,
  Tag,
  CheckCircle,
  Star,
  ArrowUp,
  ArrowDown,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { BlurFade } from "@/components/magicui/blur-fade";
import { categoryConfig } from "@/lib/products/constants";
import {
  createProductFeature,
  deleteProductFeature,
  moveProductFeature,
  setProductFeatureActive,
  setProductFeatureHighlighted,
  updateProductFeature,
} from "@/lib/actions/admin/product-features";
import { toast } from "@/lib/toast";
import type { ProductCategorySlug } from "@prisma/client";

interface ProductFeatureData {
  id: string;
  categoryId: ProductCategorySlug;
  name: string;
  slug: string;
  unit: string;
  icon: string;
  isHighlighted: boolean;
  displayOrder: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

interface FeaturesContentProps {
  features: ProductFeatureData[];
}

type CategoryFilter = "all" | ProductCategorySlug;

const categoryOptions = Object.entries(categoryConfig).map(([slug, config]) => ({
  value: slug as ProductCategorySlug,
  label: config.name,
}));

function normalizeSlug(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "");
}

export function FeaturesContent({ features: initialFeatures }: FeaturesContentProps) {
  const [features, setFeatures] = useState(initialFeatures);
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingFeature, setEditingFeature] = useState<ProductFeatureData | null>(null);

  const filteredFeatures = features
    .filter((feature) => {
      const matchesSearch =
        feature.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        feature.slug.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory =
        categoryFilter === "all" || feature.categoryId === categoryFilter;
      return matchesSearch && matchesCategory;
    })
    .sort((a, b) => {
      if (a.categoryId !== b.categoryId) {
        return a.categoryId.localeCompare(b.categoryId);
      }
      return a.displayOrder - b.displayOrder;
    });

  const activeCount = features.filter((f) => f.isActive).length;
  const highlightedCount = features.filter((f) => f.isHighlighted).length;

  const handleToggleActive = async (featureId: string) => {
    const feature = features.find((f) => f.id === featureId);
    if (!feature) return;

    const nextValue = !feature.isActive;
    const result = await setProductFeatureActive(featureId, nextValue);

    if (!result.success) {
      toast.error(result.error || "Durum güncellenemedi");
      return;
    }

    setFeatures((prev) =>
      prev.map((f) =>
        f.id === featureId ? { ...f, isActive: nextValue } : f
      )
    );
    toast.success(nextValue ? "Özellik aktif edildi" : "Özellik pasife alındı");
  };

  const handleToggleHighlighted = async (featureId: string) => {
    const feature = features.find((f) => f.id === featureId);
    if (!feature) return;

    const nextValue = !feature.isHighlighted;
    const result = await setProductFeatureHighlighted(featureId, nextValue);

    if (!result.success) {
      toast.error(result.error || "Öne çıkan durumu güncellenemedi");
      return;
    }

    setFeatures((prev) =>
      prev.map((f) =>
        f.id === featureId ? { ...f, isHighlighted: nextValue } : f
      )
    );
    toast.success(nextValue ? "Özellik öne çıkarıldı" : "Öne çıkan kaldırıldı");
  };

  const handleEditFeature = (feature: ProductFeatureData) => {
    setEditingFeature(feature);
    setDialogOpen(true);
  };

  const handleNewFeature = () => {
    const selectedCategory: ProductCategorySlug =
      categoryFilter !== "all" ? categoryFilter : "hosting";

    const nextDisplayOrder =
      features
        .filter((f) => f.categoryId === selectedCategory)
        .reduce((max, feature) => Math.max(max, feature.displayOrder), 0) + 1;

    setEditingFeature({
      id: "",
      categoryId: selectedCategory,
      name: "",
      slug: "",
      unit: "",
      icon: "Tag",
      isHighlighted: false,
      displayOrder: nextDisplayOrder,
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    setDialogOpen(true);
  };

  const handleSaveFeature = async () => {
    if (!editingFeature) return;

    const name = editingFeature.name.trim();
    const slug = normalizeSlug(editingFeature.slug);

    if (!name) {
      toast.error("Özellik adı zorunludur");
      return;
    }

    if (!slug) {
      toast.error("Geçerli bir slug girin");
      return;
    }

    const payload = {
      categoryId: editingFeature.categoryId,
      name,
      slug,
      unit: editingFeature.unit.trim(),
      icon: editingFeature.icon.trim() || "Tag",
      isHighlighted: editingFeature.isHighlighted,
      displayOrder: editingFeature.displayOrder,
      isActive: editingFeature.isActive,
    };

    if (editingFeature.id) {
      const result = await updateProductFeature(editingFeature.id, payload);
      if (!result.success) {
        toast.error(result.error || "Özellik güncellenemedi");
        return;
      }

      setFeatures((prev) =>
        prev.map((feature) =>
          feature.id === editingFeature.id
            ? {
                ...feature,
                ...payload,
                updatedAt: new Date().toISOString(),
              }
            : feature
        )
      );
      toast.success("Özellik güncellendi");
    } else {
      const result = await createProductFeature(payload);
      if (!result.success || !result.data?.id) {
        toast.error(result.error || "Özellik oluşturulamadı");
        return;
      }

      setFeatures((prev) => [
        ...prev,
        {
          id: result.data.id,
          ...payload,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ]);
      toast.success("Özellik oluşturuldu");
    }

    setDialogOpen(false);
    setEditingFeature(null);
  };

  const handleDeleteFeature = async (featureId: string) => {
    const result = await deleteProductFeature(featureId);
    if (!result.success) {
      toast.error(result.error || "Özellik silinemedi");
      return;
    }

    setFeatures((prev) => prev.filter((f) => f.id !== featureId));
    toast.success("Özellik silindi");
  };

  const updateLocalOrder = (featureId: string, direction: "up" | "down") => {
    setFeatures((prev) => {
      const current = prev.find((item) => item.id === featureId);
      if (!current) return prev;

      const siblings = prev
        .filter((item) => item.categoryId === current.categoryId)
        .sort((a, b) => a.displayOrder - b.displayOrder);

      const currentIndex = siblings.findIndex((item) => item.id === featureId);
      const targetIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1;

      if (currentIndex === -1 || targetIndex < 0 || targetIndex >= siblings.length) {
        return prev;
      }

      const target = siblings[targetIndex];

      return prev.map((item) => {
        if (item.id === current.id) {
          return { ...item, displayOrder: target.displayOrder };
        }
        if (item.id === target.id) {
          return { ...item, displayOrder: current.displayOrder };
        }
        return item;
      });
    });
  };

  const handleMoveFeature = async (featureId: string, direction: "up" | "down") => {
    const result = await moveProductFeature(featureId, direction);
    if (!result.success) {
      toast.error(result.error || "Sıralama güncellenemedi");
      return;
    }

    updateLocalOrder(featureId, direction);
  };

  return (
    <div className="space-y-6">
      <BlurFade delay={0}>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">Özellikler</h1>
            <p className="text-zinc-600 dark:text-zinc-400">Ürün özelliklerini tanımlayın ve yönetin</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-primary/10">
              <Tag className="h-5 w-5 text-primary" />
              <span className="text-sm font-medium text-primary">{features.length} Özellik</span>
            </div>
            <Button onClick={handleNewFeature} className="bg-primary hover:bg-primary/90">
              <Plus className="mr-2 h-4 w-4" />
              Özellik Ekle
            </Button>
          </div>
        </div>
      </BlurFade>

      <div className="grid gap-4 md:grid-cols-3">
        <BlurFade delay={0.05}>
          <Card className="bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <Tag className="h-5 w-5 text-zinc-500" />
                <span className="text-xs text-zinc-500">Tüm kategorilerde</span>
              </div>
              <p className="mt-2 text-2xl font-bold text-zinc-900 dark:text-white">{features.length}</p>
              <p className="text-sm text-zinc-600 dark:text-zinc-400">Toplam Özellik</p>
            </CardContent>
          </Card>
        </BlurFade>
        <BlurFade delay={0.1}>
          <Card className="bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <CheckCircle className="h-5 w-5 text-green-500" />
                <span className="text-xs text-green-500">
                  %{features.length > 0 ? ((activeCount / features.length) * 100).toFixed(0) : 0}
                </span>
              </div>
              <p className="mt-2 text-2xl font-bold text-zinc-900 dark:text-white">{activeCount}</p>
              <p className="text-sm text-zinc-600 dark:text-zinc-400">Aktif Özellik</p>
            </CardContent>
          </Card>
        </BlurFade>
        <BlurFade delay={0.15}>
          <Card className="bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <Star className="h-5 w-5 text-yellow-500" />
                <span className="text-xs text-yellow-500">Vurgulanmış</span>
              </div>
              <p className="mt-2 text-2xl font-bold text-zinc-900 dark:text-white">{highlightedCount}</p>
              <p className="text-sm text-zinc-600 dark:text-zinc-400">Öne Çıkan</p>
            </CardContent>
          </Card>
        </BlurFade>
      </div>

      <BlurFade delay={0.2}>
        <Card className="bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800">
          <CardContent className="p-4">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex items-center gap-2">
                <Select value={categoryFilter} onValueChange={(value) => setCategoryFilter(value as CategoryFilter)}>
                  <SelectTrigger className="w-[180px] bg-zinc-100 dark:bg-zinc-800 border-zinc-300 dark:border-zinc-700 text-zinc-900 dark:text-white">
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
              </div>
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
                <Input
                  type="search"
                  placeholder="Özellik adı veya slug ara..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 bg-zinc-100 dark:bg-zinc-800 border-zinc-300 dark:border-zinc-700 text-zinc-900 dark:text-white placeholder:text-zinc-500"
                />
              </div>
            </div>
          </CardContent>
        </Card>
      </BlurFade>

      <BlurFade delay={0.25}>
        <Card className="bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-zinc-200 dark:border-zinc-800">
                    <th className="text-left p-4 text-sm font-medium text-zinc-600 dark:text-zinc-400 w-20">Sıra</th>
                    <th className="text-left p-4 text-sm font-medium text-zinc-600 dark:text-zinc-400">Özellik</th>
                    <th className="text-left p-4 text-sm font-medium text-zinc-600 dark:text-zinc-400">Kategori</th>
                    <th className="text-left p-4 text-sm font-medium text-zinc-600 dark:text-zinc-400">Slug</th>
                    <th className="text-left p-4 text-sm font-medium text-zinc-600 dark:text-zinc-400">Birim</th>
                    <th className="text-center p-4 text-sm font-medium text-zinc-600 dark:text-zinc-400">Öne Çıkan</th>
                    <th className="text-left p-4 text-sm font-medium text-zinc-600 dark:text-zinc-400">Durum</th>
                    <th className="text-left p-4 text-sm font-medium text-zinc-600 dark:text-zinc-400">Aktif</th>
                    <th className="text-right p-4 text-sm font-medium text-zinc-600 dark:text-zinc-400">İşlemler</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredFeatures.map((feature) => {
                    const config = categoryConfig[feature.categoryId as keyof typeof categoryConfig];
                    const IconComponent = config?.icon;

                    const orderedInCategory = features
                      .filter((item) => item.categoryId === feature.categoryId)
                      .sort((a, b) => a.displayOrder - b.displayOrder);
                    const categoryIndex = orderedInCategory.findIndex((item) => item.id === feature.id);

                    return (
                      <tr
                        key={feature.id}
                        className={cn(
                          "border-b border-zinc-200 dark:border-zinc-800 last:border-0 hover:bg-zinc-100 dark:hover:bg-zinc-800/50 transition-colors",
                          !feature.isActive && "opacity-60"
                        )}
                      >
                        <td className="p-4">
                          <div className="flex items-center gap-1">
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-6 w-6 p-0 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
                              onClick={() => handleMoveFeature(feature.id, "up")}
                              disabled={categoryIndex <= 0}
                            >
                              <ArrowUp className="h-3 w-3" />
                            </Button>
                            <span className="text-sm font-medium text-zinc-500 w-4 text-center">
                              {feature.displayOrder}
                            </span>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-6 w-6 p-0 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
                              onClick={() => handleMoveFeature(feature.id, "down")}
                              disabled={categoryIndex === -1 || categoryIndex >= orderedInCategory.length - 1}
                            >
                              <ArrowDown className="h-3 w-3" />
                            </Button>
                          </div>
                        </td>
                        <td className="p-4">
                          <div className="flex items-center gap-2">
                            <Tag className="h-4 w-4 text-zinc-500" />
                            <span className="text-sm font-medium text-zinc-900 dark:text-white">
                              {feature.name}
                            </span>
                          </div>
                        </td>
                        <td className="p-4">
                          <div className="flex items-center gap-2">
                            <div
                              className={cn(
                                "p-1.5 rounded",
                                config?.color || "bg-zinc-200 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400"
                              )}
                            >
                              {IconComponent && <IconComponent className="h-3.5 w-3.5" />}
                            </div>
                            <span className="text-sm text-zinc-600 dark:text-zinc-400">
                              {config?.name}
                            </span>
                          </div>
                        </td>
                        <td className="p-4">
                          <code className="text-xs text-zinc-600 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-800 px-2 py-1 rounded font-mono">
                            {feature.slug}
                          </code>
                        </td>
                        <td className="p-4">
                          <Badge className="bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400">
                            {feature.unit || "-"}
                          </Badge>
                        </td>
                        <td className="p-4 text-center">
                          <button
                            onClick={() => handleToggleHighlighted(feature.id)}
                            className={cn(
                              "p-1.5 rounded transition-colors",
                              feature.isHighlighted
                                ? "text-yellow-500 hover:text-yellow-400 bg-yellow-500/10"
                                : "text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
                            )}
                          >
                            <Star
                              className={cn(
                                "h-4 w-4",
                                feature.isHighlighted && "fill-current"
                              )}
                            />
                          </button>
                        </td>
                        <td className="p-4">
                          <Badge
                            className={cn(
                              feature.isActive
                                ? "bg-green-500/10 text-green-600 dark:text-green-500"
                                : "bg-zinc-200 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-500"
                            )}
                          >
                            {feature.isActive ? "Aktif" : "Pasif"}
                          </Badge>
                        </td>
                        <td className="p-4">
                          <Switch
                            checked={feature.isActive}
                            onCheckedChange={() => handleToggleActive(feature.id)}
                            className="data-[state=checked]:bg-primary"
                          />
                        </td>
                        <td className="p-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-8 w-8 p-0 text-blue-500 hover:text-blue-600 hover:bg-blue-500/10"
                              onClick={() => handleEditFeature(feature)}
                              title="Düzenle"
                            >
                              <Edit className="h-4 w-4" />
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
                                <DropdownMenuItem
                                  className="cursor-pointer"
                                  onClick={() => handleEditFeature(feature)}
                                >
                                  <Edit className="mr-2 h-4 w-4" />
                                  Düzenle
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  className="cursor-pointer"
                                  onClick={() => handleToggleHighlighted(feature.id)}
                                >
                                  <Star className="mr-2 h-4 w-4" />
                                  {feature.isHighlighted ? "Öne Çıkarmayı Kaldır" : "Öne Çıkar"}
                                </DropdownMenuItem>
                                <DropdownMenuSeparator className="bg-zinc-200 dark:bg-zinc-800" />
                                <DropdownMenuItem
                                  className="cursor-pointer"
                                  onClick={() => handleToggleActive(feature.id)}
                                >
                                  {feature.isActive ? (
                                    <>
                                      <EyeOff className="mr-2 h-4 w-4" />
                                      Pasif Yap
                                    </>
                                  ) : (
                                    <>
                                      <Eye className="mr-2 h-4 w-4" />
                                      Aktif Yap
                                    </>
                                  )}
                                </DropdownMenuItem>
                                <DropdownMenuSeparator className="bg-zinc-200 dark:bg-zinc-800" />
                                <DropdownMenuItem
                                  className="cursor-pointer text-red-500 focus:text-red-500"
                                  onClick={() => handleDeleteFeature(feature.id)}
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

            {filteredFeatures.length === 0 && (
              <div className="p-8 text-center">
                <Tag className="h-12 w-12 text-zinc-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-zinc-900 dark:text-white mb-2">
                  Özellik bulunamadı
                </h3>
                <p className="text-zinc-600 dark:text-zinc-400">
                  Arama kriterlerinize uygun özellik bulunmuyor.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </BlurFade>

      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) {
            setEditingFeature(null);
          }
        }}
      >
        <DialogContent className="bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="text-zinc-900 dark:text-white">
              {editingFeature?.id ? "Özellik Düzenle" : "Yeni Özellik"}
            </DialogTitle>
            <DialogDescription className="text-zinc-600 dark:text-zinc-400">
              Özellik bilgilerini {editingFeature?.id ? "güncelleyin" : "girin"}.
            </DialogDescription>
          </DialogHeader>
          {editingFeature && (
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="category" className="text-zinc-700 dark:text-zinc-300">
                  Kategori
                </Label>
                <Select
                  value={editingFeature.categoryId}
                  onValueChange={(value) =>
                    setEditingFeature({ ...editingFeature, categoryId: value as ProductCategorySlug })
                  }
                >
                  <SelectTrigger className="bg-zinc-100 dark:bg-zinc-800 border-zinc-300 dark:border-zinc-700 text-zinc-900 dark:text-white">
                    <SelectValue placeholder="Kategori seçin" />
                  </SelectTrigger>
                  <SelectContent className="bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800">
                    {categoryOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="name" className="text-zinc-700 dark:text-zinc-300">
                    Özellik Adı
                  </Label>
                  <Input
                    id="name"
                    value={editingFeature.name}
                    onChange={(e) =>
                      setEditingFeature({
                        ...editingFeature,
                        name: e.target.value,
                      })
                    }
                    placeholder="Örn: Disk Alanı"
                    className="bg-zinc-100 dark:bg-zinc-800 border-zinc-300 dark:border-zinc-700 text-zinc-900 dark:text-white"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="slug" className="text-zinc-700 dark:text-zinc-300">
                    Slug
                  </Label>
                  <Input
                    id="slug"
                    value={editingFeature.slug}
                    onChange={(e) =>
                      setEditingFeature({
                        ...editingFeature,
                        slug: e.target.value,
                      })
                    }
                    placeholder="Örn: disk-space"
                    className="bg-zinc-100 dark:bg-zinc-800 border-zinc-300 dark:border-zinc-700 text-zinc-900 dark:text-white"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="unit" className="text-zinc-700 dark:text-zinc-300">
                    Birim
                  </Label>
                  <Input
                    id="unit"
                    value={editingFeature.unit}
                    onChange={(e) =>
                      setEditingFeature({
                        ...editingFeature,
                        unit: e.target.value,
                      })
                    }
                    placeholder="Örn: GB, Adet"
                    className="bg-zinc-100 dark:bg-zinc-800 border-zinc-300 dark:border-zinc-700 text-zinc-900 dark:text-white"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="displayOrder" className="text-zinc-700 dark:text-zinc-300">
                    Sıralama
                  </Label>
                  <Input
                    id="displayOrder"
                    type="number"
                    value={editingFeature.displayOrder}
                    onChange={(e) =>
                      setEditingFeature({
                        ...editingFeature,
                        displayOrder: parseInt(e.target.value, 10) || 0,
                      })
                    }
                    className="bg-zinc-100 dark:bg-zinc-800 border-zinc-300 dark:border-zinc-700 text-zinc-900 dark:text-white"
                  />
                </div>
              </div>
              <div className="flex items-center justify-between py-2 px-3 rounded-lg bg-zinc-50 dark:bg-zinc-800/50">
                <div className="flex items-center gap-2">
                  <Star
                    className={cn(
                      "h-4 w-4",
                      editingFeature.isHighlighted
                        ? "text-yellow-500 fill-current"
                        : "text-zinc-500"
                    )}
                  />
                  <Label htmlFor="isHighlighted" className="text-zinc-700 dark:text-zinc-300">
                    Öne Çıkan Özellik
                  </Label>
                </div>
                <Switch
                  id="isHighlighted"
                  checked={editingFeature.isHighlighted}
                  onCheckedChange={(checked) =>
                    setEditingFeature({
                      ...editingFeature,
                      isHighlighted: checked,
                    })
                  }
                  className="data-[state=checked]:bg-yellow-500"
                />
              </div>
              <div className="flex items-center justify-between py-2 px-3 rounded-lg bg-zinc-50 dark:bg-zinc-800/50">
                <div className="flex items-center gap-2">
                  <Eye className="h-4 w-4 text-zinc-500" />
                  <Label htmlFor="isActive" className="text-zinc-700 dark:text-zinc-300">
                    Aktif
                  </Label>
                </div>
                <Switch
                  id="isActive"
                  checked={editingFeature.isActive}
                  onCheckedChange={(checked) =>
                    setEditingFeature({
                      ...editingFeature,
                      isActive: checked,
                    })
                  }
                  className="data-[state=checked]:bg-primary"
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setDialogOpen(false);
                setEditingFeature(null);
              }}
              className="border-zinc-300 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800"
            >
              İptal
            </Button>
            <Button
              onClick={handleSaveFeature}
              className="bg-primary hover:bg-primary/90"
            >
              {editingFeature?.id ? "Kaydet" : "Oluştur"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
