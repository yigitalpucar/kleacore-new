"use client";

import { useState } from "react";
import Link from "next/link";
import { Download, FileText, KeyRound, Plus, RefreshCcw, Settings2, ShieldCheck } from "lucide-react";
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
  enumLabel,
  getStatusOptions,
  type ColumnDef,
  type RowAction,
} from "@/components/app";
import { Switch } from "@/components/ui/switch";
import { toggleAutoRenew } from "@/lib/actions/customer/ssl";
import { formatDate } from "@/lib/format/date";
import { toast } from "@/lib/toast";
import { PanelEmptyState } from "@/components/panel/panel-empty-state";

interface CertificateItem {
  id: string;
  domain: string;
  type: string;
  provider: string;
  status: string;
  issuedAt: string | null;
  expiresAt: string | null;
  autoRenew: boolean;
  daysLeft: number;
}

interface SSLContentProps {
  certificates: CertificateItem[];
  stats: {
    total: number;
    active: number;
    expiring: number;
    expired: number;
  };
}

const TYPE_SHORT: Record<string, string> = { DV: "DV", OV: "OV", EV: "EV", WILDCARD: "WILDCARD" };

const isExpiring = (c: CertificateItem) => c.status === "ACTIVE" && c.daysLeft > 0 && c.daysLeft <= 30;
const canToggle = (c: CertificateItem) => c.status !== "EXPIRED" && c.status !== "PENDING";

function TypeTag({ type }: { type: string }) {
  return (
    <span
      title={enumLabel("sslType", type)}
      className="inline-flex h-5 items-center rounded border px-1.5 font-mono text-[10px] font-medium tracking-wider text-muted-foreground"
    >
      {TYPE_SHORT[type] ?? type}
    </span>
  );
}

function ExpiryCell({ cert }: { cert: CertificateItem }) {
  if (cert.status === "PENDING") return <span className="text-muted-foreground">Doğrulama bekleniyor</span>;
  if (!cert.expiresAt) return <span className="text-muted-foreground">—</span>;
  return (
    <span className="whitespace-nowrap">
      <span className="tabular-nums">{formatDate(cert.expiresAt)}</span>
      {cert.status === "ACTIVE" ? (
        <span className={isExpiring(cert) ? "block text-xs font-medium text-foreground" : "block text-xs text-muted-foreground"}>
          {cert.daysLeft} gün kaldı
        </span>
      ) : null}
    </span>
  );
}

function AutoRenewSwitch({
  cert,
  busy,
  onToggle,
}: {
  cert: CertificateItem;
  busy: boolean;
  onToggle: (id: string) => void;
}) {
  return (
    <Switch
      checked={cert.autoRenew}
      disabled={!canToggle(cert) || busy}
      onCheckedChange={() => onToggle(cert.id)}
      aria-label={`${cert.domain} otomatik yenileme`}
    />
  );
}

