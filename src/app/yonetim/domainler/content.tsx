"use client";

import Link from "next/link";
import { Eye, Globe } from "lucide-react";
import {
  DataTable,
  EmptyState,
  ListRow,
  PageHeader,
  StatCard,
  StatGrid,
  StatusBadge,
  getStatusOptions,
  type ColumnDef,
} from "@/components/app";
import { daysUntil, formatDate } from "@/lib/format/date";

interface AdminDomainRow {
  id: string;
  name: string;
  status: string;
  expiresAt: string;
  autoRenew: boolean;
  registrar: string;
  lastSyncedAt: string | null;
  customerName: string;
  customerId: string;
  renewalStatus: string | null;
}

const P = "/yonetim/domainler";

function Expiry({ row }: { row: AdminDomainRow }) {
  const days = daysUntil(row.expiresAt);
  return (
    <span className="tabular-nums">
      {formatDate(row.expiresAt)}
      {days !== null && days <= 30 ? (
        <span className="block text-xs text-muted-foreground">{days >= 0 ? `${days} gün kaldı` : `${-days} gün geçti`}</span>
      ) : null}
    </span>
  );
}

const columns: ColumnDef<AdminDomainRow>[] = [
  {
    accessorKey: "name",
    header: "Alan adı",
    cell: ({ row }) => (
      <Link href={`${P}/${row.original.id}`} className="font-medium hover:underline">
        {row.original.name}
      </Link>
    ),
  },
  {
    accessorKey: "customerName",
    header: "Müşteri",
    cell: ({ row }) => (
      <Link href={`/yonetim/musteriler/${row.original.customerId}`} className="text-muted-foreground hover:underline">
        {row.original.customerName}
      </Link>
    ),
  },
  { id: "expiresAt", accessorFn: (r) => r.expiresAt, header: "Bitiş", cell: ({ row }) => <Expiry row={row.original} /> },
  {
    id: "autoRenew",
    accessorFn: (r) => (r.autoRenew ? 1 : 0),
    header: "Oto. yenileme",
    cell: ({ row }) => <StatusBadge tone={row.original.autoRenew ? "success" : "muted"} label={row.original.autoRenew ? "Açık" : "Kapalı"} />,
  },
  {
    id: "renewal",
    header: "Yenileme",
    enableSorting: false,
    cell: ({ row }) =>
      row.original.renewalStatus ? <StatusBadge kind="domainRenewal" status={row.original.renewalStatus} /> : <span className="text-muted-foreground">—</span>,
  },
  {
    accessorKey: "status",
    header: "Durum",
    enableSorting: false,
    cell: ({ row }) => <StatusBadge kind="domain" status={row.original.status} />,
  },
];

export function AdminDomainsContent({ domains }: { domains: AdminDomainRow[] }) {
  const expiring = domains.filter((d) => {
    const days = daysUntil(d.expiresAt);
    return d.status === "ACTIVE" && days !== null && days >= 0 && days <= 30;
  }).length;
  const failed = domains.filter((d) => d.renewalStatus === "FAILED").length;

  return (
    <>
      <PageHeader title="Alan adları" description="Bitiş tarihleri, yenileme durumu ve registrar senkronu." />

      <StatGrid columns={4}>
        <StatCard label="Toplam" value={domains.length} />
        <StatCard label="Aktif" value={domains.filter((d) => d.status === "ACTIVE").length} />
        <StatCard label="30 gün içinde bitiyor" value={expiring} hint="Aktif, bitişe ≤ 30 gün" tone={expiring ? "warning" : undefined} />
        <StatCard label="Başarısız yenileme" value={failed} hint="Ödendi, registrar'da yenilenemedi" tone={failed ? "danger" : undefined} />
      </StatGrid>

      <DataTable
        columns={columns}
        data={domains}
        searchFn={(r, q) => r.name.includes(q) || r.customerName.toLocaleLowerCase("tr-TR").includes(q)}
        searchPlaceholder="Alan adı veya müşteri ara…"
        filters={[{ id: "status", label: "Durum", options: getStatusOptions("domain"), getValue: (r) => r.status }]}
        initialSort={[{ id: "expiresAt", desc: false }]}
        rowHref={(r) => `${P}/${r.id}`}
        rowActions={(r) => [{ label: "Detay", href: `${P}/${r.id}`, icon: <Eye aria-hidden /> }]}
        mobileCard={(r) => (
          <ListRow
            title={r.name}
            subtitle={r.customerName}
            trailing={formatDate(r.expiresAt)}
            meta={<StatusBadge kind="domain" status={r.status} />}
          />
        )}
        emptyState={<EmptyState icon={Globe} title="Henüz alan adı yok" />}
      />
    </>
  );
}
