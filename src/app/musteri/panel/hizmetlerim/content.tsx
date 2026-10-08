"use client";

import Link from "next/link";
import { ArrowUpDown, Cloud, ExternalLink, Mail, Package, Plus, RefreshCcw, Server, Settings, Shield } from "lucide-react";
import {
  DataTable,
  EmptyState,
  IconTile,
  ListRow,
  PageHeader,
  StatCard,
  StatGrid,
  StatusBadge,
  appButton,
  getStatusOptions,
  type ColumnDef,
  type RowAction,
} from "@/components/app";
import { formatTRY } from "@/lib/format/price";
import { billingPeriodUnit, formatDate } from "@/lib/format/date";

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

const P = "/musteri/panel/hizmetlerim";
const money = (n: number) => formatTRY(n, { keepDecimals: true });

function CategoryIcon({ slug }: { slug: string }) {
  const Icon = categoryIcons[slug] || Package;
  return (
    <IconTile size="sm">
      <Icon />
    </IconTile>
  );
}

const columns: ColumnDef<ServiceItem>[] = [
  {
    id: "product",
    accessorFn: (s) => s.product.name,
    header: "Hizmet",
    cell: ({ row }) => {
      const s = row.original;
      return (
        <div className="flex min-w-0 items-center gap-3">
          <CategoryIcon slug={s.product.category.slug} />
          <div className="min-w-0">
            <Link href={`${P}/${s.id}`} className="font-medium hover:underline">
              {s.product.name}
            </Link>
            <p className="max-w-[280px] truncate text-xs text-muted-foreground">{s.domain || s.label || "—"}</p>
          </div>
        </div>
      );
    },
  },
  {
    id: "category",
    accessorFn: (s) => s.product.category.name,
    header: "Kategori",
    cell: ({ row }) => <span className="text-muted-foreground">{row.original.product.category.name}</span>,
  },
  {
    id: "nextDueDate",
    accessorFn: (s) => s.nextDueDate ?? "",
    header: "Bitiş",
    cell: ({ row }) => <span className="tabular-nums">{formatDate(row.original.nextDueDate)}</span>,
  },
  {
    accessorKey: "amount",
    header: "Tutar",
    meta: { align: "right" },
    cell: ({ row }) => (
      <span className="whitespace-nowrap tabular-nums">
        {money(row.original.amount)}
        <span className="text-muted-foreground"> / {billingPeriodUnit(row.original.billingPeriod)}</span>
      </span>
    ),
  },
  {
    accessorKey: "status",
    header: "Durum",
    enableSorting: false,
    cell: ({ row }) => <StatusBadge kind="service" status={row.original.status} />,
  },
];

function rowActions(s: ServiceItem): RowAction[] {
  const actions: RowAction[] = [
    { label: "Yönet", href: `${P}/${s.id}`, icon: <Settings aria-hidden /> },
    { label: "Yenile", href: `${P}/${s.id}/yenile`, icon: <RefreshCcw aria-hidden /> },
  ];
  if (s.status === "ACTIVE") {
    actions.push({ label: "Paket değiştir", href: `${P}/${s.id}/yukselt`, icon: <ArrowUpDown aria-hidden /> });
  }
  if (s.product.category.slug === "hosting") {
    actions.push({ label: "cPanel", icon: <ExternalLink aria-hidden />, disabledReason: "Yakında", separator: true });
  }
  return actions;
}

export function HizmetlerimContent({ services }: HizmetlerimContentProps) {
  const stats = {
    total: services.length,
    active: services.filter((s) => s.status === "ACTIVE").length,
    expired: services.filter((s) => s.status === "EXPIRED").length,
    suspended: services.filter((s) => s.status === "SUSPENDED").length,
  };

  const usedCategories = new Set(services.map((s) => s.product.category.slug));
  const categoryOptions = filterOptions.filter((o) => usedCategories.has(o.value));

  return (
    <>
      <PageHeader
        title="Hizmetlerim"
        description="Hosting, sunucu, SSL ve diğer hizmetlerinizi görüntüleyin ve yönetin."
        actions={
          <Link href="/hosting/linux" className={appButton()}>
            <Plus aria-hidden />
            Yeni hizmet al
          </Link>
        }
      />

      <StatGrid>
        <StatCard label="Toplam" value={stats.total} hint="Tüm hizmetleriniz" />
        <StatCard label="Aktif" value={stats.active} tone={stats.active ? "success" : undefined} hint="Çalışan hizmetler" />
        <StatCard
          label="Askıda"
          value={stats.suspended}
          tone={stats.suspended ? "warning" : undefined}
          hint={stats.suspended ? "Ödeme bekleyen hizmetler" : "Askıda hizmet yok"}
        />
        <StatCard
          label="Süresi doldu"
          value={stats.expired}
          tone={stats.expired ? "danger" : undefined}
          hint={stats.expired ? "Yenileme gerektirir" : "Süresi dolan hizmet yok"}
        />
      </StatGrid>

      <DataTable
        caption="Hizmetler"
        columns={columns}
        data={services}
        initialSort={[{ id: "nextDueDate", desc: false }]}
        searchFn={(s, q) =>
          s.product.name.toLocaleLowerCase("tr-TR").includes(q) ||
          (s.domain || "").toLocaleLowerCase("tr-TR").includes(q) ||
          s.label.toLocaleLowerCase("tr-TR").includes(q)
        }
        searchPlaceholder="Hizmet veya alan adı ara…"
        filters={[
          ...(categoryOptions.length > 1
            ? [
                {
                  id: "category",
                  label: "Kategori",
                  options: categoryOptions,
                  getValue: (s: ServiceItem) => s.product.category.slug,
                },
              ]
            : []),
          {
            id: "status",
            label: "Durum",
            variant: "select" as const,
            options: getStatusOptions("service"),
            getValue: (s: ServiceItem) => s.status,
          },
        ]}
        rowHref={(s) => `${P}/${s.id}`}
        rowActions={rowActions}
        mobileCard={(s) => (
          <ListRow
            leading={<CategoryIcon slug={s.product.category.slug} />}
            title={s.product.name}
            subtitle={s.domain || s.label || "—"}
            trailing={<StatusBadge kind="service" status={s.status} />}
            meta={
              <>
                <span className="tabular-nums">
                  {money(s.amount)} / {billingPeriodUnit(s.billingPeriod)}
                </span>
                <span>Bitiş {formatDate(s.nextDueDate)}</span>
              </>
            }
          />
        )}
        emptyState={
          <EmptyState
            icon={Package}
            title="Henüz hizmetiniz yok"
            description="Hosting, sunucu veya SSL paketlerinden birini seçerek başlayabilirsiniz."
            action={
              <Link href="/hosting/linux" className={appButton()}>
                Hizmetleri incele
              </Link>
            }
          />
        }
        noResultsText="Aramanızla eşleşen hizmet bulunamadı."
      />
    </>
  );
}
