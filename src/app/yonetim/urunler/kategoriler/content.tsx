"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  Plus,
  Search,
  Edit,
  MoreVertical,
  Eye,
  EyeOff,
  Package,
  Layers,
  Trash2,
  ArrowUp,
  ArrowDown,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
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
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { BlurFade } from "@/components/magicui/blur-fade";
import { categoryConfig } from "@/lib/products/constants";
import {
  createCategory,
  deleteCategory,
  moveCategory,
  updateCategory,
} from "@/lib/actions/admin/categories";
import { toast } from "@/lib/toast";
import type { ProductCategorySlug } from "@prisma/client";

interface CategoryData {
  id: string;
  slug: ProductCategorySlug;
  name: string;
  description: string;
  icon: string;
  displayOrder: number;
  isActive: boolean;
  productCount: number;
  createdAt: string;
  updatedAt: string;
}

interface CategoriesContentProps {
  categories: CategoryData[];
}

type DialogMode = "create" | "edit";

const categoryOptions = Object.entries(categoryConfig).map(([slug, config]) => ({
  value: slug as ProductCategorySlug,
  label: config.name,
  description: config.description,
}));

export function CategoriesContent({ categories: initialCategories }: CategoriesContentProps) {
  const [categories, setCategories] = useState(initialCategories);
  const [searchQuery, setSearchQuery] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<DialogMode>("edit");
  const [editingCategory, setEditingCategory] = useState<CategoryData | null>(null);

  const sortedCategories = useMemo(
    () => [...categories].sort((a, b) => a.displayOrder - b.displayOrder),
    [categories]
  );

  const filteredCategories = sortedCategories.filter((category) => {
    return (
      category.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      category.slug.toLowerCase().includes(searchQuery.toLowerCase()) ||
      category.description.toLowerCase().includes(searchQuery.toLowerCase())
    );
  });

  const usedSlugs = useMemo(
    () => new Set(categories.map((category) => category.slug)),
    [categories]
  );

  const availableSlugOptions = categoryOptions.filter(
    (option) => !usedSlugs.has(option.value)
  );

  const closeDialog = () => {
    setDialogOpen(false);
    setEditingCategory(null);
  };

  const handleNewCategory = () => {
    if (availableSlugOptions.length === 0) {
      toast.error("Eklenebilir yeni kategori kalmadı.");
      return;
    }

    const selectedSlug = availableSlugOptions[0].value;
    const defaultConfig = categoryConfig[selectedSlug];

    const nextDisplayOrder =
      sortedCategories.length > 0
        ? sortedCategories[sortedCategories.length - 1].displayOrder + 1
        : 1;

    setDialogMode("create");
    setEditingCategory({
      id: "",
      slug: selectedSlug,
      name: defaultConfig.name,
      description: defaultConfig.description,
      icon: "Package",
      displayOrder: nextDisplayOrder,
      isActive: true,
      productCount: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    setDialogOpen(true);
  };

  const handleEditCategory = (category: CategoryData) => {
    setDialogMode("edit");
    setEditingCategory(category);
    setDialogOpen(true);
  };

  const handleToggleActive = async (categoryId: string) => {
    const category = categories.find((cat) => cat.id === categoryId);
    if (!category) return;

    const nextValue = !category.isActive;
    const result = await updateCategory(categoryId, { isActive: nextValue });

    if (!result.success) {
      toast.error(result.error || "Kategori durumu güncellenemedi");
      return;
    }

    setCategories((prev) =>
      prev.map((cat) =>
        cat.id === categoryId ? { ...cat, isActive: nextValue } : cat
      )
    );
    toast.success(nextValue ? "Kategori aktif edildi" : "Kategori pasife alındı");
  };

  const swapLocalOrder = (categoryId: string, direction: "up" | "down") => {
    setCategories((prev) => {
      const sorted = [...prev].sort((a, b) => a.displayOrder - b.displayOrder);
      const index = sorted.findIndex((cat) => cat.id === categoryId);
      const targetIndex = direction === "up" ? index - 1 : index + 1;

      if (index === -1 || targetIndex < 0 || targetIndex >= sorted.length) {
        return prev;
      }

      const current = sorted[index];
      const target = sorted[targetIndex];

      return prev.map((cat) => {
        if (cat.id === current.id) {
          return { ...cat, displayOrder: target.displayOrder };
        }
        if (cat.id === target.id) {
          return { ...cat, displayOrder: current.displayOrder };
        }
        return cat;
      });
    });
  };

  const handleMove = async (categoryId: string, direction: "up" | "down") => {
    const result = await moveCategory(categoryId, direction);
    if (!result.success) {
      toast.error(result.error || "Kategori sırası güncellenemedi");
      return;
    }

    swapLocalOrder(categoryId, direction);
  };

  const handleSaveCategory = async () => {
    if (!editingCategory) return;

    const name = editingCategory.name.trim();
    const description = editingCategory.description.trim();

    if (!name) {
      toast.error("Kategori adı zorunludur");
      return;
    }

    if (dialogMode === "create") {
      const result = await createCategory({
        slug: editingCategory.slug,
        name,
        description,
        icon: editingCategory.icon || "Package",
        displayOrder: editingCategory.displayOrder,
        isActive: editingCategory.isActive,
      });

      if (!result.success || !result.data?.id) {
        toast.error(result.error || "Kategori oluşturulamadı");
        return;
      }

      setCategories((prev) => [
        ...prev,
        {
          ...editingCategory,
          id: result.data.id,
          name,
          description,
          productCount: 0,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ]);

      toast.success("Kategori oluşturuldu");
      closeDialog();
      return;
    }

    const result = await updateCategory(editingCategory.id, {
      name,
      description,
      displayOrder: editingCategory.displayOrder,
      isActive: editingCategory.isActive,
    });

    if (!result.success) {
      toast.error(result.error || "Kategori güncellenemedi");
      return;
    }

    setCategories((prev) =>
      prev.map((cat) =>
        cat.id === editingCategory.id
          ? {
              ...cat,
              name,
              description,
              displayOrder: editingCategory.displayOrder,
              isActive: editingCategory.isActive,
              updatedAt: new Date().toISOString(),
            }
          : cat
      )
    );

    toast.success("Kategori güncellendi");
    closeDialog();
  };

  const handleDeleteCategory = async (category: CategoryData) => {
    if (category.productCount > 0) {
      toast.error("Önce bu kategoriye bağlı ürünleri kaldırın.");
      return;
    }

    const result = await deleteCategory(category.id);
    if (!result.success) {
      toast.error(result.error || "Kategori silinemedi");
      return;
    }

    setCategories((prev) => prev.filter((cat) => cat.id !== category.id));
    toast.success("Kategori silindi");
  };

  const activeCount = categories.filter((cat) => cat.isActive).length;
  const totalProducts = categories.reduce((sum, cat) => sum + cat.productCount, 0);

  return (
    <div className="space-y-6">
      <BlurFade delay={0}>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">Kategoriler</h1>
            <p className="text-zinc-600 dark:text-zinc-400">Ürün kategorilerini yönetin</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-primary/10">
              <Layers className="h-5 w-5 text-primary" />
              <span className="text-sm font-medium text-primary">{categories.length} Kategori</span>
            </div>
            <Button
              className="bg-primary hover:bg-primary/90"
              onClick={handleNewCategory}
              disabled={availableSlugOptions.length === 0}
            >
              <Plus className="mr-2 h-4 w-4" />
              Kategori Ekle
            </Button>
          </div>
        </div>
      </BlurFade>

      <div className="grid gap-4 md:grid-cols-3">
        <BlurFade delay={0.05}>
          <Card className="bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <Layers className="h-5 w-5 text-zinc-500" />
                <span className="text-xs text-zinc-500">Tümü</span>
              </div>
              <p className="mt-2 text-2xl font-bold text-zinc-900 dark:text-white">{categories.length}</p>
              <p className="text-sm text-zinc-600 dark:text-zinc-400">Toplam Kategori</p>
            </CardContent>
          </Card>
        </BlurFade>
        <BlurFade delay={0.1}>
          <Card className="bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <Eye className="h-5 w-5 text-green-500" />
                <span className="text-xs text-green-500">
                  %{categories.length > 0 ? ((activeCount / categories.length) * 100).toFixed(0) : 0}
                </span>
              </div>
              <p className="mt-2 text-2xl font-bold text-zinc-900 dark:text-white">{activeCount}</p>
              <p className="text-sm text-zinc-600 dark:text-zinc-400">Aktif Kategori</p>
            </CardContent>
          </Card>
        </BlurFade>
        <BlurFade delay={0.15}>
          <Card className="bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <Package className="h-5 w-5 text-blue-500" />
                <span className="text-xs text-zinc-500">Tüm kategorilerde</span>
              </div>
              <p className="mt-2 text-2xl font-bold text-zinc-900 dark:text-white">{totalProducts}</p>
              <p className="text-sm text-zinc-600 dark:text-zinc-400">Toplam Ürün</p>
            </CardContent>
          </Card>
        </BlurFade>
      </div>

      <BlurFade delay={0.2}>
        <Card className="bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800">
          <CardContent className="p-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
              <Input
                type="search"
                placeholder="Kategori adı, slug veya açıklama ara..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 bg-zinc-100 dark:bg-zinc-800 border-zinc-300 dark:border-zinc-700 text-zinc-900 dark:text-white placeholder:text-zinc-500"
              />
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
                    <th className="text-left p-4 text-sm font-medium text-zinc-600 dark:text-zinc-400">Kategori</th>
                    <th className="text-left p-4 text-sm font-medium text-zinc-600 dark:text-zinc-400">Açıklama</th>
                    <th className="text-left p-4 text-sm font-medium text-zinc-600 dark:text-zinc-400">Ürün</th>
                    <th className="text-left p-4 text-sm font-medium text-zinc-600 dark:text-zinc-400">Durum</th>
                    <th className="text-left p-4 text-sm font-medium text-zinc-600 dark:text-zinc-400">Aktif</th>
                    <th className="text-right p-4 text-sm font-medium text-zinc-600 dark:text-zinc-400">İşlemler</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredCategories.map((category) => {
                    const config = categoryConfig[category.slug as keyof typeof categoryConfig];
                    const IconComponent = config?.icon;
                    const sortedIndex = sortedCategories.findIndex((cat) => cat.id === category.id);

                    return (
                      <tr
                        key={category.id}
                        className={cn(
                          "border-b border-zinc-200 dark:border-zinc-800 last:border-0 hover:bg-zinc-100 dark:hover:bg-zinc-800/50 transition-colors",
                          !category.isActive && "opacity-60"
                        )}
                      >
                        <td className="p-4">
                          <div className="flex items-center gap-1">
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-6 w-6 p-0 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
                              onClick={() => handleMove(category.id, "up")}
                              disabled={sortedIndex <= 0}
                            >
                              <ArrowUp className="h-3 w-3" />
                            </Button>
                            <span className="text-sm font-medium text-zinc-500 w-4 text-center">
                              {category.displayOrder}
                            </span>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-6 w-6 p-0 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
                              onClick={() => handleMove(category.id, "down")}
                              disabled={sortedIndex === -1 || sortedIndex === sortedCategories.length - 1}
                            >
                              <ArrowDown className="h-3 w-3" />
                            </Button>
                          </div>
                        </td>
                        <td className="p-4">
                          <div className="flex items-center gap-3">
                            <div
                              className={cn(
                                "p-2 rounded-lg",
                                config?.color || "bg-zinc-200 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400"
                              )}
                            >
                              {IconComponent && <IconComponent className="h-4 w-4" />}
                            </div>
                            <div>
                              <p className="text-sm font-medium text-zinc-900 dark:text-white">
                                {category.name}
                              </p>
                              <p className="text-xs text-zinc-500 font-mono">{category.slug}</p>
                            </div>
                          </div>
                        </td>
                        <td className="p-4">
                          <p className="text-sm text-zinc-600 dark:text-zinc-400 max-w-xs truncate">
                            {category.description}
                          </p>
                        </td>
                        <td className="p-4">
                          <Link
                            href={`/yonetim/urunler/paketler?kategori=${category.slug}`}
                            className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
                          >
                            <Package className="h-3 w-3" />
                            {category.productCount}
                          </Link>
                        </td>
                        <td className="p-4">
                          <Badge
                            className={cn(
                              category.isActive
                                ? "bg-green-500/10 text-green-600 dark:text-green-500 hover:bg-green-500/20"
                                : "bg-zinc-200 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-500"
                            )}
                          >
                            {category.isActive ? "Aktif" : "Pasif"}
                          </Badge>
                        </td>
                        <td className="p-4">
                          <Switch
                            checked={category.isActive}
                            onCheckedChange={() => handleToggleActive(category.id)}
                            className="data-[state=checked]:bg-primary"
                          />
                        </td>
                        <td className="p-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-8 w-8 p-0 text-blue-500 hover:text-blue-600 hover:bg-blue-500/10"
                              onClick={() => handleEditCategory(category)}
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
                                  onClick={() => handleEditCategory(category)}
                                >
                                  <Edit className="mr-2 h-4 w-4" />
                                  Düzenle
                                </DropdownMenuItem>
                                <DropdownMenuItem asChild className="cursor-pointer">
                                  <Link href={`/yonetim/urunler/paketler?kategori=${category.slug}`}>
                                    <Package className="mr-2 h-4 w-4" />
                                    Ürünleri Gör
                                  </Link>
                                </DropdownMenuItem>
                                <DropdownMenuSeparator className="bg-zinc-200 dark:bg-zinc-800" />
                                <DropdownMenuItem
                                  className="cursor-pointer"
                                  onClick={() => handleToggleActive(category.id)}
                                >
                                  {category.isActive ? (
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
                                  className={cn(
                                    "cursor-pointer text-red-500 focus:text-red-500",
                                    category.productCount > 0 && "opacity-50 cursor-not-allowed"
                                  )}
                                  onClick={() => handleDeleteCategory(category)}
                                  disabled={category.productCount > 0}
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

            {filteredCategories.length === 0 && (
              <div className="p-8 text-center">
                <Layers className="h-12 w-12 text-zinc-400 mx-auto mb-4" />
                <p className="text-zinc-600 dark:text-zinc-400">Kategori bulunamadı</p>
              </div>
            )}
          </CardContent>
        </Card>
      </BlurFade>

      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => {
          if (!open) {
            closeDialog();
            return;
          }
          setDialogOpen(open);
        }}
      >
        <DialogContent className="bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="text-zinc-900 dark:text-white">
              {dialogMode === "create" ? "Kategori Ekle" : "Kategori Düzenle"}
            </DialogTitle>
            <DialogDescription className="text-zinc-600 dark:text-zinc-400">
              {dialogMode === "create"
                ? "Yeni kategori bilgilerini girin."
                : "Kategori bilgilerini güncelleyin."}
            </DialogDescription>
          </DialogHeader>
          {editingCategory && (
            <div className="grid gap-4 py-4">
              {dialogMode === "create" ? (
                <div className="grid gap-2">
                  <Label htmlFor="slug" className="text-zinc-700 dark:text-zinc-300">
                    Slug
                  </Label>
                  <Select
                    value={editingCategory.slug}
                    onValueChange={(value) => {
                      const slug = value as ProductCategorySlug;
                      const config = categoryConfig[slug];
                      setEditingCategory({
                        ...editingCategory,
                        slug,
                        name: config.name,
                        description: config.description,
                      });
                    }}
                  >
                    <SelectTrigger className="bg-zinc-100 dark:bg-zinc-800 border-zinc-300 dark:border-zinc-700 text-zinc-900 dark:text-white">
                      <SelectValue placeholder="Kategori slug seçin" />
                    </SelectTrigger>
                    <SelectContent className="bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800">
                      {availableSlugOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label} ({option.value})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ) : (
                <div className="grid gap-2">
                  <Label htmlFor="slug" className="text-zinc-700 dark:text-zinc-300">
                    Slug
                  </Label>
                  <Input
                    id="slug"
                    value={editingCategory.slug}
                    disabled
                    className="bg-zinc-200 dark:bg-zinc-800 border-zinc-300 dark:border-zinc-700 text-zinc-500"
                  />
                  <p className="text-xs text-zinc-500">Slug değiştirilemez.</p>
                </div>
              )}

              <div className="grid gap-2">
                <Label htmlFor="name" className="text-zinc-700 dark:text-zinc-300">
                  Kategori Adı
                </Label>
                <Input
                  id="name"
                  value={editingCategory.name}
                  onChange={(e) =>
                    setEditingCategory({
                      ...editingCategory,
                      name: e.target.value,
                    })
                  }
                  className="bg-zinc-100 dark:bg-zinc-800 border-zinc-300 dark:border-zinc-700 text-zinc-900 dark:text-white"
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="description" className="text-zinc-700 dark:text-zinc-300">
                  Açıklama
                </Label>
                <Textarea
                  id="description"
                  value={editingCategory.description}
                  onChange={(e) =>
                    setEditingCategory({
                      ...editingCategory,
                      description: e.target.value,
                    })
                  }
                  className="bg-zinc-100 dark:bg-zinc-800 border-zinc-300 dark:border-zinc-700 text-zinc-900 dark:text-white resize-none"
                  rows={3}
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="displayOrder" className="text-zinc-700 dark:text-zinc-300">
                  Sıralama
                </Label>
                <Input
                  id="displayOrder"
                  type="number"
                  min={0}
                  value={editingCategory.displayOrder}
                  onChange={(e) =>
                    setEditingCategory({
                      ...editingCategory,
                      displayOrder: parseInt(e.target.value, 10) || 0,
                    })
                  }
                  className="bg-zinc-100 dark:bg-zinc-800 border-zinc-300 dark:border-zinc-700 text-zinc-900 dark:text-white"
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
                  checked={editingCategory.isActive}
                  onCheckedChange={(checked) =>
                    setEditingCategory({
                      ...editingCategory,
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
              onClick={closeDialog}
              className="border-zinc-300 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800"
            >
              İptal
            </Button>
            <Button onClick={handleSaveCategory} className="bg-primary hover:bg-primary/90">
              {dialogMode === "create" ? "Oluştur" : "Kaydet"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
