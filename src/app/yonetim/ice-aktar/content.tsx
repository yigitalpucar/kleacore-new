"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { Download, Loader2 } from "lucide-react";
import {
  DataTable,
  EmptyState,
  FormField,
  FormSection,
  ListRow,
  PageHeader,
  SectionCard,
  StatusBadge,
  appButton,
  type ColumnDef,
} from "@/components/app";
import { createImportRunAction } from "@/lib/actions/admin/imports";
import { formatDateTime } from "@/lib/format/date";
import { toast } from "@/lib/toast";
import { RUN_STATUS_META, SOURCE_LABELS } from "./status";

type Source = "WHM" | "PROXMOX" | "REGISTRAR";

interface InstanceOption {
  id: string;
  label: string;
  moduleName: string;
  source: Source;
  isActive: boolean;
  supported: boolean;
}

interface RunRow {
  id: string;
  source: Source;
  instanceLabel: string;
  status: string;
  totalCount: number;
  importedCount: number;
  linkedCount: number;
  skippedCount: number;
  failedCount: number;
  createdBy: string | null;
  createdAt: string;
  appliedAt: string | null;
}

const SOURCES: { value: Source; label: string; hint: string }[] = [
  { value: "WHM", label: "cPanel/WHM hesapları", hint: "listaccts: kullanıcı, alan adı, paket, e-posta, disk, askı durumu" },
  { value: "PROXMOX", label: "Proxmox sanal sunucuları", hint: "VMID, ad, durum, çekirdek, bellek, disk, IP" },
  { value: "REGISTRAR", label: "Alan adları (Gri)", hint: "Ad, bitiş tarihi, durum, ad sunucuları, otomatik yenileme" },
];

const selectClass =
  "flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:h-9";

