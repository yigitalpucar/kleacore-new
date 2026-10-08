"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { ExternalLink, Loader2, Plus, PlugZap, RefreshCw } from "lucide-react";
import {
  DataTable,
  EmptyState,
  ListRow,
  PageHeader,
  SectionCard,
  StatusBadge,
  appButton,
  type ColumnDef,
} from "@/components/app";
import { HealthBadge } from "@/components/admin/modules/health-badge";
import {
  setModuleInstanceActiveAction,
  syncLegacyModulesAction,
  testModuleInstanceAction,
  testSettingsModuleAction,
} from "@/lib/actions/admin/modules";
import type { InstanceView, ManifestView, ModulesOverview } from "@/lib/modules/admin-view";
import { toast } from "@/lib/toast";

const SYNC_LABELS: Record<string, string> = {
  created: "oluşturuldu",
  updated: "güncellendi",
  unchanged: "değişiklik yok",
  skipped: "atlandı",
};
const SOURCE_LABELS: Record<string, string> = { cpanel: "cPanel/WHM", registrar: "Registrar", vps_vds: "VPS/VDS" };

function SyncLegacyButton() {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      className={appButton({ variant: "outline" })}
      disabled={pending}
      onClick={() =>
        start(async () => {
          const result = await syncLegacyModulesAction();
          if (!result.success) {
            toast.error(result.error);
            return;
          }
          const summary = result.reports
            .map((report) => `${SOURCE_LABELS[report.source]}: ${SYNC_LABELS[report.action]}${report.reason ? ` (${report.reason})` : ""}`)
            .join(" · ");
          const mismatched = result.verification.filter((item) => item.instanceId && !item.equal);
          if (mismatched.length) {
            toast.error(`Ayar farkı: ${mismatched.map((item) => `${SOURCE_LABELS[item.source]} [${item.differences.join(", ")}]`).join(" · ")}`);
          } else {
            toast.success(summary || "İçe aktarılacak ayar yok.");
          }
          router.refresh();
        })
      }
    >
      {pending ? <Loader2 aria-hidden className="animate-spin" /> : <RefreshCw aria-hidden />}
      Eski ayarları içe aktar
    </button>
  );
}

function TestButton({ run, label = "Bağlantıyı test et" }: { run: () => Promise<{ ok: boolean; message: string }>; label?: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      className={appButton({ variant: "outline", size: "sm" })}
      disabled={pending}
      onClick={() =>
        start(async () => {
          const result = await run();
          if (result.ok) toast.success(result.message);
          else toast.error(result.message);
          router.refresh();
        })
      }
    >
      {pending ? <Loader2 aria-hidden className="animate-spin" /> : <PlugZap aria-hidden />}
      {label}
    </button>
  );
}

function ManifestRow({ manifest }: { manifest: ManifestView }) {
  return (
    <div className="flex flex-col gap-3 border-b px-4 py-3 last:border-b-0 md:flex-row md:items-center md:justify-between md:px-5">
      <div className="min-w-0 space-y-1">
        <p className="flex flex-wrap items-center gap-2 text-sm font-medium">
          {manifest.name}
          <span className="font-mono text-[11px] text-muted-foreground">{manifest.id}</span>
          {manifest.hidden ? <StatusBadge tone="muted" label="Donduruldu" /> : null}
        </p>
        <p className="text-[13px] text-muted-foreground">{manifest.description}</p>
        {manifest.capabilities.length ? (
          <p className="font-mono text-[11px] text-muted-foreground">{manifest.capabilities.join(" · ")}</p>
        ) : null}
      </div>
      <div className="flex shrink-0 flex-wrap gap-2">
        {manifest.storage === "settings" ? (
          <>
            <TestButton run={() => testSettingsModuleAction(manifest.id)} />
            {manifest.settingsHref ? (
              <Link href={manifest.settingsHref} className={appButton({ variant: "outline", size: "sm" })}>
                <ExternalLink aria-hidden />
                Ayarlar
              </Link>
            ) : null}
          </>
        ) : manifest.hidden ? null : (
          <Link href={`/yonetim/moduller/yeni?modul=${manifest.id}`} className={appButton({ variant: "outline", size: "sm" })}>
            <Plus aria-hidden />
            Örnek ekle
          </Link>
        )}
      </div>
    </div>
  );
}

