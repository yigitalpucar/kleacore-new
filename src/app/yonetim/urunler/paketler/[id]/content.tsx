"use client";

import Link from "next/link";
import { Archive, Check, Copy, Edit, ExternalLink, Package } from "lucide-react";
import {
  DataTable,
  DetailList,
  EmptyState,
  ListRow,
  PageHeader,
  RowActionsMenu,
  SectionCard,
  StatCard,
  StatGrid,
  StatusBadge,
  appButton,
  type ColumnDef,
} from "@/components/app";
import { billingPeriodConfig } from "@/lib/products/constants";
import { formatTRY } from "@/lib/format/price";
import { formatDateTime } from "@/lib/format/date";

/** Stored feature rows come in two shapes: the editor's `featureName/displayValue` and the seed's `label/value`. */
interface ProductFeatureValue {
  featureId?: string;
  featureName?: string;
  label?: string;
  value?: string | number;
  displayValue?: string;
  isUnlimited?: boolean;
}

const featureLabel = (f: ProductFeatureValue) => f.featureName ?? f.label ?? f.featureId ?? "—";
const featureValue = (f: ProductFeatureValue) =>
  f.isUnlimited ? "Sınırsız" : (f.displayValue ?? (f.value !== undefined ? String(f.value) : ""));

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

type Tier = ProductWithRelations["pricingTiers"][number];

const money = (n: number) => formatTRY(n, { keepDecimals: true });
const periodConf = (period: string) => billingPeriodConfig[period as keyof typeof billingPeriodConfig];
const periodLabel = (period: string) => periodConf(period)?.label ?? period;
const monthlyOf = (tier: Tier) => {
  const conf = periodConf(tier.period);
  return conf ? tier.price / conf.months : tier.price;
};

const tierColumns: ColumnDef<Tier>[] = [
  {
    id: "period",
    accessorFn: (t) => periodConf(t.period)?.months ?? 0,
    header: "Dönem",
    cell: ({ row }) => {
      const t = row.original;
      const conf = periodConf(t.period);
      return (
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-medium">{periodLabel(t.period)}</span>
          {t.isDefault ? (
            <span className="rounded-full border px-2 py-0.5 text-[11px] font-medium">Varsayılan</span>
          ) : null}
          {conf && conf.discount > 0 ? (
            <span className="font-mono text-[11px] text-muted-foreground">%{conf.discount} indirim</span>
          ) : null}
        </div>
      );
    },
  },
  {
    accessorKey: "price",
    header: "Fiyat",
    meta: { align: "right" },
    cell: ({ row }) => <span className="font-medium tabular-nums">{money(row.original.price)}</span>,
  },
  {
    id: "monthly",
    accessorFn: monthlyOf,
    header: "Aylık karşılığı",
    meta: { align: "right" },
    cell: ({ row }) => (
      <span className="tabular-nums text-muted-foreground">{money(monthlyOf(row.original))}/ay</span>
    ),
  },
  {
    accessorKey: "setupFee",
    header: "Kurulum",
    meta: { align: "right" },
    cell: ({ row }) => (
      <span className="tabular-nums text-muted-foreground">
        {row.original.setupFee > 0 ? money(row.original.setupFee) : "Ücretsiz"}
      </span>
    ),
  },
  {
    accessorKey: "renewalPrice",
    header: "Yenileme",
    meta: { align: "right" },
    cell: ({ row }) => <span className="tabular-nums text-muted-foreground">{money(row.original.renewalPrice)}</span>,
  },
  {
    accessorKey: "isActive",
    header: "Durum",
    enableSorting: false,
    cell: ({ row }) => (
      <StatusBadge
        tone={row.original.isActive ? "success" : "muted"}
        label={row.original.isActive ? "Aktif" : "Pasif"}
      />
    ),
  },
];

interface PackageDetailContentProps {
  product: ProductWithRelations;
}