export function IceAktarContent({ instances, runs }: { instances: InstanceOption[]; runs: RunRow[] }) {
  const router = useRouter();
  const [source, setSource] = useState<Source>("WHM");
  const options = useMemo(() => instances.filter((i) => i.source === source), [instances, source]);
  const [instanceId, setInstanceId] = useState<string>("");
  const [sendInvites, setSendInvites] = useState(true);
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();

  const selectedInstance = options.find((o) => o.id === instanceId) ?? options.find((o) => o.supported);

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedInstance) return;
    setError(undefined);
    start(async () => {
      const result = await createImportRunAction({ source, moduleInstanceId: selectedInstance.id, sendInvites });
      if (!result.success) {
        setError(result.error);
        toast.error(result.error);
        return;
      }
      toast.success("Listeleme arka planda başladı.");
      router.push(`/yonetim/ice-aktar/${result.id}`);
    });
  };

  const columns: ColumnDef<RunRow>[] = [
    {
      id: "createdAt",
      accessorFn: (r) => r.createdAt,
      header: "Tarih",
      cell: ({ row }) => formatDateTime(row.original.createdAt),
    },
    {
      accessorKey: "source",
      header: "Kaynak",
      cell: ({ row }) => (
        <div>
          <div>{SOURCE_LABELS[row.original.source]}</div>
          <div className="text-xs text-muted-foreground">{row.original.instanceLabel}</div>
        </div>
      ),
    },
    {
      id: "counts",
      header: "Kayıt",
      enableSorting: false,
      cell: ({ row }) => (
        <span className="font-mono text-xs">
          {row.original.totalCount} · {row.original.importedCount + row.original.linkedCount} aktarıldı
          {row.original.failedCount ? ` · ${row.original.failedCount} hata` : ""}
        </span>
      ),
    },
    { accessorKey: "createdBy", header: "Başlatan", cell: ({ row }) => row.original.createdBy ?? "—" },
    {
      accessorKey: "status",
      header: "Durum",
      enableSorting: false,
      cell: ({ row }) => {
        const meta = RUN_STATUS_META[row.original.status];
        return <StatusBadge tone={meta.tone} label={meta.label} />;
      },
    },
  ];

  return (
    <>
      <PageHeader
        title="İçe aktarma"
        description="Mevcut WHM hesaplarını, Proxmox sanal sunucularını ve alan adlarını KLEACORE'a hizmet olarak aktarın. Uzak sistemlerde hiçbir şey değişmez, geçmiş dönemler için fatura kesilmez."
      />

      <form onSubmit={submit} className="space-y-8">
        <FormSection
          title="Yeni içe aktarma"
          description="Kaynak listesi arka planda alınır; ardından önizlemede müşteri, ürün ve vade eşlemesini düzenleyip seçtiğiniz satırları aktarırsınız."
          footer={
            <button type="submit" disabled={pending || !selectedInstance?.supported} className={appButton({ size: "sm" })}>
              {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Download className="size-4" aria-hidden />}
              Listele ve önizle
            </button>
          }
        >
          <div className="grid gap-4 md:grid-cols-2">
            <FormField label="Kaynak" htmlFor="import-source" hint={SOURCES.find((s) => s.value === source)?.hint}>
              <select
                id="import-source"
                className={selectClass}
                value={source}
                onChange={(e) => {
                  setSource(e.target.value as Source);
                  setInstanceId("");
                }}
              >
                {SOURCES.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </FormField>
            <FormField
              label="Modül örneği"
              htmlFor="import-instance"
              hint={
                options.length === 0
                  ? "Bu kaynak için modül örneği yok. Modüller ekranından ekleyin."
                  : selectedInstance && !selectedInstance.supported
                    ? `${selectedInstance.moduleName} modülü listelemeyi desteklemiyor.`
                    : undefined
              }
            >
              <select
                id="import-instance"
                className={selectClass}
                value={selectedInstance?.id ?? ""}
                onChange={(e) => setInstanceId(e.target.value)}
                disabled={options.length === 0}
              >
                {options.length === 0 ? <option value="">—</option> : null}
                {options.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.label} ({o.moduleName}
                    {o.isActive ? "" : ", pasif"})
                  </option>
                ))}
              </select>
            </FormField>
          </div>
          <label className="mt-4 flex items-start gap-3 text-sm">
            <input
              type="checkbox"
              className="mt-0.5 size-4"
              checked={sendInvites}
              onChange={(e) => setSendInvites(e.target.checked)}
            />
            <span>
              Yeni oluşturulan müşterilere davet e-postası gönder
              <span className="block text-xs text-muted-foreground">
                Müşteriler şifresiz açılır; davet bağlantısı (7 gün geçerli) ile şifrelerini belirlerler.
              </span>
            </span>
          </label>
          {error ? (
            <p role="alert" className="mt-3 text-sm text-red-700 dark:text-red-400">
              {error}
            </p>
          ) : null}
          {options.length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">
              <Link href="/yonetim/moduller" className="underline underline-offset-2">
                Modüller
              </Link>{" "}
              ekranından bir örnek ekleyin.
            </p>
          ) : null}
        </FormSection>
      </form>

      <SectionCard title="Geçmiş içe aktarmalar" flush>
        <DataTable
          framed={false}
          columns={columns}
          data={runs}
          initialSort={[{ id: "createdAt", desc: true }]}
          rowHref={(r) => `/yonetim/ice-aktar/${r.id}`}
          mobileCard={(r) => {
            const meta = RUN_STATUS_META[r.status];
            return (
              <ListRow
                title={`${SOURCE_LABELS[r.source]} · ${r.instanceLabel}`}
                subtitle={formatDateTime(r.createdAt)}
                trailing={`${r.importedCount + r.linkedCount}/${r.totalCount}`}
                meta={<StatusBadge tone={meta.tone} label={meta.label} />}
              />
            );
          }}
          emptyState={<EmptyState icon={Download} title="Henüz içe aktarma yapılmadı" compact />}
        />
      </SectionCard>
    </>
  );
}
