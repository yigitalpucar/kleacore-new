"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Loader2, Trash2 } from "lucide-react";
import {
  DataTable,
  DetailList,
  FormField,
  ListRow,
  PageHeader,
  SectionCard,
  StatCard,
  StatGrid,
  StatusBadge,
  appButton,
  type ColumnDef,
} from "@/components/app";
import { Input } from "@/components/ui/input";
import {
  assignIpAddressAction,
  deleteIpPoolAction,
  releaseIpAddressAction,
  reserveIpAddressAction,
} from "@/lib/actions/admin/ip-pools";
import { formatDateTime } from "@/lib/format/date";
import { toast } from "@/lib/toast";

type IpStatus = "FREE" | "ASSIGNED" | "RESERVED";

interface AddressRow {
  id: string;
  address: string;
  status: IpStatus;
  notes: string | null;
  assignedAt: string | null;
  cooldownUntil: string | null;
  service: { id: string; label: string; domain: string | null } | null;
}

interface PoolView {
  id: string;
  name: string;
  cidr: string;
  gateway: string;
  netmask: string;
  prefix: number;
  dnsServers: string[];
  vlan: number | null;
  releaseCooldownMinutes: number;
  notes: string | null;
  moduleInstance: { id: string; label: string } | null;
}

const STATUS_META: Record<IpStatus, { label: string; tone: "muted" | "info" | "warning" }> = {
  FREE: { label: "Boş", tone: "muted" },
  ASSIGNED: { label: "Atanmış", tone: "info" },
  RESERVED: { label: "Ayrılmış", tone: "warning" },
};

function IpStatusBadge({ row }: { row: AddressRow }) {
  const meta = STATUS_META[row.status];
  const cooling = row.status === "FREE" && row.cooldownUntil && new Date(row.cooldownUntil) > new Date();
  return <StatusBadge tone={cooling ? "warning" : meta.tone} label={cooling ? `Beklemede · ${formatDateTime(row.cooldownUntil!)}` : meta.label} />;
}

