"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Archive, Copy, Edit, Eye, EyeOff, Package, Plus, Trash2 } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import {
  DataTable,
  EmptyState,
  ListRow,
  PageHeader,
  StatCard,
  StatGrid,
  StatusBadge,
  appButton,
  getStatusOptions,
  type ColumnDef,
} from "@/components/app";
import { cn } from "@/lib/utils";
import { deleteProduct, updateProduct } from "@/lib/actions/admin/products";
import { toast } from "@/lib/toast";
import { billingPeriodConfig, categoryConfig } from "@/lib/products/constants";
import { formatTRY } from "@/lib/format/price";

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

const detailHref = (id: string) => `/yonetim/urunler/paketler/${id}`;
const money = (n: number) => formatTRY(n, { keepDecimals: true });

/** "/ay", "/yıl"… for the default tier, so the base price is never mislabelled. */
function priceUnit(product: ProductData) {
  const tier = product.pricingTiers.find((t) => t.isDefault) ?? product.pricingTiers[0];
  const conf = tier ? billingPeriodConfig[tier.period as keyof typeof billingPeriodConfig] : undefined;
  if (!conf) return null;
  if (conf.months === 1) return "ay";
  if (conf.months === 12) return "yıl";
  return conf.shortLabel.toLocaleLowerCase("tr-TR");
}

function StockCell({ quantity }: { quantity: number }) {
  if (quantity === -1) return <span className="text-muted-foreground">Sınırsız</span>;
  const tone = quantity <= 3 ? "danger" : quantity <= 10 ? "warning" : "success";
  return <StatusBadge tone={tone} label={`${quantity} adet`} />;
}

interface PackagesContentProps {
  data: ProductData[];
  total: number;
  initialCategory: string;
}

