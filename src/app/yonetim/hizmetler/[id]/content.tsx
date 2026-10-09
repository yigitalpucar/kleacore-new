"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowUpDown,
  CheckCircle,
  ExternalLink,
  FileText,
  HardDrive,
  Pause,
  Pencil,
  RefreshCcw,
  User,
  XCircle,
} from "lucide-react";
import {
  AppBreadcrumbLabel,
  DataTable,
  DetailList,
  EmptyState,
  ListRow,
  PageHeader,
  SectionCard,
  StatusBadge,
  UnavailableAction,
  UsageMeter,
  appButton,
  enumLabel,
  type ColumnDef,
} from "@/components/app";
import {
  activateService,
  cancelService,
  suspendService,
} from "@/lib/actions/admin/services";
import { monthlyEquivalent, periodTotal } from "@/lib/billing/period-price";
import { formatTRY } from "@/lib/format/price";
import { billingPeriodLabel, billingPeriodUnit, formatDate, formatDateTime } from "@/lib/format/date";
import { toast } from "@/lib/toast";
import { ServiceModuleCard, type ServiceModuleView } from "@/components/admin/modules/service-module-card";
import { ProxmoxServiceCard } from "@/components/admin/modules/proxmox-service-card";
import { VdsBackupsAdminCard } from "@/components/admin/modules/vds-backups-card";
import type { AdminVdsBackupsView } from "@/lib/backups/vds";
import type { ProxmoxAdminView } from "@/lib/modules/server-panel";
import { AdminPanelLoginButtons } from "@/components/admin/modules/admin-panel-login";

type DateLike = Date | string;

interface ServiceDetailData {
  id: string;
  label: string;
  domain: string | null;
  username: string | null;
  ipAddress: string | null;
  serverName: string | null;
  remoteId?: string | null;
  status: string;
  billingPeriod: string;
  amount: number;
  nextDueDate: DateLike | null;
  expiresAt: DateLike | null;
  suspendedAt: DateLike | null;
  cancelledAt: DateLike | null;
  suspendReason: string | null;
  diskUsed: number | null;
  diskLimit: number | null;
  bandwidthUsed: number | null;
  bandwidthLimit: number | null;
  usageSyncedAt: DateLike | null;
  hasPanelPassword: boolean;
  createdAt: DateLike;
  customer: {
    id: string;
    name: string;
    surname: string;
    email: string;
    phone: string | null;
    companyName: string | null;
    kycStatus?: string;
  };
  product: {
    id: string;
    name: string;
    sku: string;
    category: {
      id: string;
      slug: string;
      name: string;
    };
  };
  backups: Array<{
    id: string;
    type: string;
    status: string;
    size: number | null;
    createdAt: DateLike;
  }>;
}

interface ServiceDetailContentProps {
  service: ServiceDetailData;
  moduleView: ServiceModuleView;
  proxmoxView?: ProxmoxAdminView | null;
  /** VDS backups (module with the "backups" capability). */
  vdsBackups?: AdminVdsBackupsView | null;
  /** backups.manage: restore / delete / slots / final backup actions. */
  canManageBackups?: boolean;
  /** Show "cPanel'e giriş (müşteri olarak)" (bound to an SSO-capable module, active/suspended). */
  panelLogin?: boolean;
  /** services.manage: suspend/activate/cancel and quick actions (view-only roles such as SUPPORT get false). */
  canManage?: boolean;
  /** invoices.edit: "Fatura oluştur" shortcut. */
  canCreateInvoice?: boolean;
}

type BackupRow = ServiceDetailData["backups"][number];

const money = (n: number) => formatTRY(n, { keepDecimals: true });

/** Backup size is stored in MB. */
function formatBackupSize(mb: number | null) {
  if (mb === null || mb === undefined) return "—";
  if (mb >= 1024) return `${(mb / 1024).toLocaleString("tr-TR", { maximumFractionDigits: 2 })} GB`;
  return `${mb.toLocaleString("tr-TR", { maximumFractionDigits: 0 })} MB`;
}

