"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Edit, Eye, EyeOff, Layers, Package, Plus, Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
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
  IconTile,
  ListRow,
  PageHeader,
  StatCard,
  StatGrid,
  StatusBadge,
  appButton,
  type ColumnDef,
} from "@/components/app";
import { CatalogDialog, OrderControls, SwitchField } from "@/components/admin-b/katalog";
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
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<DialogMode>("edit");
  const [editingCategory, setEditingCategory] = useState<CategoryData | null>(null);

  const sortedCategories = useMemo(
    () => [...categories].sort((a, b) => a.displayOrder - b.displayOrder),
    [categories]
  );

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
  const lastIndex = sortedCategories.length - 1;
  const indexOf = (id: string) => sortedCategories.findIndex((cat) => cat.id === id);

  const productsHref = (slug: string) => `/yonetim/urunler/paketler?kategori=${slug}`;

  const renderOrder = (category: CategoryData) => {
    const index = indexOf(category.id);
    return (
      <OrderControls
        value={category.displayOrder}
        itemLabel={category.name}
        onUp={() => handleMove(category.id, "up")}
        onDown={() => handleMove(category.id, "down")}
        upDisabled={index <= 0}
        downDisabled={index === -1 || index === lastIndex}
      />
    );
  };

  const renderIcon = (category: CategoryData) => {
    const Icon = categoryConfig[category.slug as keyof typeof categoryConfig]?.icon ?? Layers;
    return (
      <IconTile size="sm">
        <Icon />
      </IconTile>
    );
  };

  const statusBadge = (category: CategoryData) =>
    category.isActive ? <StatusBadge tone="success" label="Aktif" /> : <StatusBadge tone="muted" label="Pasif" />;

  const columns: ColumnDef<CategoryData>[] = [
    {
      id: "order",
      accessorFn: (c) => c.displayOrder,
      header: "Sıra",
      enableSorting: false,
      meta: { className: "w-px" },
      cell: ({ row }) => renderOrder(row.original),
    },
    {
      accessorKey: "name",
      header: "Kategori",
      enableSorting: false,
      cell: ({ row }) => {
        const c = row.original;
        return (
          <div className="flex min-w-0 items-center gap-3">
            {renderIcon(c)}
            <div className="min-w-0">
              <p className="truncate font-medium">{c.name}</p>
              <p className="font-mono text-xs text-muted-foreground">{c.slug}</p>
            </div>
          </div>
        );
      },
    },
    {
      accessorKey: "description",
      header: "Açıklama",
      enableSorting: false,
      cell: ({ row }) => (
        <p className="max-w-xs truncate text-muted-foreground" title={row.original.description}>
          {row.original.description || "—"}
        </p>
      ),
    },
    {
      accessorKey: "productCount",
      header: "Ürün",
      enableSorting: false,
      meta: { align: "right" },
      cell: ({ row }) => (
        <Link
          href={productsHref(row.original.slug)}
          className="inline-flex items-center gap-1.5 tabular-nums underline-offset-4 hover:underline"
          aria-label={`${row.original.name}: ${row.original.productCount} ürünü görüntüle`}
        >
          <Package aria-hidden className="size-3.5 text-muted-foreground" />
          {row.original.productCount}
        </Link>
      ),
    },
    {
      id: "status",
      header: "Durum",
      enableSorting: false,
      cell: ({ row }) => {
        const c = row.original;
        return (
          <div className="flex items-center gap-3">
            <Switch
              checked={c.isActive}
              onCheckedChange={() => handleToggleActive(c.id)}
              aria-label={`${c.name} kategorisini ${c.isActive ? "pasife al" : "aktif et"}`}
            />
            {statusBadge(c)}
          </div>
        );
      },
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Kategoriler"
        description="Ürün kategorilerini, sıralarını ve görünürlüklerini yönetin."
        actions={
          <button
            type="button"
            className={appButton()}
            onClick={handleNewCategory}
            disabled={availableSlugOptions.length === 0}
            title={availableSlugOptions.length === 0 ? "Eklenebilir yeni kategori kalmadı" : undefined}
          >
            <Plus aria-hidden />
            Kategori ekle
          </button>
        }
      />

      <StatGrid columns={3} className="grid-cols-1 sm:grid-cols-3">
        <StatCard label="Toplam kategori" value={categories.length} icon={Layers} />
        <StatCard
          label="Aktif kategori"
          value={activeCount}
          icon={Eye}
          hint={
            categories.length > 0
              ? `%${Math.round((activeCount / categories.length) * 100)} yayında`
              : "Henüz kategori yok"
          }
        />
        <StatCard label="Toplam ürün" value={totalProducts} icon={Package} hint="Tüm kategorilerde" />
      </StatGrid>

      <DataTable
        caption="Kategoriler"
        columns={columns}
        data={sortedCategories}
        getRowId={(c) => c.id}
        pageSize={0}
        searchFn={(c, q) =>
          c.name.toLocaleLowerCase("tr-TR").includes(q) ||
          c.slug.toLocaleLowerCase("tr-TR").includes(q) ||
          c.description.toLocaleLowerCase("tr-TR").includes(q)
        }
        searchPlaceholder="Kategori adı, slug veya açıklama ara…"
        noResultsText="Aramanızla eşleşen kategori bulunamadı."
        rowActions={(c) => [
          { label: "Düzenle", icon: <Edit aria-hidden />, onSelect: () => handleEditCategory(c) },
          { label: "Ürünleri gör", icon: <Package aria-hidden />, href: productsHref(c.slug) },
          {
            label: c.isActive ? "Pasif yap" : "Aktif yap",
            icon: c.isActive ? <EyeOff aria-hidden /> : <Eye aria-hidden />,
            onSelect: () => handleToggleActive(c.id),
            separator: true,
          },
          {
            label: "Sil",
            icon: <Trash2 aria-hidden />,
            destructive: true,
            separator: true,
            ...(c.productCount > 0
              ? { disabledReason: "Önce bu kategoriye bağlı ürünleri kaldırın" }
              : { onSelect: () => handleDeleteCategory(c) }),
          },
        ]}
        mobileCard={(c) => (
          <ListRow
            leading={renderIcon(c)}
            title={c.name}
            subtitle={<span className="font-mono text-xs">{c.slug}</span>}
            trailing={
              <span className="inline-flex items-center gap-1 text-muted-foreground">
                <Package aria-hidden className="size-3.5" />
                {c.productCount}
              </span>
            }
            meta={
              <>
                {statusBadge(c)}
                {renderOrder(c)}
              </>
            }
          />
        )}
        emptyState={
          <EmptyState
            icon={Layers}
            title="Henüz kategori yok"
            description="İlk ürün kategorinizi ekleyerek başlayın."
            action={
              <button type="button" className={appButton()} onClick={handleNewCategory}>
                <Plus aria-hidden />
                Kategori ekle
              </button>
            }
          />
        }
      />

      <CatalogDialog
        open={dialogOpen}
        onOpenChange={(open) => {
          if (!open) {
            closeDialog();
            return;
          }
          setDialogOpen(open);
        }}
        title={dialogMode === "create" ? "Kategori ekle" : "Kategoriyi düzenle"}
        description={
          dialogMode === "create" ? "Yeni kategori bilgilerini girin." : "Kategori bilgilerini güncelleyin."
        }
        footer={
          <>
            <button type="button" className={appButton({ variant: "outline" })} onClick={closeDialog}>
              İptal
            </button>
            <button type="button" className={appButton()} onClick={handleSaveCategory}>
              {dialogMode === "create" ? "Oluştur" : "Kaydet"}
            </button>
          </>
        }
      >
        {editingCategory ? (
          <>
            {dialogMode === "create" ? (
              <FormField label="Slug" htmlFor="slug" hint="Kategori türünü belirler; sonradan değiştirilemez.">
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
                  <SelectTrigger id="slug">
                    <SelectValue placeholder="Kategori slug seçin" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableSlugOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label} ({option.value})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormField>
            ) : (
              <FormField label="Slug" htmlFor="slug" hint="Slug değiştirilemez.">
                <Input id="slug" value={editingCategory.slug} disabled className="font-mono" />
              </FormField>
            )}

            <FormField label="Kategori adı" htmlFor="name" required>
              <Input
                id="name"
                value={editingCategory.name}
                onChange={(e) => setEditingCategory({ ...editingCategory, name: e.target.value })}
              />
            </FormField>

            <FormField label="Açıklama" htmlFor="description">
              <Textarea
                id="description"
                value={editingCategory.description}
                onChange={(e) => setEditingCategory({ ...editingCategory, description: e.target.value })}
                className="resize-none"
                rows={3}
              />
            </FormField>

            <FormField label="Sıralama" htmlFor="displayOrder" hint="Küçük sayı listede önce gösterilir.">
              <Input
                id="displayOrder"
                type="number"
                inputMode="numeric"
                min={0}
                value={editingCategory.displayOrder}
                onChange={(e) =>
                  setEditingCategory({ ...editingCategory, displayOrder: parseInt(e.target.value, 10) || 0 })
                }
                className="sm:max-w-[160px]"
              />
            </FormField>

            <SwitchField
              id="isActive"
              label="Aktif"
              description="Pasif kategoriler sitede ve sipariş akışında gösterilmez."
              checked={editingCategory.isActive}
              onCheckedChange={(checked) => setEditingCategory({ ...editingCategory, isActive: checked })}
            />
          </>
        ) : null}
      </CatalogDialog>
    </div>
  );
}