export function PackagesContent({ data, total, initialCategory }: PackagesContentProps) {
  const router = useRouter();
  const [visibilityState, setVisibilityState] = useState<Record<string, boolean>>({});
  const [isMutating, setIsMutating] = useState(false);

  const getVisibility = (product: ProductData) => visibilityState[product.id] ?? product.isVisible;

  const handleToggleVisible = async (productId: string, currentVisible: boolean) => {
    if (isMutating) return;
    setIsMutating(true);
    const result = await updateProduct(productId, { isVisible: !currentVisible });
    if (!result.success) {
      toast.error(result.error ?? "Görünürlük güncellenemedi");
      setIsMutating(false);
      return;
    }

    setVisibilityState((prev) => ({ ...prev, [productId]: !currentVisible }));
    toast.success(!currentVisible ? "Paket görünür yapıldı" : "Paket gizlendi");
    setIsMutating(false);
  };

  const handleArchiveProduct = async (productId: string) => {
    if (isMutating) return;
    const approved = window.confirm("Bu paketi arşivlemek istediğinize emin misiniz?");
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
    const approved = window.confirm("Bu paketi silmek istediğinize emin misiniz?");
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

  const activeCount = data.filter((p) => p.status === "ACTIVE").length;
  const draftCount = data.filter((p) => p.status === "DRAFT").length;
  const lowStockCount = data.filter((p) => p.stockQuantity > 0 && p.stockQuantity <= 5).length;

  const columns: ColumnDef<ProductData>[] = [
    {
      accessorKey: "name",
      header: "Paket",
      cell: ({ row }) => {
        const p = row.original;
        return (
          <div className={cn("min-w-0 max-w-[320px]", !getVisibility(p) && "opacity-60")}>
            <div className="flex items-center gap-2">
              <Link href={detailHref(p.id)} className="truncate font-medium hover:underline">
                {p.name}
              </Link>
              {p.badge ? (
                <span className="shrink-0 rounded-full border px-1.5 py-px font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground">
                  {p.badge}
                </span>
              ) : null}
            </div>
            <p className="truncate font-mono text-xs text-muted-foreground">{p.sku}</p>
          </div>
        );
      },
    },
    {
      id: "category",
      accessorFn: (p) => p.category.name,
      header: "Kategori",
      cell: ({ row }) => <span className="text-muted-foreground">{row.original.category.name}</span>,
    },
    {
      accessorKey: "basePrice",
      header: "Fiyat",
      meta: { align: "right" },
      cell: ({ row }) => {
        const unit = priceUnit(row.original);
        return (
          <span className="whitespace-nowrap font-medium tabular-nums">
            {money(row.original.basePrice)}
            {unit ? <span className="font-normal text-muted-foreground"> / {unit}</span> : null}
          </span>
        );
      },
    },
    {
      accessorKey: "stockQuantity",
      header: "Stok",
      cell: ({ row }) => <StockCell quantity={row.original.stockQuantity} />,
    },
    {
      accessorKey: "status",
      header: "Durum",
      enableSorting: false,
      cell: ({ row }) => <StatusBadge kind="product" status={row.original.status} />,
    },
    {
      id: "visible",
      header: "Görünür",
      enableSorting: false,
      cell: ({ row }) => {
        const p = row.original;
        const visible = getVisibility(p);
        return (
          <Switch
            data-no-row-click
            checked={visible}
            disabled={isMutating}
            aria-label={`${p.name} sitede görünür`}
            onCheckedChange={() => {
              void handleToggleVisible(p.id, visible);
            }}
          />
        );
      },
    },
  ];

  return (
    <>
      <PageHeader
        title="Paketler"
        description="Ürün ve paketlerinizi, fiyatlarını ve görünürlüklerini yönetin."
        actions={
          <Link href="/yonetim/urunler/paketler/yeni" className={appButton()}>
            <Plus aria-hidden />
            Yeni paket
          </Link>
        }
      />

      <StatGrid columns={4}>
        <StatCard label="Toplam paket" value={total} hint={`${data.length} paket listeleniyor`} />
        <StatCard
          label="Aktif"
          value={activeCount}
          hint={total > 0 ? `%${((activeCount / total) * 100).toFixed(0)} yayında` : "Paket yok"}
          tone={activeCount ? "success" : undefined}
        />
        <StatCard label="Taslak" value={draftCount} hint="Yayınlanmadı" />
        <StatCard
          label="Düşük stok"
          value={lowStockCount}
          hint="5 adet ve altı"
          tone={lowStockCount ? "warning" : undefined}
        />
      </StatGrid>

      <DataTable
        caption="Paketler"
        columns={columns}
        data={data}
        pageSize={20}
        searchFn={(p, q) =>
          p.name.toLocaleLowerCase("tr-TR").includes(q) ||
          p.sku.toLocaleLowerCase("tr-TR").includes(q) ||
          p.shortDescription.toLocaleLowerCase("tr-TR").includes(q)
        }
        searchPlaceholder="Paket adı, SKU veya açıklama ara…"
        filters={[
          {
            id: "status",
            label: "Durum",
            options: getStatusOptions("product"),
            getValue: (p) => p.status,
          },
          {
            id: "category",
            label: "Kategori",
            variant: "select",
            allLabel: "Tüm kategoriler",
            options: categoryOptions,
            getValue: (p) => p.category.slug,
            defaultValue: initialCategory,
          },
        ]}
        rowHref={(p) => detailHref(p.id)}
        rowActions={(p) => {
          const visible = getVisibility(p);
          return [
            { label: "Detayları gör", href: detailHref(p.id), icon: <Eye aria-hidden /> },
            { label: "Düzenle", href: `${detailHref(p.id)}/duzenle`, icon: <Edit aria-hidden /> },
            { label: "Kopyala", icon: <Copy aria-hidden />, disabledReason: "Yakında" },
            {
              label: visible ? "Gizle" : "Göster",
              icon: visible ? <EyeOff aria-hidden /> : <Eye aria-hidden />,
              onSelect: () => void handleToggleVisible(p.id, visible),
              separator: true,
            },
            {
              label: "Arşivle",
              icon: <Archive aria-hidden />,
              onSelect: () => void handleArchiveProduct(p.id),
              separator: true,
            },
            {
              label: "Sil",
              icon: <Trash2 aria-hidden />,
              destructive: true,
              onSelect: () => void handleDeleteProduct(p.id),
            },
          ];
        }}
        mobileCard={(p) => {
          const unit = priceUnit(p);
          return (
            <ListRow
              title={p.name}
              subtitle={`${p.sku} · ${p.category.name}`}
              trailing={
                <span className="tabular-nums">
                  {money(p.basePrice)}
                  {unit ? <span className="text-muted-foreground"> / {unit}</span> : null}
                </span>
              }
              meta={
                <>
                  <StatusBadge kind="product" status={p.status} />
                  {!getVisibility(p) ? <StatusBadge tone="muted" label="Gizli" /> : null}
                </>
              }
            />
          );
        }}
        emptyState={
          <EmptyState
            icon={Package}
            title="Henüz paket yok"
            description="İlk paketinizi oluşturarak kataloğu doldurmaya başlayın."
            action={
              <Link href="/yonetim/urunler/paketler/yeni" className={appButton()}>
                <Plus aria-hidden />
                Yeni paket
              </Link>
            }
          />
        }
        noResultsText="Arama kriterlerinize uygun paket bulunmuyor."
      />
    </>
  );
}