const backupColumns: ColumnDef<BackupRow>[] = [
  {
    accessorKey: "type",
    header: "Tür",
    cell: ({ row }) => enumLabel("backupType", row.original.type),
  },
  {
    accessorKey: "size",
    header: "Boyut",
    meta: { align: "right" },
    cell: ({ row }) => <span className="tabular-nums">{formatBackupSize(row.original.size)}</span>,
  },
  {
    accessorKey: "status",
    header: "Durum",
    enableSorting: false,
    cell: ({ row }) => <StatusBadge kind="backup" status={row.original.status} />,
  },
  {
    id: "createdAt",
    accessorFn: (r) => new Date(r.createdAt).toISOString(),
    header: "Tarih",
    cell: ({ row }) => <span className="tabular-nums text-muted-foreground">{formatDateTime(row.original.createdAt)}</span>,
  },
];

export function ServiceDetailContent({
  service,
  moduleView,
  proxmoxView,
  vdsBackups,
  canManageBackups = false,
  panelLogin = false,
  canManage = true,
  canCreateInvoice = true,
}: ServiceDetailContentProps) {
  const router = useRouter();

  const handleSuspendService = async () => {
    const reason = prompt("Askıya alma nedeni:", "Yonetim tarafindan askiya alindi")?.trim() ?? "";
    if (!reason) return;

    const result = await suspendService(service.id, reason);
    if (!result.success) {
      toast.error(result.error ?? "Hizmet askıya alınamadı");
      return;
    }

    toast.success("Hizmet askıya alındı");
    router.refresh();
  };

  const handleActivateService = async () => {
    const result = await activateService(service.id);
    if (!result.success) {
      toast.error(result.error ?? "Hizmet aktifleştirilemedi");
      return;
    }

    toast.success("Hizmet aktifleştirildi");
    router.refresh();
  };

  const handleCancelService = async () => {
    const confirmed = window.confirm(
      proxmoxView?.vmid && vdsBackups
        ? `Hizmet iptal edilecek. Önce VM ${proxmoxView.vmid} kapatılıp son yedeği alınır (${vdsBackups.finalKeepDays} gün saklanır); yedek tamamlanınca VM diskleriyle birlikte KALICI olarak silinir. Devam edilsin mi?`
        : proxmoxView?.vmid
          ? `Hizmet iptal edilecek ve Proxmox'taki VM ${proxmoxView.vmid} diskleriyle birlikte KALICI olarak silinecek. Geri alınamaz. Devam edilsin mi?`
          : "Bu hizmeti iptal etmek istediğinize emin misiniz?"
    );
    if (!confirmed) return;

    const result = await cancelService(service.id);
    if (!result.success) {
      toast.error(result.error ?? "Hizmet iptal edilemedi");
      return;
    }

    const integration = (result as { integration?: { ok: boolean; skipped?: boolean; error?: string } }).integration;
    if (integration?.error === "FINAL_BACKUP_PENDING") {
      toast.success("Hizmet iptal edildi. Son yedek alınıyor; tamamlanınca VM otomatik silinecek.");
      router.refresh();
      return;
    }
    if (integration && !integration.ok && !integration.skipped) {
      toast.error(`Hizmet iptal edildi ancak uzak sunucuda kapatılamadı: ${integration.error ?? "bilinmeyen hata"}`);
      router.refresh();
      return;
    }
    toast.success("Hizmet iptal edildi");
    router.refresh();
  };

  const title = service.domain || service.label || service.product.name;
  const slug = service.product.category?.slug;
  const categoryName = slug ? enumLabel("productCategory", slug) : service.product.category?.name ?? "—";
  const customerName = `${service.customer.name} ${service.customer.surname}`.trim();

  // service.amount is the charge for ONE billing period (a yearly service
  // stores the yearly total). Never multiply it by 12 for display.
  const amount = Number(service.amount);
  const isMonthly = service.billingPeriod === "monthly";
  const equivalent = isMonthly
    ? { label: "Yıllık karşılığı", value: `${money(periodTotal(amount, "yearly", "monthly-equivalent"))} / yıl` }
    : { label: "Aylık karşılığı", value: `${money(monthlyEquivalent(amount, service.billingPeriod))} / ay` };

  const hasUsage =
    (service.diskLimit ?? 0) > 0 || (service.bandwidthLimit ?? 0) > 0;

  const isCancelled = service.status === "CANCELLED";

  return (
    <>
      <AppBreadcrumbLabel segment={service.id} label={title} />

      <PageHeader
        back={{ href: "/yonetim/hizmetler", label: "Hizmetler" }}
        eyebrow={`${categoryName} · ${service.product.name}`}
        title={title}
        meta={
          <>
            <StatusBadge kind="service" status={service.status} size="md" />
            <span>Oluşturuldu {formatDate(service.createdAt)}</span>
            <span>Yenileme {formatDate(service.nextDueDate)}</span>
          </>
        }
        actions={
          <>
            {panelLogin ? <AdminPanelLoginButtons serviceId={service.id} /> : null}
            {canManage && <UnavailableAction label="Düzenle" icon={<Pencil aria-hidden />} reason="Yakında" size="sm" />}
            {canManage && (
              <UnavailableAction label="Yükselt / düşür" icon={<ArrowUpDown aria-hidden />} reason="Yakında" size="sm" />
            )}
            {canCreateInvoice && (
              <Link href="/yonetim/faturalar/olustur" className={appButton({ variant: "outline", size: "sm" })}>
                <FileText aria-hidden />
                Fatura oluştur
              </Link>
            )}
            {canManage && service.status === "ACTIVE" ? (
              <button
                type="button"
                onClick={() => void handleSuspendService()}
                className={appButton({ variant: "outline", size: "sm" })}
              >
                <Pause aria-hidden />
                Askıya al
              </button>
            ) : null}
            {canManage && service.status === "SUSPENDED" ? (
              <button
                type="button"
                onClick={() => void handleActivateService()}
                className={appButton({ size: "sm" })}
              >
                <CheckCircle aria-hidden />
                Aktif et
              </button>
            ) : null}
          </>
        }
      />

      <div className="grid items-start gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <SectionCard title="Hizmet bilgileri">
            <DetailList
              layout="grid"
              items={[
                { label: "Hizmet ID", value: service.id, mono: true, copy: service.id },
                {
                  label: "Alan adı",
                  value: service.domain ? (
                    <a
                      href={`https://${service.domain}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 hover:underline"
                    >
                      {service.domain}
                      <ExternalLink aria-hidden className="size-3.5 text-muted-foreground" />
                      <span className="sr-only">(yeni sekmede açılır)</span>
                    </a>
                  ) : null,
                },
                { label: "Etiket", value: service.label },
                { label: "Kategori", value: categoryName },
                { label: "Paket", value: `${service.product.name} (${service.product.sku})` },
                { label: "Kullanıcı adı", value: service.username, mono: true, copy: service.username ?? undefined },
                { label: "Oluşturma tarihi", value: formatDate(service.createdAt) },
                { label: "Sonraki yenileme", value: service.nextDueDate ? formatDate(service.nextDueDate) : null },
                { label: "Bitiş tarihi", value: service.expiresAt ? formatDate(service.expiresAt) : null },
                { label: "Askıya alınma", value: service.suspendedAt ? formatDateTime(service.suspendedAt) : null },
                { label: "Askıya alma nedeni", value: service.suspendReason },
                { label: "İptal tarihi", value: service.cancelledAt ? formatDateTime(service.cancelledAt) : null },
              ]}
            />
          </SectionCard>

          {service.serverName || service.ipAddress || hasUsage || service.usageSyncedAt ? (
            <SectionCard title="Sunucu ve kullanım">
              <div className="space-y-5">
                <DetailList
                  layout="grid"
                  items={[
                    { label: "Sunucu", value: service.serverName, mono: true },
                    { label: "IP adresi", value: service.ipAddress, mono: true, copy: service.ipAddress ?? undefined },
                    {
                      label: "Kullanım senkronu",
                      value: service.usageSyncedAt ? formatDateTime(service.usageSyncedAt) : null,
                    },
                    { label: "Panel şifresi", value: service.hasPanelPassword ? "Kayıtlı (şifreli)" : null },
                  ]}
                />
                {hasUsage ? (
                  <div className="grid gap-4 sm:grid-cols-2">
                    {(service.diskLimit ?? 0) > 0 && service.diskUsed != null ? (
                      <UsageMeter label="Disk" used={service.diskUsed} limit={service.diskLimit} unit="GB" />
                    ) : (service.diskLimit ?? 0) > 0 ? (
                      <p className="text-sm">
                        <span className="text-muted-foreground">Disk boyutu </span>
                        <span className="font-medium tabular-nums">{service.diskLimit} GB</span>
                      </p>
                    ) : null}
                    {(service.bandwidthLimit ?? 0) > 0 ? (
                      <UsageMeter label="Trafik" used={service.bandwidthUsed ?? 0} limit={service.bandwidthLimit} unit="GB" />
                    ) : null}
                  </div>
                ) : null}
              </div>
            </SectionCard>
          ) : null}

          <ServiceModuleCard serviceId={service.id} view={moduleView} legacyServerName={service.serverName} />

          {proxmoxView ? <ProxmoxServiceCard serviceId={service.id} view={proxmoxView} /> : null}

          {vdsBackups ? (
            <VdsBackupsAdminCard
              serviceId={service.id}
              serviceStatus={service.status}
              vmPending={service.status === "CANCELLED" && Boolean(service.remoteId)}
              view={vdsBackups}
              canManage={canManageBackups}
            />
          ) : (
          <SectionCard
            title="Yedekler"
            description={service.backups.length ? `Son ${service.backups.length} yedek` : undefined}
            flush
          >
            <DataTable
              framed={false}
              caption="Yedekler"
              columns={backupColumns}
              data={service.backups}
              pageSize={0}
              initialSort={[{ id: "createdAt", desc: true }]}
              mobileCard={(b) => (
                <ListRow
                  title={enumLabel("backupType", b.type)}
                  trailing={formatBackupSize(b.size)}
                  meta={
                    <>
                      <StatusBadge kind="backup" status={b.status} />
                      <span>{formatDateTime(b.createdAt)}</span>
                    </>
                  }
                />
              )}
              emptyState={
                <div className="p-4">
                  <EmptyState compact icon={HardDrive} title="Henüz yedek yok" description="Bu hizmet için alınan yedekler burada listelenir." />
                </div>
              }
            />
          </SectionCard>
          )}
        </div>

        <div className="space-y-6">
          <SectionCard
            title="Müşteri"
            footer={
              <Link
                href={`/yonetim/musteriler/${service.customer.id}`}
                className={appButton({ variant: "outline", size: "sm", className: "w-full" })}
              >
                <User aria-hidden />
                Müşteri profiline git
              </Link>
            }
          >
            <DetailList
              items={[
                { label: "Ad soyad", value: customerName },
                { label: "Firma", value: service.customer.companyName },
                { label: "E-posta", value: service.customer.email, copy: service.customer.email },
                { label: "Telefon", value: service.customer.phone },
                {
                  label: "Kimlik doğrulama",
                  value: service.customer.kycStatus ? <StatusBadge kind="kyc" status={service.customer.kycStatus} /> : null,
                },
              ]}
            />
          </SectionCard>

          <SectionCard title="Faturalama">
            <DetailList
              items={[
                { label: "Dönem", value: billingPeriodLabel(service.billingPeriod) },
                {
                  label: "Dönem tutarı",
                  value: (
                    <span className="tabular-nums">
                      <span className="font-medium">{money(amount)}</span>
                      <span className="text-muted-foreground"> / {billingPeriodUnit(service.billingPeriod)}</span>
                    </span>
                  ),
                },
                { label: equivalent.label, value: <span className="tabular-nums text-muted-foreground">{equivalent.value}</span> },
                { label: "Sonraki ödeme", value: formatDate(service.nextDueDate) },
              ]}
            />
          </SectionCard>

          {canManage && (
          <SectionCard title="Hızlı işlemler" headingLevel={2}>
            <div className="space-y-2">
              <UnavailableAction layout="tile" label="Manuel yenileme" icon={<RefreshCcw aria-hidden />} reason="Yakında" />
              <UnavailableAction layout="tile" label="Paket değiştir" icon={<ArrowUpDown aria-hidden />} reason="Yakında" />
              <UnavailableAction layout="tile" label="Yenileme faturası" icon={<FileText aria-hidden />} reason="Yakında" />
              <div className="border-t border-dashed pt-3">
                {isCancelled ? (
                  <span
                    aria-disabled="true"
                    className={appButton({ variant: "outline", size: "sm", className: "w-full cursor-not-allowed opacity-50" })}
                  >
                    <XCircle aria-hidden />
                    Hizmet iptal edildi
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => void handleCancelService()}
                    className={appButton({ variant: "destructive", size: "sm", className: "w-full" })}
                  >
                    <XCircle aria-hidden />
                    Hizmeti iptal et
                  </button>
                )}
              </div>
            </div>
          </SectionCard>
          )}
        </div>
      </div>
    </>
  );
}
