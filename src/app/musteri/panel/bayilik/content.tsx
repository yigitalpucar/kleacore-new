"use client";

import Link from "next/link";
import { ArrowUpRight, FileText, Globe, Headphones, Package, Users } from "lucide-react";
import {
  DataTable,
  IconTile,
  ListRow,
  PageHeader,
  SectionCard,
  StatCard,
  StatGrid,
  StatusBadge,
  appButton,
  getStatusOptions,
  type ColumnDef,
} from "@/components/app";
import { formatTRY } from "@/lib/format/price";
import { formatDate } from "@/lib/format/date";
import { PanelEmptyState } from "@/components/panel/panel-empty-state";

interface ResellerCustomer {
  id: string;
  name: string;
  email: string;
  status: string;
  registeredAt: string;
  activeServices: number;
  orderCount: number;
}

interface ResellerStats {
  customerCount: number;
  activeServices: number;
  monthlyRevenue: number;
}

interface BayilikContentProps {
  discountPercent: number;
  customers: ResellerCustomer[];
  stats: ResellerStats;
}

const quickLinks = [
  { title: "Hizmetlerim", description: "Bayi hesabınızdaki hizmetler", href: "/musteri/panel/hizmetlerim", icon: Package },
  { title: "Faturalarım", description: "Ödeme ve fatura geçmişi", href: "/musteri/panel/faturalar", icon: FileText },
  { title: "Alan adlarım", description: "Domain portföyünüz", href: "/musteri/panel/domainler", icon: Globe },
  { title: "Destek talepleri", description: "Bayi destek ekibiyle iletişim", href: "/musteri/panel/destek", icon: Headphones },
];

const columns: ColumnDef<ResellerCustomer>[] = [
  {
    accessorKey: "name",
    header: "Müşteri",
    cell: ({ row }) => (
      <div className="min-w-0">
        <p className="font-medium">{row.original.name || "—"}</p>
        <p className="font-mono text-xs text-muted-foreground">{row.original.email}</p>
      </div>
    ),
  },
  {
    id: "registeredAt",
    accessorFn: (r) => r.registeredAt,
    header: "Kayıt",
    cell: ({ row }) => <span className="tabular-nums text-muted-foreground">{formatDate(row.original.registeredAt)}</span>,
  },
  {
    accessorKey: "activeServices",
    header: "Aktif hizmet",
    meta: { align: "right" },
    cell: ({ row }) => <span className="tabular-nums">{row.original.activeServices}</span>,
  },
  {
    accessorKey: "orderCount",
    header: "Sipariş",
    meta: { align: "right" },
    cell: ({ row }) => <span className="tabular-nums">{row.original.orderCount}</span>,
  },
  {
    accessorKey: "status",
    header: "Durum",
    enableSorting: false,
    cell: ({ row }) => <StatusBadge kind="user" status={row.original.status} />,
  },
];

export function BayilikContent({ discountPercent, customers, stats }: BayilikContentProps) {
  return (
    <>
      <PageHeader
        eyebrow="Bayi hesabı"
        title="Bayilik"
        description="Alt müşterilerinizi ve bayi performansınızı takip edin."
        actions={
          <Link href="/musteri/panel/destek/yeni" className={appButton({ variant: "outline" })}>
            <Headphones aria-hidden />
            Destek talebi
          </Link>
        }
      />

      <StatGrid columns={4}>
        <StatCard label="Toptan indirim" value={`%${discountPercent}`} hint="Alt müşteri ödemelerinde uygulanır" />
        <StatCard label="Alt müşteri" icon={Users} value={stats.customerCount} hint="Hesabınıza bağlı müşteriler" />
        <StatCard label="Aktif hizmet" icon={Package} value={stats.activeServices} hint="Alt müşterilerinizdeki" />
        <StatCard
          label="Bu ayki ciro"
          value={formatTRY(stats.monthlyRevenue, { keepDecimals: true })}
          hint="Bu ay ödenen alt müşteri faturaları"
        />
      </StatGrid>

      <DataTable
        caption="Alt müşteriler"
        columns={columns}
        data={customers}
        initialSort={[{ id: "registeredAt", desc: true }]}
        searchFn={(c, q) => c.name.toLocaleLowerCase("tr-TR").includes(q) || c.email.toLocaleLowerCase("tr-TR").includes(q)}
        searchPlaceholder="Müşteri adı veya e-posta ara…"
        filters={[{ id: "status", label: "Durum", options: getStatusOptions("user"), getValue: (c) => c.status }]}
        mobileCard={(c) => (
          <ListRow
            title={c.name || "—"}
            subtitle={<span className="font-mono text-xs">{c.email}</span>}
            trailing={<StatusBadge kind="user" status={c.status} />}
            meta={
              <>
                <span>{c.activeServices} aktif hizmet</span>
                <span>{c.orderCount} sipariş</span>
                <span>Kayıt {formatDate(c.registeredAt)}</span>
              </>
            }
          />
        )}
        emptyState={
          <PanelEmptyState kind="resellerClients" />
        }
        noResultsText="Aramanızla eşleşen müşteri bulunamadı."
      />

      <SectionCard
        title="Hızlı bağlantılar"
        description={`Alt müşterileriniz ödeme yaparken %${discountPercent} bayi indiriminiz otomatik uygulanır.`}
      >
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
          {quickLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="group flex min-h-[60px] items-center gap-3 rounded-md border bg-background px-3 py-2.5 transition-colors hover:border-foreground/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <IconTile size="sm">
                <link.icon />
              </IconTile>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">{link.title}</span>
                <span className="block truncate text-xs text-muted-foreground">{link.description}</span>
              </span>
              <ArrowUpRight aria-hidden className="size-4 shrink-0 text-muted-foreground/60 group-hover:text-foreground" />
            </Link>
          ))}
        </div>
      </SectionCard>
    </>
  );
}
