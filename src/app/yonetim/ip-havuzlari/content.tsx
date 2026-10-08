"use client";

import Link from "next/link";
import { Network, Plus } from "lucide-react";
import {
  DataTable,
  EmptyState,
  ListRow,
  PageHeader,
  StatCard,
  StatGrid,
  UsageMeter,
  appButton,
  type ColumnDef,
} from "@/components/app";

export interface PoolRow {
  id: string;
  name: string;
  cidr: string;
  gateway: string;
  vlan: number | null;
  moduleInstance: { id: string; label: string } | null;
  total: number;
  free: number;
  assigned: number;
  reserved: number;
}

const columns: ColumnDef<PoolRow>[] = [
  {
    accessorKey: "name",
    header: "Havuz",
    cell: ({ row }) => (
      <div className="min-w-0">
        <p className="truncate font-medium">{row.original.name}</p>
        <p className="font-mono text-xs text-muted-foreground">
          {row.original.cidr}
          {row.original.vlan ? ` · VLAN ${row.original.vlan}` : ""}
        </p>
      </div>
    ),
  },
  { accessorKey: "gateway", header: "Ağ geçidi", cell: ({ row }) => <span className="font-mono text-xs">{row.original.gateway}</span> },
  {
    id: "instance",
    accessorFn: (r) => r.moduleInstance?.label ?? "",
    header: "Sunucu modülü",
    cell: ({ row }) => row.original.moduleInstance?.label ?? <span className="text-muted-foreground">—</span>,
  },
  {
    id: "usage",
    accessorFn: (r) => (r.total ? r.assigned / r.total : 0),
    header: "Doluluk",
    cell: ({ row }) => (
      <div className="min-w-40">
        <UsageMeter label={`${row.original.assigned} atanmış · ${row.original.free} boş`} used={row.original.assigned} limit={row.original.total - row.original.reserved || row.original.total} />
      </div>
    ),
  },
];

export function IpHavuzlariContent({ pools }: { pools: PoolRow[] }) {
  const total = pools.reduce((sum, pool) => sum + pool.total, 0);
  const assigned = pools.reduce((sum, pool) => sum + pool.assigned, 0);
  const free = pools.reduce((sum, pool) => sum + pool.free, 0);

  const createButton = (
    <Link href="/yonetim/ip-havuzlari/yeni" className={appButton()}>
      <Plus aria-hidden />
      Yeni havuz
    </Link>
  );

  return (
    <>
      <PageHeader
        title="IP havuzları"
        description="VDS kurulumlarında otomatik atanan IPv4 blokları. Fesihte adresler havuza geri döner."
        actions={createButton}
      />

      <StatGrid columns={3}>
        <StatCard label="Toplam adres" value={total} />
        <StatCard label="Atanmış" value={assigned} />
        <StatCard label="Boş" value={free} tone={total && free === 0 ? "danger" : undefined} hint={total && free === 0 ? "Havuzlar dolu" : undefined} />
      </StatGrid>

      <DataTable
        columns={columns}
        data={pools}
        searchFn={(r, q) => r.name.toLocaleLowerCase("tr-TR").includes(q) || r.cidr.includes(q)}
        searchPlaceholder="Havuz veya CIDR ara…"
        rowHref={(r) => `/yonetim/ip-havuzlari/${r.id}`}
        mobileCard={(r) => (
          <ListRow title={r.name} subtitle={r.cidr} trailing={`${r.assigned}/${r.total}`} meta={r.moduleInstance?.label} />
        )}
        emptyState={
          <EmptyState
            icon={Network}
            title="Henüz IP havuzu yok"
            description="CIDR bloğundan havuz oluşturun; ağ, yayın ve ağ geçidi adresleri otomatik dışarıda bırakılır."
            action={createButton}
          />
        }
      />
    </>
  );
}