export function SSLContent({ certificates, stats }: SSLContentProps) {
  const [localCerts, setLocalCerts] = useState(certificates);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const handleToggleAutoRenew = async (certId: string) => {
    setTogglingId(certId);
    const result = await toggleAutoRenew(certId);
    if (result.success) {
      setLocalCerts((prev) => prev.map((c) => (c.id === certId ? { ...c, autoRenew: result.autoRenew! } : c)));
      toast.success("Otomatik yenileme güncellendi");
    } else {
      toast.error(result.error || "İşlem başarısız");
    }
    setTogglingId(null);
  };

  const columns: ColumnDef<CertificateItem>[] = [
    {
      accessorKey: "domain",
      header: "Alan adı",
      cell: ({ row }) => {
        const c = row.original;
        return (
          <div className="flex min-w-0 items-center gap-3">
            <IconTile size="sm">
              <ShieldCheck />
            </IconTile>
            <div className="min-w-0">
              <p className="truncate font-medium">{c.domain}</p>
              <p className="truncate text-xs text-muted-foreground">{c.provider}</p>
            </div>
          </div>
        );
      },
    },
    {
      accessorKey: "type",
      header: "Tür",
      enableSorting: false,
      cell: ({ row }) => <TypeTag type={row.original.type} />,
    },
    {
      id: "expiresAt",
      accessorFn: (r) => r.expiresAt ?? "",
      header: "Bitiş",
      cell: ({ row }) => <ExpiryCell cert={row.original} />,
    },
    {
      accessorKey: "status",
      header: "Durum",
      enableSorting: false,
      cell: ({ row }) => <StatusBadge kind="ssl" status={row.original.status} />,
    },
    {
      id: "autoRenew",
      header: "Otomatik yenileme",
      enableSorting: false,
      cell: ({ row }) => <AutoRenewSwitch cert={row.original} busy={togglingId === row.original.id} onToggle={handleToggleAutoRenew} />,
    },
  ];

  const rowActions = (c: CertificateItem): RowAction[] => [
    ...(c.status !== "PENDING"
      ? [
          { label: "Sertifikayı indir", icon: <Download aria-hidden />, disabledReason: "Yakında" },
          { label: "Özel anahtarı indir", icon: <KeyRound aria-hidden />, disabledReason: "Yakında" },
          { label: "CSR görüntüle", icon: <FileText aria-hidden />, disabledReason: "Yakında" },
        ]
      : [{ label: "Doğrulamayı kontrol et", icon: <RefreshCcw aria-hidden />, disabledReason: "Yakında" }]),
    ...(c.status === "EXPIRED" ? [{ label: "Yenile", icon: <RefreshCcw aria-hidden />, href: "/ssl" }] : []),
    { label: "Ayarlar", icon: <Settings2 aria-hidden />, disabledReason: "Yakında", separator: true },
  ];

  const attention = localCerts.filter((c) => isExpiring(c) || c.status === "PENDING");

  return (
    <>
      <PageHeader
        title="SSL sertifikaları"
        description="Sertifikalarınızın durumunu ve bitiş tarihlerini izleyin, otomatik yenilemeyi yönetin."
        actions={
          <Link href="/ssl" className={appButton()}>
            <Plus aria-hidden />
            Yeni SSL al
          </Link>
        }
      />

      <StatGrid columns={4}>
        <StatCard label="Toplam" value={stats.total} hint={stats.total ? "Hesabınızdaki sertifikalar" : "Henüz sertifika yok"} />
        <StatCard label="Aktif" value={stats.active} hint="Geçerli sertifikalar" tone={stats.active ? "success" : undefined} />
        <StatCard
          label="30 gün içinde bitiyor"
          value={stats.expiring}
          hint={stats.expiring ? "Yenilemeyi kontrol edin" : "Yakında biten sertifika yok"}
          tone={stats.expiring ? "warning" : undefined}
        />
        <StatCard
          label="Süresi dolan"
          value={stats.expired}
          hint={stats.expired ? "Siteniz güvensiz görünebilir" : "Süresi dolan sertifika yok"}
          tone={stats.expired ? "danger" : undefined}
        />
      </StatGrid>

      {attention.length > 0 ? (
        <SectionCard title="Dikkat gerektirenler" flush>
          <ul className="divide-y divide-dashed">
            {attention.map((c) => (
              <li key={c.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3 text-sm md:px-5">
                <StatusBadge tone="warning" label={c.status === "PENDING" ? "Doğrulama" : `${c.daysLeft} gün`} />
                <span className="min-w-0 font-medium">{c.domain}</span>
                <span className="min-w-0 basis-full text-muted-foreground sm:basis-auto">
                  {c.status === "PENDING"
                    ? "Sertifika doğrulama aşamasında. Alan adınızın DNS kayıtlarını kontrol edin."
                    : c.autoRenew
                      ? "Otomatik yenileme açık; süresi dolmadan yenilenecek."
                      : "Otomatik yenileme kapalı. Süresi dolmadan yenilemeyi unutmayın."}
                </span>
              </li>
            ))}
          </ul>
        </SectionCard>
      ) : null}

      <DataTable
        caption="SSL sertifikaları"
        columns={columns}
        data={localCerts}
        initialSort={[{ id: "expiresAt", desc: false }]}
        searchFn={(c, q) => c.domain.toLocaleLowerCase("tr-TR").includes(q)}
        searchPlaceholder="Alan adı ara…"
        filters={[{ id: "status", label: "Durum", options: getStatusOptions("ssl"), getValue: (c) => c.status }]}
        rowActions={rowActions}
        mobileCard={(c) => (
          <div className="space-y-3">
            <ListRow
              title={c.domain}
              subtitle={`${c.provider} · ${enumLabel("sslType", c.type)}`}
              meta={
                <>
                  <StatusBadge kind="ssl" status={c.status} />
                  {c.status === "PENDING" ? (
                    <span>Doğrulama bekleniyor</span>
                  ) : c.expiresAt ? (
                    <span className="tabular-nums">
                      Bitiş {formatDate(c.expiresAt)}
                      {c.status === "ACTIVE" ? ` · ${c.daysLeft} gün` : ""}
                    </span>
                  ) : null}
                </>
              }
            />
            <div className="flex items-center justify-between gap-3 border-t border-dashed pt-2 text-sm">
              <span className="text-muted-foreground">Otomatik yenileme</span>
              <AutoRenewSwitch cert={c} busy={togglingId === c.id} onToggle={handleToggleAutoRenew} />
            </div>
          </div>
        )}
        emptyState={
          <PanelEmptyState kind="ssl" />
        }
        noResultsText="Aramanızla eşleşen sertifika bulunamadı."
      />

      <SectionCard title="Sertifika türleri" description="Hangi sertifikanın size uygun olduğundan emin değil misiniz?">
        <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { t: "DV", d: "Alan adı sahipliğini doğrular. Kişisel siteler ve bloglar için yeterlidir." },
            { t: "OV", d: "Şirket bilgilerini de doğrular. Kurumsal siteler için önerilir." },
            { t: "EV", d: "En kapsamlı doğrulama. E-ticaret ve finans siteleri için." },
            { t: "WILDCARD", d: "Bir alan adının tüm alt alan adlarını tek sertifikayla kapsar." },
          ].map((i) => (
            <div key={i.t} className="space-y-1.5">
              <dt className="flex items-center gap-2 text-sm font-medium">
                <TypeTag type={i.t} />
                {enumLabel("sslType", i.t).replace(/\s*\(.*\)$/, "")}
              </dt>
              <dd className="text-[13px] text-muted-foreground">{i.d}</dd>
            </div>
          ))}
        </dl>
      </SectionCard>
    </>
  );
}
