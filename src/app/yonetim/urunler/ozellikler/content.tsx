"use client";

import { useState } from "react";
import { CheckCircle, Edit, Eye, EyeOff, Plus, Star, Tag, Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DataTable,
  EmptyState,
  FormField,
  ListRow,
  PageHeader,
  StatCard,
  StatGrid,
  StatusBadge,
  appButton,
  type ColumnDef,
} from "@/components/app";
import { CatalogDialog, OrderControls, SwitchField } from "@/components/admin-b/katalog";
import { cn } from "@/lib/utils";
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
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingFeature, setEditingFeature] = useState<ProductFeatureData | null>(null);

  const filteredFeatures = features
    .filter((feature) => categoryFilter === "all" || feature.categoryId === categoryFilter)
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

  const categoryName = (slug: ProductCategorySlug) =>
    categoryConfig[slug as keyof typeof categoryConfig]?.name ?? slug;

  const siblingsOf = (feature: ProductFeatureData) =>
    features
      .filter((item) => item.categoryId === feature.categoryId)
      .sort((a, b) => a.displayOrder - b.displayOrder);

  const renderOrder = (feature: ProductFeatureData) => {
    const siblings = siblingsOf(feature);
    const index = siblings.findIndex((item) => item.id === feature.id);
    return (
      <OrderControls
        value={feature.displayOrder}
        itemLabel={feature.name}
        onUp={() => handleMoveFeature(feature.id, "up")}
        onDown={() => handleMoveFeature(feature.id, "down")}
        upDisabled={index <= 0}
        downDisabled={index === -1 || index >= siblings.length - 1}
      />
    );
  };

  const renderStar = (feature: ProductFeatureData) => (
    <button
      type="button"
      onClick={() => handleToggleHighlighted(feature.id)}
      aria-pressed={feature.isHighlighted}
      aria-label={`${feature.name}: ${feature.isHighlighted ? "öne çıkarmayı kaldır" : "öne çıkar"}`}
      className={appButton({
        variant: "ghost",
        size: "icon-sm",
        className: feature.isHighlighted ? "text-foreground" : "text-muted-foreground/60 hover:text-foreground",
      })}
    >
      <Star aria-hidden className={cn(feature.isHighlighted && "fill-current")} />
    </button>
  );

  const statusBadge = (feature: ProductFeatureData) =>
    feature.isActive ? <StatusBadge tone="success" label="Aktif" /> : <StatusBadge tone="muted" label="Pasif" />;

  const columns: ColumnDef<ProductFeatureData>[] = [
    {
      id: "order",
      header: "Sıra",
      enableSorting: false,
      meta: { className: "w-px" },
      cell: ({ row }) => renderOrder(row.original),
    },
    {
      accessorKey: "name",
      header: "Özellik",
      enableSorting: false,
      cell: ({ row }) => (
        <div className="min-w-0">
          <p className="truncate font-medium">{row.original.name}</p>
          <p className="font-mono text-xs text-muted-foreground">{row.original.slug}</p>
        </div>
      ),
    },
    {
      accessorKey: "categoryId",
      header: "Kategori",
      enableSorting: false,
      cell: ({ row }) => <span className="text-muted-foreground">{categoryName(row.original.categoryId)}</span>,
    },
    {
      accessorKey: "unit",
      header: "Birim",
      enableSorting: false,
      cell: ({ row }) =>
        row.original.unit ? (
          <span className="rounded border bg-muted/40 px-1.5 py-0.5 font-mono text-xs">{row.original.unit}</span>
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
    {
      id: "highlighted",
      header: "Öne çıkan",
      enableSorting: false,
      meta: { align: "center" },
      cell: ({ row }) => renderStar(row.original),
    },
    {
      id: "status",
      header: "Durum",
      enableSorting: false,
      cell: ({ row }) => {
        const f = row.original;
        return (
          <div className="flex items-center gap-3">
            <Switch
              checked={f.isActive}
              onCheckedChange={() => handleToggleActive(f.id)}
              aria-label={`${f.name} özelliğini ${f.isActive ? "pasife al" : "aktif et"}`}
            />
            {statusBadge(f)}
          </div>
        );
      },
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Özellikler"
        description="Paket karşılaştırmalarında kullanılan ürün özelliklerini tanımlayın ve sıralayın."
        actions={
          <button type="button" className={appButton()} onClick={handleNewFeature}>
            <Plus aria-hidden />
            Özellik ekle
          </button>
        }
      />

      <StatGrid columns={3} className="grid-cols-1 sm:grid-cols-3">
        <StatCard label="Toplam özellik" value={features.length} icon={Tag} hint="Tüm kategorilerde" />
        <StatCard
          label="Aktif özellik"
          value={activeCount}
          icon={CheckCircle}
          hint={
            features.length > 0
              ? `%${Math.round((activeCount / features.length) * 100)} aktif`
              : "Henüz özellik yok"
          }
        />
        <StatCard label="Öne çıkan" value={highlightedCount} icon={Star} hint="Paket kartlarında vurgulanır" />
      </StatGrid>

      <DataTable
        caption="Ürün özellikleri"
        columns={columns}
        data={filteredFeatures}
        getRowId={(f) => f.id}
        pageSize={20}
        searchFn={(f, q) =>
          f.name.toLocaleLowerCase("tr-TR").includes(q) || f.slug.toLocaleLowerCase("tr-TR").includes(q)
        }
        searchPlaceholder="Özellik adı veya slug ara…"
        noResultsText="Aramanızla eşleşen özellik bulunamadı."
        toolbar={
          <Select value={categoryFilter} onValueChange={(value) => setCategoryFilter(value as CategoryFilter)}>
            <SelectTrigger aria-label="Kategoriye göre filtrele" className="h-11 w-full sm:w-[200px] md:h-9">
              <SelectValue placeholder="Kategori" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tüm kategoriler</SelectItem>
              {categoryOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        }
        rowActions={(f) => [
          { label: "Düzenle", icon: <Edit aria-hidden />, onSelect: () => handleEditFeature(f) },
          {
            label: f.isHighlighted ? "Öne çıkarmayı kaldır" : "Öne çıkar",
            icon: <Star aria-hidden />,
            onSelect: () => handleToggleHighlighted(f.id),
          },
          {
            label: f.isActive ? "Pasif yap" : "Aktif yap",
            icon: f.isActive ? <EyeOff aria-hidden /> : <Eye aria-hidden />,
            onSelect: () => handleToggleActive(f.id),
            separator: true,
          },
          {
            label: "Sil",
            icon: <Trash2 aria-hidden />,
            destructive: true,
            separator: true,
            onSelect: () => handleDeleteFeature(f.id),
          },
        ]}
        mobileCard={(f) => (
          <ListRow
            title={f.name}
            subtitle={
              <>
                {categoryName(f.categoryId)} · <span className="font-mono text-xs">{f.slug}</span>
                {f.unit ? ` · ${f.unit}` : ""}
              </>
            }
            trailing={renderStar(f)}
            meta={
              <>
                {statusBadge(f)}
                {renderOrder(f)}
              </>
            }
          />
        )}
        emptyState={
          <EmptyState
            icon={Tag}
            title={categoryFilter === "all" ? "Henüz özellik yok" : "Bu kategoride özellik yok"}
            description="Disk alanı, bant genişliği gibi paket özelliklerini buradan tanımlayın."
            action={
              <div className="flex flex-wrap justify-center gap-2">
                {categoryFilter !== "all" ? (
                  <button
                    type="button"
                    className={appButton({ variant: "outline" })}
                    onClick={() => setCategoryFilter("all")}
                  >
                    Tüm kategorileri göster
                  </button>
                ) : null}
                <button type="button" className={appButton()} onClick={handleNewFeature}>
                  <Plus aria-hidden />
                  Özellik ekle
                </button>
              </div>
            }
          />
        }
      />

      <CatalogDialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) {
            setEditingFeature(null);
          }
        }}
        title={editingFeature?.id ? "Özelliği düzenle" : "Yeni özellik"}
        description={`Özellik bilgilerini ${editingFeature?.id ? "güncelleyin" : "girin"}.`}
        footer={
          <>
            <button
              type="button"
              className={appButton({ variant: "outline" })}
              onClick={() => {
                setDialogOpen(false);
                setEditingFeature(null);
              }}
            >
              İptal
            </button>
            <button type="button" className={appButton()} onClick={handleSaveFeature}>
              {editingFeature?.id ? "Kaydet" : "Oluştur"}
            </button>
          </>
        }
      >
        {editingFeature ? (
          <>
            <FormField label="Kategori" htmlFor="category">
              <Select
                value={editingFeature.categoryId}
                onValueChange={(value) =>
                  setEditingFeature({ ...editingFeature, categoryId: value as ProductCategorySlug })
                }
              >
                <SelectTrigger id="category">
                  <SelectValue placeholder="Kategori seçin" />
                </SelectTrigger>
                <SelectContent>
                  {categoryOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>
            <div className="grid gap-5 sm:grid-cols-2">
              <FormField label="Özellik adı" htmlFor="name" required>
                <Input
                  id="name"
                  value={editingFeature.name}
                  onChange={(e) => setEditingFeature({ ...editingFeature, name: e.target.value })}
                  placeholder="Örn: Disk Alanı"
                />
              </FormField>
              <FormField label="Slug" htmlFor="slug" required hint="Küçük harf, rakam ve tire.">
                <Input
                  id="slug"
                  value={editingFeature.slug}
                  onChange={(e) => setEditingFeature({ ...editingFeature, slug: e.target.value })}
                  placeholder="Örn: disk-space"
                  className="font-mono"
                />
              </FormField>
            </div>
            <div className="grid gap-5 sm:grid-cols-2">
              <FormField label="Birim" htmlFor="unit">
                <Input
                  id="unit"
                  value={editingFeature.unit}
                  onChange={(e) => setEditingFeature({ ...editingFeature, unit: e.target.value })}
                  placeholder="Örn: GB, Adet"
                />
              </FormField>
              <FormField label="Sıralama" htmlFor="displayOrder">
                <Input
                  id="displayOrder"
                  type="number"
                  inputMode="numeric"
                  value={editingFeature.displayOrder}
                  onChange={(e) =>
                    setEditingFeature({ ...editingFeature, displayOrder: parseInt(e.target.value, 10) || 0 })
                  }
                />
              </FormField>
            </div>
            <div className="space-y-3">
              <SwitchField
                id="isHighlighted"
                label="Öne çıkan özellik"
                description="Paket kartlarında vurgulanarak gösterilir."
                checked={editingFeature.isHighlighted}
                onCheckedChange={(checked) => setEditingFeature({ ...editingFeature, isHighlighted: checked })}
              />
              <SwitchField
                id="isActive"
                label="Aktif"
                checked={editingFeature.isActive}
                onCheckedChange={(checked) => setEditingFeature({ ...editingFeature, isActive: checked })}
              />
            </div>
          </>
        ) : null}
      </CatalogDialog>
    </div>
  );
}