export function IpPoolDetailContent({ pool, addresses }: { pool: PoolView; addresses: AddressRow[] }) {
  const router = useRouter();
  const [selected, setSelected] = useState<AddressRow | null>(null);
  const [serviceRef, setServiceRef] = useState("");
  const [assignError, setAssignError] = useState<string>();
  const [pending, start] = useTransition();

  const counts = addresses.reduce(
    (acc, row) => ({ ...acc, [row.status]: acc[row.status] + 1 }),
    { FREE: 0, ASSIGNED: 0, RESERVED: 0 } as Record<IpStatus, number>
  );

  const run = (action: () => Promise<{ success: boolean; error?: string }>, success: string) =>
    start(async () => {
      const result = await action();
      if (!result.success) toast.error(result.error ?? "İşlem başarısız.");
      else toast.success(success);
      router.refresh();
    });

  const assign = () =>
    start(async () => {
      if (!selected) return;
      setAssignError(undefined);
      const result = await assignIpAddressAction(selected.id, serviceRef);
      if (!result.success) {
        setAssignError(result.error);
        toast.error(result.error);
        return;
      }
      toast.success(`${selected.address} atandı.`);
      setSelected(null);
      setServiceRef("");
      router.refresh();
    });

  const columns: ColumnDef<AddressRow>[] = [
    { accessorKey: "address", header: "Adres", cell: ({ row }) => <span className="font-mono">{row.original.address}</span> },
    { accessorKey: "status", header: "Durum", enableSorting: false, cell: ({ row }) => <IpStatusBadge row={row.original} /> },
    {
      id: "service",
      accessorFn: (r) => r.service?.domain ?? r.service?.label ?? r.notes ?? "",
      header: "Hizmet / not",
      cell: ({ row }) =>
        row.original.service ? (
          <Link href={`/yonetim/hizmetler/${row.original.service.id}`} className="underline-offset-2 hover:underline">
            {row.original.service.domain || row.original.service.label}
          </Link>
        ) : (
          <span className="text-muted-foreground">{row.original.notes ?? "—"}</span>
        ),
    },
    {
      id: "assignedAt",
      accessorFn: (r) => r.assignedAt ?? "",
      header: "Atanma",
      cell: ({ row }) => (row.original.status === "ASSIGNED" && row.original.assignedAt ? formatDateTime(row.original.assignedAt) : "—"),
    },
  ];

  return (
    <>
      <PageHeader
        back={{ href: "/yonetim/ip-havuzlari", label: "IP havuzları" }}
        eyebrow="IP havuzu"
        title={pool.name}
        description={<span className="font-mono">{pool.cidr}</span>}
        actions={
          <button
            type="button"
            className={appButton({ variant: "outline" })}
            disabled={pending || counts.ASSIGNED > 0}
            title={counts.ASSIGNED > 0 ? "Atanmış adres varken silinemez" : undefined}
            onClick={() => {
              if (!window.confirm(`“${pool.name}” ve ${addresses.length} adresi silinsin mi?`)) return;
              start(async () => {
                const result = await deleteIpPoolAction(pool.id);
                if (!result.success) {
                  toast.error(result.error);
                  return;
                }
                toast.success("Havuz silindi.");
                router.push("/yonetim/ip-havuzlari");
              });
            }}
          >
            <Trash2 aria-hidden />
            Havuzu sil
          </button>
        }
      />

      <StatGrid columns={4}>
        <StatCard label="Toplam" value={addresses.length} />
        <StatCard label="Atanmış" value={counts.ASSIGNED} />
        <StatCard label="Boş" value={counts.FREE} tone={counts.FREE === 0 ? "danger" : undefined} />
        <StatCard label="Ayrılmış" value={counts.RESERVED} />
      </StatGrid>

      <div className="grid items-start gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {selected ? (
            <SectionCard
              title={`${selected.address} adresini ata`}
              footer={
                <>
                  <button type="button" className={appButton({ variant: "ghost", size: "sm" })} onClick={() => setSelected(null)}>
                    Vazgeç
                  </button>
                  <button type="button" className={appButton({ size: "sm" })} disabled={pending} onClick={assign}>
                    {pending ? <Loader2 aria-hidden className="animate-spin" /> : null}
                    Ata
                  </button>
                </>
              }
            >
              <FormField label="Hizmet" htmlFor="assign-service" hint="Hizmet no, alan adı, kullanıcı adı veya uzak kimlik." error={assignError}>
                <Input id="assign-service" className="h-11 md:h-9" value={serviceRef} onChange={(e) => setServiceRef(e.target.value)} />
              </FormField>
            </SectionCard>
          ) : null}

          <DataTable
            columns={columns}
            data={addresses}
            searchFn={(r, q) => r.address.includes(q) || (r.service?.domain ?? "").toLowerCase().includes(q)}
            searchPlaceholder="Adres veya alan adı ara…"
            filters={[
              {
                id: "status",
                label: "Durum",
                options: (Object.keys(STATUS_META) as IpStatus[]).map((value) => ({ value, label: STATUS_META[value].label })),
                getValue: (r) => r.status,
              },
            ]}
            pageSize={25}
            rowActions={(r) => [
              r.status === "FREE"
                ? { label: "Hizmete ata", onSelect: () => setSelected(r) }
                : { label: "Hizmete ata", disabledReason: "Adres boşta değil" },
              r.status === "FREE"
                ? { label: "Ayır", onSelect: () => run(() => reserveIpAddressAction(r.id, window.prompt("Not (opsiyonel)") ?? ""), `${r.address} ayrıldı.`) }
                : { label: "Ayır", disabledReason: "Yalnızca boş adres ayrılabilir" },
              r.status === "FREE"
                ? { label: "Serbest bırak", disabledReason: "Zaten boşta" }
                : {
                    label: "Serbest bırak",
                    destructive: true,
                    separator: true,
                    onSelect: () => {
                      if (window.confirm(`${r.address} serbest bırakılsın mı?`)) run(() => releaseIpAddressAction(r.id), `${r.address} serbest bırakıldı.`);
                    },
                  },
            ]}
            mobileCard={(r) => (
              <ListRow
                title={<span className="font-mono">{r.address}</span>}
                subtitle={r.service ? r.service.domain || r.service.label : r.notes ?? undefined}
                trailing={<IpStatusBadge row={r} />}
              />
            )}
          />
        </div>

        <SectionCard title="Ağ bilgileri">
          <DetailList
            items={[
              { label: "CIDR", value: pool.cidr, mono: true },
              { label: "Ağ geçidi", value: pool.gateway, mono: true, copy: pool.gateway },
              { label: "Ağ maskesi", value: `${pool.netmask} (/${pool.prefix})`, mono: true },
              { label: "DNS", value: pool.dnsServers.join(", "), mono: true },
              { label: "VLAN", value: pool.vlan ? String(pool.vlan) : null },
              {
                label: "Sunucu modülü",
                value: pool.moduleInstance ? (
                  <Link href={`/yonetim/moduller/${pool.moduleInstance.id}`} className="underline-offset-2 hover:underline">
                    {pool.moduleInstance.label}
                  </Link>
                ) : null,
              },
              { label: "Serbest bırakma beklemesi", value: pool.releaseCooldownMinutes ? `${pool.releaseCooldownMinutes} dk` : "Yok" },
              { label: "Not", value: pool.notes },
            ]}
          />
        </SectionCard>
      </div>
    </>
  );
}