function useInstanceColumns(): ColumnDef<InstanceView>[] {
  return [
    {
      accessorKey: "label",
      header: "Örnek",
      cell: ({ row }) => (
        <div className="min-w-0">
          <p className="truncate font-medium">{row.original.label}</p>
          <p className="truncate text-xs text-muted-foreground">
            {row.original.moduleName}
            {row.original.legacySource ? " · Entegrasyonlar ayarından" : ""}
          </p>
        </div>
      ),
    },
    {
      accessorKey: "isActive",
      header: "Durum",
      enableSorting: false,
      cell: ({ row }) =>
        row.original.isActive ? <StatusBadge tone="success" label="Aktif" /> : <StatusBadge tone="muted" label="Pasif" />,
    },
    {
      id: "health",
      header: "Bağlantı",
      enableSorting: false,
      cell: ({ row }) => <HealthBadge status={row.original.lastHealthStatus} error={row.original.lastHealthError} at={row.original.lastHealthAt} />,
    },
    {
      id: "pool",
      accessorFn: (r) => r.priority,
      header: "Öncelik / grup",
      cell: ({ row }) => (
        <span className="font-mono text-xs">
          {row.original.priority}
          {row.original.groupKey ? ` · ${row.original.groupKey}` : ""}
        </span>
      ),
    },
    {
      id: "usage",
      accessorFn: (r) => r.serviceCount,
      header: "Hizmet",
      meta: { align: "right" },
      cell: ({ row }) => (
        <span className="font-mono text-xs">
          {row.original.serviceCount}
          {row.original.capacity ? ` / ${row.original.capacity}` : ""}
        </span>
      ),
    },
  ];
}

function InstanceTable({ instances }: { instances: InstanceView[] }) {
  const router = useRouter();
  const columns = useInstanceColumns();
  const [, start] = useTransition();

  const toggle = (instance: InstanceView) =>
    start(async () => {
      const result = await setModuleInstanceActiveAction(instance.id, !instance.isActive);
      if (!result.success) toast.error(result.error);
      else toast.success(instance.isActive ? "Örnek pasif yapıldı." : "Örnek aktif yapıldı.");
      router.refresh();
    });

  const test = (instance: InstanceView) =>
    start(async () => {
      const result = await testModuleInstanceAction(instance.id);
      if (result.ok) toast.success(`${instance.label}: ${result.message}`);
      else toast.error(`${instance.label}: ${result.message}`);
      router.refresh();
    });

  return (
    <DataTable
      columns={columns}
      data={instances}
      framed={false}
      pageSize={0}
      rowHref={(r) => `/yonetim/moduller/${r.id}`}
      rowActions={(r) => [
        { label: "Düzenle", href: `/yonetim/moduller/${r.id}` },
        { label: "Bağlantıyı test et", onSelect: () => test(r) },
        { label: r.isActive ? "Pasif yap" : "Aktif yap", onSelect: () => toggle(r) },
      ]}
      mobileCard={(r) => (
        <ListRow
          title={r.label}
          subtitle={r.moduleName}
          trailing={r.isActive ? <StatusBadge tone="success" label="Aktif" /> : <StatusBadge tone="muted" label="Pasif" />}
          meta={<HealthBadge status={r.lastHealthStatus} error={r.lastHealthError} at={r.lastHealthAt} />}
        />
      )}
    />
  );
}

export function ModullerContent({ overview }: { overview: ModulesOverview }) {
  return (
    <>
      <PageHeader
        title="Modüller"
        description="Sunucu, alan adı, DNS, ödeme ve diğer modüller; her modülün yapılandırılmış örnekleri ve bağlantı durumları."
        actions={<SyncLegacyButton />}
      />

      {overview.kinds.map((group) => (
        <SectionCard
          key={group.kind}
          id={`tur-${group.kind}`}
          title={group.label}
          description={
            group.manifests.some((m) => m.storage === "settings")
              ? "Bu modüllerin ayarları şimdilik Entegrasyonlar ekranında tutulur."
              : undefined
          }
          flush
        >
          {group.manifests.length === 0 ? (
            <div className="p-4 md:p-5">
              <EmptyState compact title="Bu türde henüz modül yok" />
            </div>
          ) : (
            group.manifests.map((manifest) => <ManifestRow key={manifest.id} manifest={manifest} />)
          )}
          {group.instances.length ? (
            <div className="border-t">
              <p className="px-4 pt-3 font-mono text-[11px] uppercase tracking-wider text-muted-foreground md:px-5">
                Örnekler
              </p>
              <InstanceTable instances={group.instances} />
            </div>
          ) : null}
        </SectionCard>
      ))}
    </>
  );
}
