"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Globe, Loader2, Save } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  DataTable,
  EmptyState,
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
import { formatDateTime } from "@/lib/format/date";
import { saveDnsSettingsAction } from "@/lib/actions/admin/dns";
import { toast } from "@/lib/toast";

export interface ZoneRow {
  id: string;
  domainId: string;
  domain: string;
  customer: string;
  status: string;
  nameservers: string[];
  recordCount: number;
  instance: string | null;
  lastSyncedAt: string | null;
  lastError: string | null;
}

const columns: ColumnDef<ZoneRow>[] = [
  {
    accessorKey: "domain",
    header: "Alan adı",
    cell: ({ row }) => (
      <div className="min-w-0">
        <p className="truncate font-medium">{row.original.domain}</p>
        <p className="truncate text-xs text-muted-foreground">{row.original.customer}</p>
      </div>
    ),
  },
  {
    accessorKey: "status",
    header: "Durum",
    cell: ({ row }) => (
      <div className="min-w-0">
        <StatusBadge kind="dnsZone" status={row.original.status} />
        {row.original.lastError ? <p className="mt-1 truncate text-xs text-muted-foreground">{row.original.lastError}</p> : null}
      </div>
    ),
  },
  {
    id: "nameservers",
    accessorFn: (r) => r.nameservers.join(", "),
    header: "Nameserver'lar",
    cell: ({ row }) => <span className="font-mono text-xs">{row.original.nameservers.join(", ") || "—"}</span>,
  },
  { accessorKey: "recordCount", header: "Kayıt", cell: ({ row }) => row.original.recordCount },
  {
    accessorKey: "lastSyncedAt",
    header: "Son eşitleme",
    cell: ({ row }) => (row.original.lastSyncedAt ? formatDateTime(row.original.lastSyncedAt) : "—"),
  },
];

interface Props {
  zones: ZoneRow[];
  settings: { provider: "registrar" | "cloudflare"; hostingIp: string };
  instances: Array<{ id: string; label: string }>;
}

export function AdminDnsContent({ zones, settings, instances }: Props) {
  const router = useRouter();
  const [provider, setProvider] = useState<string>(settings.provider);
  const [hostingIp, setHostingIp] = useState(settings.hostingIp);
  const [saving, setSaving] = useState(false);

  const active = zones.filter((zone) => zone.status === "ACTIVE").length;
  const pending = zones.filter((zone) => zone.status === "PENDING").length;
  const failed = zones.filter((zone) => zone.status === "ERROR").length;

  const handleSave = async () => {
    setSaving(true);
    const result = await saveDnsSettingsAction({ provider, hostingIp });
    setSaving(false);
    if (!result.success) {
      toast.error(result.error);
      return;
    }
    toast.success("DNS ayarları kaydedildi");
    router.refresh();
  };

  return (
    <>
      <PageHeader
        title="DNS bölgeleri"
        description="Cloudflare'de barındırılan müşteri zone'ları. Alan adı detayından zone oluşturabilir veya senkronize edebilirsiniz."
      />

      <StatGrid columns={3}>
        <StatCard label="Aktif" value={active} />
        <StatCard label="Nameserver bekleyen" value={pending} tone={pending ? "warning" : undefined} />
        <StatCard label="Hatalı" value={failed} tone={failed ? "danger" : undefined} />
      </StatGrid>

      <SectionCard
        title="Varsayılan DNS sağlayıcısı"
        description="Sahip kararı bekleniyor: “Kayıt firması” seçiliyken hiçbir alan adı otomatik olarak Cloudflare'e taşınmaz (mevcut davranış)."
        footer={
          <div className="flex justify-end">
            <button type="button" className={appButton()} onClick={() => void handleSave()} disabled={saving}>
              {saving ? <Loader2 aria-hidden className="animate-spin" /> : <Save aria-hidden />}
              Kaydet
            </button>
          </div>
        }
      >
        <div className="grid gap-4 md:grid-cols-2">
          <FormField
            label="Yeni alan adlarında DNS"
            htmlFor="dns-provider"
            hint={
              provider === "cloudflare"
                ? "Hosting/VDS aktivasyonunda zone ve A/MX/SPF kayıtları Cloudflare'de otomatik oluşturulur; müşteriler DNS'lerini Cloudflare'e taşıyabilir."
                : "DNS kayıt firmasında kalır. Yalnızca yöneticinin elle zone oluşturduğu alan adları Cloudflare'i kullanır."
            }
          >
            <Select value={provider} onValueChange={setProvider}>
              <SelectTrigger id="dns-provider">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="registrar">Kayıt firması (Gri DNS)</SelectItem>
                <SelectItem value="cloudflare">Cloudflare (bizim hesap)</SelectItem>
              </SelectContent>
            </Select>
          </FormField>
          <FormField
            label="Hosting IP (yedek)"
            htmlFor="dns-hosting-ip"
            hint="Hizmetin ya da bağlı sunucunun IP'si bilinmiyorsa @, www ve mail A kayıtları bu adrese yazılır."
          >
            <Input id="dns-hosting-ip" value={hostingIp} placeholder="188.132.235.10" onChange={(e) => setHostingIp(e.target.value)} />
          </FormField>
        </div>
        {instances.length === 0 ? (
          <p className="mt-4 text-sm text-muted-foreground">
            Etkin DNS modülü yok.{" "}
            <Link href="/yonetim/moduller" className="underline underline-offset-2">
              Modüller
            </Link>{" "}
            ekranından bir Cloudflare örneği ekleyin.
          </p>
        ) : (
          <p className="mt-4 text-xs text-muted-foreground">Yeni zone&apos;lar şu örnekte açılır: {instances[0].label}</p>
        )}
      </SectionCard>

      <DataTable
        columns={columns}
        data={zones}
        searchFn={(r, q) => r.domain.includes(q) || r.customer.toLocaleLowerCase("tr-TR").includes(q)}
        searchPlaceholder="Alan adı veya müşteri ara…"
        rowHref={(r) => `/yonetim/domainler/${r.domainId}#dns`}
        mobileCard={(r) => (
          <ListRow title={r.domain} subtitle={r.customer} trailing={<StatusBadge kind="dnsZone" status={r.status} />} meta={`${r.recordCount} kayıt`} />
        )}
        emptyState={
          <EmptyState
            icon={Globe}
            title="Henüz DNS bölgesi yok"
            description="Alan adı detayında “Zone oluştur” ile ya da Cloudflare modunda hosting aktivasyonunda otomatik oluşur."
          />
        }
      />
    </>
  );
}