export function PackageDetailContent({ product }: PackageDetailContentProps) {
  const features = (Array.isArray(product.features) ? product.features : []).filter(
    (f): f is ProductFeatureValue => !!f && typeof f === "object"
  ) as ProductFeatureValue[];
  const includedFeatures = (Array.isArray(product.includedFeatures) ? product.includedFeatures : []) as string[];
  const editHref = `/yonetim/urunler/paketler/${product.id}/duzenle`;

  const defaultTier = product.pricingTiers.find((t) => t.isDefault) ?? product.pricingTiers[0];
  const activeTierCount = product.pricingTiers.filter((t) => t.isActive).length;

  return (
    <>
      <PageHeader
        back={{ href: "/yonetim/urunler/paketler", label: "Paketler" }}
        eyebrow={<span className="normal-case tracking-normal">{product.sku}</span>}
        title={product.name}
        description={product.shortDescription || undefined}
        meta={
          <>
            <StatusBadge kind="product" status={product.status} />
            {!product.isVisible ? <StatusBadge tone="muted" label="Gizli" /> : null}
            <span>{product.category.name}</span>
            {product.badge ? (
              <span className="rounded-full border px-2 py-0.5 font-mono text-[11px] uppercase tracking-[0.12em]">
                {product.badge}
              </span>
            ) : null}
          </>
        }
        actions={
          <>
            <Link href={editHref} className={appButton({ variant: "outline" })}>
              <Edit aria-hidden />
              Düzenle
            </Link>
            <RowActionsMenu
              label="Diğer işlemler"
              actions={[
                { label: "Kopyala", icon: <Copy aria-hidden />, disabledReason: "Yakında" },
                { label: "Sitede görüntüle", icon: <ExternalLink aria-hidden />, disabledReason: "Yakında" },
                {
                  label: "Arşivle",
                  icon: <Archive aria-hidden />,
                  disabledReason: "Paket listesinden arşivleyin",
                  separator: true,
                },
              ]}
            />
          </>
        }
      />

      <StatGrid columns={3} className="grid-cols-1 sm:grid-cols-3">
        <StatCard
          label="Taban fiyat"
          value={money(product.basePrice)}
          hint={defaultTier ? `${periodLabel(defaultTier.period)} varsayılan dönem` : "Fiyat dönemi yok"}
        />
        <StatCard
          label="Fiyat dönemleri"
          value={product.pricingTiers.length}
          hint={`${activeTierCount} aktif dönem`}
        />
        <StatCard
          label="Stok"
          value={product.stockQuantity === -1 ? "Sınırsız" : `${product.stockQuantity} adet`}
          hint={product.isInStock ? "Satışta" : "Stokta yok"}
          tone={product.isInStock ? undefined : "warning"}
        />
      </StatGrid>

      <div className="grid items-start gap-6 lg:grid-cols-3">
        <div className="min-w-0 space-y-6 lg:col-span-2">
          <SectionCard title="Açıklama">
            {product.shortDescription || product.longDescription ? (
              <div className="space-y-3 text-sm">
                {product.shortDescription ? <p>{product.shortDescription}</p> : null}
                {product.longDescription ? (
                  <p className="whitespace-pre-line text-muted-foreground">{product.longDescription}</p>
                ) : null}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Açıklama girilmemiş.</p>
            )}
          </SectionCard>

          <SectionCard
            title="Fiyat tablosu"
            description="Farklı faturalama dönemleri için fiyatlandırma."
            flush
            actions={
              <Link href={editHref} className={appButton({ variant: "ghost", size: "sm" })}>
                Düzenle
              </Link>
            }
          >
            <DataTable
              framed={false}
              caption="Fiyat dönemleri"
              columns={tierColumns}
              data={product.pricingTiers}
              pageSize={0}
              initialSort={[{ id: "period", desc: false }]}
              emptyState={
                <div className="p-4">
                  <EmptyState compact title="Henüz fiyatlandırma tanımlanmadı" />
                </div>
              }
              mobileCard={(t) => (
                <ListRow
                  title={
                    <span className="flex items-center gap-2">
                      {periodLabel(t.period)}
                      {t.isDefault ? (
                        <span className="rounded-full border px-2 py-0.5 text-[11px] font-medium">Varsayılan</span>
                      ) : null}
                    </span>
                  }
                  subtitle={`Kurulum ${t.setupFee > 0 ? money(t.setupFee) : "ücretsiz"} · Yenileme ${money(t.renewalPrice)}`}
                  trailing={<span className="font-medium tabular-nums">{money(t.price)}</span>}
                  meta={
                    <StatusBadge tone={t.isActive ? "success" : "muted"} label={t.isActive ? "Aktif" : "Pasif"} />
                  }
                />
              )}
            />
          </SectionCard>

          <SectionCard title="Dahil özellikler">
            {includedFeatures.length > 0 ? (
              <ul className="grid gap-2 sm:grid-cols-2">
                {includedFeatures.map((feature, index) => (
                  <li key={index} className="flex items-start gap-2 text-sm">
                    <Check aria-hidden className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                    {feature}
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState compact title="Dahil özellik eklenmemiş" />
            )}
          </SectionCard>
        </div>

        <div className="min-w-0 space-y-6">
          <SectionCard title="Paket özellikleri" description="Paket kartında gösterilen değerler.">
            {features.length > 0 ? (
              <DetailList
                items={features.map((f) => ({ label: featureLabel(f), value: featureValue(f) }))}
              />
            ) : (
              <EmptyState compact icon={Package} title="Henüz özellik tanımlanmadı" />
            )}
          </SectionCard>

          <SectionCard title="Detaylar">
            <DetailList
              items={[
                { label: "Slug", value: product.slug, mono: true, copy: product.slug },
                { label: "Kategori", value: product.category.name },
                { label: "Popüler", value: product.isPopular ? "Evet" : "Hayır" },
                { label: "Sitede görünür", value: product.isVisible ? "Evet" : "Hayır" },
                { label: "Sıralama", value: String(product.displayOrder) },
                { label: "Meta başlık", value: product.metaTitle ?? "" },
                { label: "Oluşturulma", value: formatDateTime(product.createdAt) },
                { label: "Son güncelleme", value: formatDateTime(product.updatedAt) },
              ]}
            />
          </SectionCard>
        </div>
      </div>
    </>
  );
}
