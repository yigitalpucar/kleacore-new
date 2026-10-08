"use client";

import Link from "next/link";
import { ArrowRightLeft, ExternalLink, Globe, Lock, Plus, RefreshCcw, Settings } from "lucide-react";
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
  type RowAction,
} from "@/components/app";
import { daysUntil, formatDate } from "@/lib/format/date";

interface DomainItem {
  id: string;
  name: string;
  registrar: string;
  status: string;
  autoRenew: boolean;
  privacyEnabled: boolean;
  hasSsl: boolean;
  registeredAt: string;
  expiresAt: string;
  nameservers: string[];
}

interface DomainlerContentProps {
  domains: DomainItem[];
  stats: {
    total: number;
    active: number;
    expiring: number;
  };
}

const P = "/musteri/panel/domainler";

function Flags({ domain }: { domain: DomainItem }) {
  if (!domain.privacyEnabled && !domain.autoRenew) return null;
  return (
    <span className="inline-flex items-center gap-1.5 text-muted-foreground">
      {domain.privacyEnabled ? (
        <span title="Gizlilik koruması açık">
          <Lock aria-hidden className="size-3.5" />
          <span className="sr-only">Gizlilik koruması açık</span>
        </span>
      ) : null}
      {domain.autoRenew ? (
        <span title="Otomatik yenileme açık">
          <RefreshCcw aria-hidden className="size-3.5" />
          <span className="sr-only">Otomatik yenileme açık</span>
        </span>
      ) : null}
    </span>
  );
}

function Expiry({ domain }: { domain: DomainItem }) {
  const days = daysUntil(domain.expiresAt);
  const soon = domain.status === "ACTIVE" && days !== null && days >= 0 && days <= 30;
  return (
    <span className="tabular-nums">
      {formatDate(domain.expiresAt)}
      {soon ? <span className="block text-xs text-amber-600 dark:text-amber-400">{days} gün kaldı</span> : null}
    </span>
  );
}

const columns: ColumnDef<DomainItem>[] = [
  {
    accessorKey: "name",
    header: "Alan adı",
    cell: ({ row }) => (
      <div className="flex min-w-0 items-center gap-2">
        <Link href={`${P}/${row.original.id}`} className="truncate font-medium hover:underline">
          {row.original.name}
        </Link>
        <Flags domain={row.original} />
      </div>
    ),
  },
  {
    id: "registeredAt",
    accessorFn: (d) => d.registeredAt,
    header: "Kayıt",
    cell: ({ row }) => <span className="tabular-nums text-muted-foreground">{formatDate(row.original.registeredAt)}</span>,
  },
  {
    id: "expiresAt",
    accessorFn: (d) => d.expiresAt,
    header: "Bitiş",
    cell: ({ row }) => <Expiry domain={row.original} />,
  },
  {
    accessorKey: "registrar",
    header: "Kayıt firması",
    cell: ({ row }) => <span className="text-muted-foreground">{row.original.registrar}</span>,
  },
  {
    accessorKey: "status",
    header: "Durum",
    enableSorting: false,
    cell: ({ row }) => <StatusBadge kind="domain" status={row.original.status} />,
  },
];

function rowActions(d: DomainItem): RowAction[] {
  return [
    { label: "DNS yönetimi", href: `${P}/${d.id}`, icon: <Settings aria-hidden /> },
    { label: "WHOIS sorgula", href: `/domain/whois?domain=${encodeURIComponent(d.name)}`, icon: <ExternalLink aria-hidden /> },
    { label: "Yenile / otomatik yenileme", href: `${P}/${d.id}`, icon: <RefreshCcw aria-hidden />, separator: true },
    { label: d.privacyEnabled ? "Gizliliği kapat" : "Gizlilik ekle", icon: <Lock aria-hidden />, disabledReason: "Yakında" },
    { label: "Transfer et", icon: <ArrowRightLeft aria-hidden />, disabledReason: "Yakında" },
  ];
}

export function DomainlerContent({ domains, stats }: DomainlerContentProps) {
  return (
    <>
      <PageHeader
        title="Alan adlarım"
        description="Alan adlarınızı, DNS kayıtlarını ve nameserver ayarlarını yönetin."
        actions={
          <>
            <Link href="/domain/transfer" className={appButton({ variant: "outline" })}>
              <ArrowRightLeft aria-hidden />
              Transfer et
            </Link>
            <Link href="/domain/kayit" className={appButton()}>
              <Plus aria-hidden />
              Yeni alan adı
            </Link>
          </>
        }
      />

      <StatGrid columns={3}>
        <StatCard label="Toplam" value={stats.total} hint="Hesabınızdaki alan adları" />
        <StatCard label="Aktif" value={stats.active} tone={stats.active ? "success" : undefined} hint="Kullanımda" />
        <StatCard
          label="Süresi yaklaşan"
          value={stats.expiring}
          tone={stats.expiring ? "warning" : undefined}
          hint={stats.expiring ? "30 gün içinde doluyor" : "30 gün içinde dolan yok"}
          className="col-span-2 lg:col-span-1"
        />
      </StatGrid>

      <DataTable
        caption="Alan adları"
        columns={columns}
        data={domains}
        initialSort={[{ id: "expiresAt", desc: false }]}
        searchFn={(d, q) => d.name.toLocaleLowerCase("tr-TR").includes(q)}
        searchPlaceholder="Alan adı ara…"
        filters={[
          {
            id: "status",
            label: "Durum",
            options: getStatusOptions("domain").filter((o) => domains.some((d) => d.status === o.value)),
            getValue: (d) => d.status,
          },
        ]}
        rowHref={(d) => `${P}/${d.id}`}
        rowActions={rowActions}
        mobileCard={(d) => (
          <ListRow
            title={d.name}
            subtitle={`${d.registrar} · Kayıt ${formatDate(d.registeredAt)}`}
            trailing={<StatusBadge kind="domain" status={d.status} />}
            meta={
              <>
                <span>Bitiş {formatDate(d.expiresAt)}</span>
                <Flags domain={d} />
              </>
            }
          />
        )}
        emptyState={
          <EmptyState
            icon={Globe}
            title="Henüz alan adınız yok"
            description="Yeni bir alan adı kaydedebilir veya mevcut alan adınızı KLEACORE'a taşıyabilirsiniz."
            action={
              <>
                <Link href="/domain/kayit" className={appButton()}>
                  Alan adı sorgula
                </Link>
                <Link href="/domain/transfer" className={appButton({ variant: "outline" })}>
                  Transfer et
                </Link>
              </>
            }
          />
        }
        noResultsText="Aramanızla eşleşen alan adı bulunamadı."
      />
    </>
  );
}
