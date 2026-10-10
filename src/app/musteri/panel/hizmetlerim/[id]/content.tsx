"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowUpDown,
  Ban,
  Check,
  Cloud,
  CreditCard,
  Download,
  Hourglass,
  FileText,
  Loader2,
  Lock,
  Mail,
  Package,
  Power,
  RefreshCcw,
  Server,
  Settings,
  Shield,
  Terminal,
} from "lucide-react";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AppBreadcrumbLabel,
  DetailList,
  IconTile,
  PageHeader,
  SectionCard,
  StatusBadge,
  UnavailableAction,
  UsageMeter,
  appButton,
  enumLabel,
} from "@/components/app";
import { HostingAccessCard, type HostingAccessData } from "@/components/panel/hosting-access-card";
import { submitCancellationRequest } from "@/lib/actions/customer/cancellation";
import { toast } from "@/lib/toast";
import { formatTRY } from "@/lib/format/price";
import { billingPeriodLabel, formatDate, formatDateTime } from "@/lib/format/date";
import { VdsPanel } from "@/components/panel/vds-panel";
import { VdsBackups } from "@/components/panel/vds-backups";
import { ServerMetrics, ServerMetricsUnavailable } from "@/components/panel/server-metrics";
import type { VdsBackupsView } from "@/lib/backups/vds";
import type { VdsPanelView } from "@/lib/modules/server-panel";
import { PanelEmptyState } from "@/components/panel/panel-empty-state";

const categoryIcons: Record<string, typeof Package> = {
  hosting: Package,
  vds: Server,
  vps: Server,
  server: Server,
  ssl: Shield,
  domain: Cloud,
  email: Package,
};

interface ServiceData {
  id: string;
  label: string;
  domain: string | null;
  status: string;
  amount: number;
  billingPeriod: string;
  ipAddress: string | null;
  createdAt: string;
  nextDueDate: string | null;
  expiresAt: string | null;
  diskUsed: number | null;
  diskLimit: number | null;
  bandwidthUsed: number | null;
  bandwidthLimit: number | null;
  cpuUsage: number | null;
  ramUsage: number | null;
  /** Last panel usage sync (hosting), ISO. */
  usageSyncedAt: string | null;
  /** cPanel access card data; null for non-hosting services. */
  hostingAccess: HostingAccessData | null;
  product: {
    id: string;
    name: string;
    features: unknown[];
    resourceLimits: Record<string, string>;
    category: {
      slug: string;
      name: string;
    } | null;
  };
  backups: {
    id: string;
    type: string;
    status: string;
    size: number | null;
    completedAt: string | null;
    createdAt: string;
  }[];
  pendingCancellation: {
    id: string;
    reason: string;
    createdAt: string;
  } | null;
  /** Expected-time text while the service waits for manual provisioning (status PENDING). */
  provisioningEta: string | null;
  suspendReason?: string | null;
  /** Module-bound VDS (Proxmox): live panel instead of the generic server cards. */
  vds?: VdsPanelView | null;
  vdsBackups?: VdsBackupsView | null;
}

interface HizmetDetayContentProps {
  service: ServiceData;
}

const P = "/musteri/panel/hizmetlerim";

/** Usage without a panel limit ("sınırsız"): amount only, no bar. */
function UnlimitedUsage({ label, used }: { label: string; used: number }) {
  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between gap-3 text-sm">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium tabular-nums">
          {used.toLocaleString("tr-TR", { maximumFractionDigits: 2 })} GB <span className="text-muted-foreground">/ sınırsız</span>
        </span>
      </div>
      <div className="h-1.5 rounded-full bg-muted" aria-hidden />
    </div>
  );
}

export function HizmetDetayContent({ service }: HizmetDetayContentProps) {
  const router = useRouter();
  const [isCancelDialogOpen, setIsCancelDialogOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [isSubmittingCancel, setIsSubmittingCancel] = useState(false);

  const categorySlug = service.product.category?.slug ?? "hosting";
  const isHosting = categorySlug === "hosting";
  const isServer = ["vds", "vps", "cloud", "server"].includes(categorySlug);
  const vds = service.vds ?? null;
  const isSsl = categorySlug === "ssl";

  const TypeIcon = categoryIcons[categorySlug] || Package;
  const metricsCard =
    isServer && service.status !== "PENDING" ? (
      vds?.capabilities.metrics && vds.provisioning === "ready" ? (
        <ServerMetrics serviceId={service.id} />
      ) : (
        <ServerMetricsUnavailable
          description={
            vds && vds.provisioning !== "ready"
              ? "Sunucunuz hazır olduğunda işlemci, bellek, ağ ve disk grafikleri burada görünür."
              : undefined
          }
        />
      )
    ) : null;
  const canRequestCancellation =
    !service.pendingCancellation && service.status !== "CANCELLED" && service.status !== "EXPIRED";
  const endDate = service.nextDueDate ?? service.expiresAt;
  const price = `${formatTRY(service.amount, { keepDecimals: true })} / ${billingPeriodLabel(service.billingPeriod).toLocaleLowerCase("tr-TR")}`;

  const handleSubmitCancellation = async () => {
    if (isSubmittingCancel) return;

    setIsSubmittingCancel(true);
    const result = await submitCancellationRequest(service.id, cancelReason);

    if (!result.success) {
      toast.error(result.error ?? "İptal talebi gönderilemedi");
      setIsSubmittingCancel(false);
      return;
    }

    toast.success("İptal talebiniz alındı. En kısa sürede değerlendirilecektir.");
    setIsCancelDialogOpen(false);
    setCancelReason("");
    router.refresh();
    setIsSubmittingCancel(false);
  };

  const hasDisk = service.diskUsed != null && service.diskLimit != null && service.diskLimit > 0;
  const hasBandwidth = service.bandwidthUsed != null && service.bandwidthLimit != null && service.bandwidthLimit > 0;
  // Synced from the panel with no limit there ("unlimited"): show the amount used.
  const synced = Boolean(service.usageSyncedAt);
  const unlimitedDisk = synced && service.diskUsed != null && !hasDisk;
  const unlimitedBandwidth = synced && service.bandwidthUsed != null && !hasBandwidth;
  const hasCpu = isServer && service.cpuUsage != null;
  const hasRam = isServer && service.ramUsage != null;
  const hasUsage = hasDisk || hasBandwidth || hasCpu || hasRam || unlimitedDisk || unlimitedBandwidth;

  const limits = service.product.resourceLimits ?? {};
  const specItems = [
    { label: "İşlemci", value: limits.cpu },
    { label: "RAM", value: limits.ram },
    { label: "Depolama", value: limits.storage ?? limits.disk },
    { label: "Bant genişliği", value: limits.bandwidth ?? limits.traffic },
    { label: "Port", value: limits.port },
  ];

  // Product features are stored either as strings or as { label, value } objects.
  const features = (Array.isArray(service.product.features) ? service.product.features : [])
    .map((f) => {
      if (typeof f === "string") return { label: f, value: null as string | null };
      if (f && typeof f === "object" && "label" in f) {
        const o = f as { label?: unknown; value?: unknown };
        return { label: String(o.label ?? ""), value: o.value != null ? String(o.value) : null };
      }
      return null;
    })
    .filter((f): f is { label: string; value: string | null } => Boolean(f && f.label));

  // Quick actions: real links where a page exists, honest "Yakında" otherwise.
  // Hosting: cPanel / Webmail / File Manager / phpMyAdmin are single sign-on
  // links in the "cPanel erişimi" card below.
  const quickLinks: { label: string; description: string; href: string; icon: React.ReactNode }[] = isHosting
    ? [
        { label: "E-posta hesapları", description: "Hesap ve kota listesi", href: `${P}/${service.id}/eposta`, icon: <Mail aria-hidden /> },
        ...(service.hostingAccess?.sso
          ? []
          : [{ label: "Webmail", description: "Gelen kutusu erişimi", href: "/musteri/panel/webmail", icon: <Mail aria-hidden /> }]),
      ]
    : [];
  const soonActions: { label: string; description: string; icon: React.ReactNode }[] = vds || isHosting
    ? []
    : isServer
      ? [
          { label: "SSH konsol", description: "Terminal erişimi", icon: <Terminal aria-hidden /> },
          { label: "Yeniden başlat", description: "Sunucuyu yeniden başlat", icon: <Power aria-hidden /> },
          { label: "Snapshot al", description: "Anlık görüntü", icon: <Download aria-hidden /> },
          { label: "İşletim sistemi", description: "Yeniden kurulum", icon: <Settings aria-hidden /> },
        ]
      : isSsl
        ? [
            { label: "Sertifika indir", description: "CRT dosyası", icon: <Download aria-hidden /> },
            { label: "Özel anahtar", description: "Private key", icon: <Lock aria-hidden /> },
            { label: "Yeniden oluştur", description: "CSR ve anahtar", icon: <RefreshCcw aria-hidden /> },
            { label: "CA bundle", description: "Ara sertifika", icon: <FileText aria-hidden /> },
          ]
        : [];

  return (
    <>
      <AppBreadcrumbLabel segment={service.id} label={service.product.name} />

      <PageHeader
        back={{ href: P, label: "Hizmetlerim" }}
        eyebrow={service.product.category?.name ?? "Hizmet"}
        title={
          <span className="flex items-center gap-3">
            <IconTile size="lg" className="hidden sm:flex">
              <TypeIcon />
            </IconTile>
            {service.product.name}
          </span>
        }
        description={service.domain || service.label || undefined}
        meta={
          <>
            <StatusBadge kind="service" status={service.status} size="md" />
            {service.pendingCancellation ? <StatusBadge size="md" tone="warning" label="İptal talebi bekliyor" /> : null}
            {endDate ? <span>Bitiş {formatDate(endDate)}</span> : null}
            <span className="tabular-nums">{price}</span>
          </>
        }
        actions={
          <>
            {service.status !== "PENDING" ? (
              <Link href={`${P}/${service.id}/yenile`} className={appButton({ variant: "outline" })}>
                <RefreshCcw aria-hidden />
                Yenile
              </Link>
            ) : null}
            {service.status === "ACTIVE" ? (
              <Link href={`${P}/${service.id}/yukselt`} className={appButton({ variant: "outline" })}>
                <ArrowUpDown aria-hidden />
                Paket değiştir
              </Link>
            ) : null}
            <UnavailableAction label="Yönet" icon={<Settings aria-hidden />} reason="Yakında" />
          </>
        }
      />

      {service.status === "PENDING" ? (
        <SectionCard title="Kurulum sürüyor">
          <div role="status" className="flex items-start gap-3">
            <Hourglass aria-hidden className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
            <div className="space-y-1 text-sm">
              <p>Ödemeniz alındı; hizmetiniz ekibimiz tarafından kuruluyor.</p>
              {service.provisioningEta ? <p className="text-muted-foreground">{service.provisioningEta}</p> : null}
            </div>
          </div>
        </SectionCard>
      ) : null}

      {service.status !== "PENDING" && (quickLinks.length || soonActions.length) ? (
        <SectionCard title="Hızlı işlemler" description={soonActions.length ? "Panel bağlantıları kademeli olarak açılıyor." : undefined}>
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
            {quickLinks.map((a) => (
              <Link
                key={a.label}
                href={a.href}
                className="flex min-h-[60px] items-center gap-3 rounded-md border bg-background px-3 py-2.5 transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring [&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:text-muted-foreground"
              >
                {a.icon}
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium">{a.label}</span>
                  <span className="block truncate text-xs text-muted-foreground">{a.description}</span>
                </span>
              </Link>
            ))}
            {soonActions.map((a) => (
              <UnavailableAction key={a.label} layout="tile" label={a.label} description={a.description} icon={a.icon} />
            ))}
          </div>
        </SectionCard>
      ) : null}

      <div className="grid items-start gap-6 lg:grid-cols-3">
        <div className="min-w-0 space-y-6 lg:col-span-2">
          {vds ? (
            <VdsPanel
              serviceId={service.id}
              serverName={service.label || service.product.name}
              status={service.status}
              suspendReason={service.suspendReason ?? null}
              ipAddress={service.ipAddress}
              usage={{
                cpuUsage: service.cpuUsage,
                ramUsage: service.ramUsage,
                diskUsed: service.diskUsed,
                diskLimit: service.diskLimit,
                bandwidthUsed: service.bandwidthUsed,
              }}
              view={vds}
              afterUsage={metricsCard}
            />
          ) : null}

          {vds && service.vdsBackups ? <VdsBackups view={service.vdsBackups} /> : null}

          {service.hostingAccess && service.status !== "PENDING" ? <HostingAccessCard data={service.hostingAccess} /> : null}

          {!vds && (isHosting || isServer) ? (
            <SectionCard
              title="Kaynak kullanımı"
              description={
                service.usageSyncedAt
                  ? `Son güncelleme ${formatDateTime(service.usageSyncedAt)} · bant genişliği bu ay`
                  : undefined
              }
            >
              {hasUsage ? (
                <div className="grid gap-5 sm:grid-cols-2">
                  {hasDisk ? <UsageMeter label="Disk" used={service.diskUsed} limit={service.diskLimit} unit="GB" /> : null}
                  {unlimitedDisk ? <UnlimitedUsage label="Disk" used={service.diskUsed!} /> : null}
                  {unlimitedBandwidth ? <UnlimitedUsage label="Bant genişliği" used={service.bandwidthUsed!} /> : null}
                  {hasBandwidth ? (
                    <UsageMeter
                      label="Bant genişliği"
                      used={service.bandwidthUsed}
                      limit={service.bandwidthLimit}
                      unit={isServer ? "TB" : "GB"}
                    />
                  ) : null}
                  {hasCpu ? <UsageMeter label="CPU" percent={service.cpuUsage} /> : null}
                  {hasRam ? <UsageMeter label="RAM" percent={service.ramUsage} /> : null}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Bu hizmet için henüz kullanım verisi yok.</p>
              )}
            </SectionCard>
          ) : null}

          {vds ? null : metricsCard}

          {isServer && !vds && specItems.some((s) => s.value) ? (
            <SectionCard title="Sunucu özellikleri">
              <DetailList layout="grid" columns={2} items={specItems} />
            </SectionCard>
          ) : null}

          {isSsl ? (
            <SectionCard title="Sertifika detayları">
              <DetailList
                layout="grid"
                items={[
                  { label: "Sertifika tipi", value: service.product.name },
                  { label: "Kapsam", value: service.domain || "—" },
                ]}
              />
            </SectionCard>
          ) : null}

          {features.length > 0 ? (
            <SectionCard title="Paket özellikleri">
              <ul className="grid gap-x-8 sm:grid-cols-2">
                {features.map((f, index) => (
                  <li
                    key={index}
                    className="flex min-h-10 items-center justify-between gap-3 border-b border-dashed py-2 text-sm last:border-0 sm:[&:nth-last-child(2):nth-child(odd)]:border-0"
                  >
                    <span className="flex items-center gap-2 text-muted-foreground">
                      <Check aria-hidden className="size-4 shrink-0" />
                      {f.label}
                    </span>
                    {f.value ? <span className="text-right font-medium">{f.value}</span> : null}
                  </li>
                ))}
              </ul>
            </SectionCard>
          ) : null}

          {(isHosting || isServer) && !service.vdsBackups ? (
            <SectionCard
              title="Son yedekler"
              actions={
                <Link href="/musteri/panel/yedekleme" className={appButton({ variant: "ghost", size: "sm" })}>
                  Yedekler
                </Link>
              }
              flush
            >
              {service.backups.length ? (
                <ul className="divide-y">
                  {service.backups.map((b) => (
                    <li key={b.id} className="flex items-center gap-3 px-4 py-3 text-sm md:px-5">
                      <span className="min-w-0 flex-1">
                        <span className="block font-medium">{enumLabel("backupType", b.type)} yedek</span>
                        <span className="block text-xs text-muted-foreground">
                          {formatDateTime(b.completedAt ?? b.createdAt)}
                          {b.size != null ? ` · ${b.size.toLocaleString("tr-TR")} MB` : ""}
                        </span>
                      </span>
                      <StatusBadge kind="backup" status={b.status} />
                    </li>
                  ))}
                </ul>
              ) : (
                <PanelEmptyState kind="serviceBackups" compact className="m-4" />
              )}
            </SectionCard>
          ) : null}
        </div>

        <div className="space-y-6">
          <SectionCard title="Hizmet bilgileri">
            <DetailList
              items={[
                { label: "Kategori", value: service.product.category?.name || "—" },
                { label: "Başlangıç", value: formatDate(service.createdAt) },
                { label: "Bitiş", value: formatDate(endDate) },
                { label: "Fatura dönemi", value: billingPeriodLabel(service.billingPeriod) },
                { label: "Tutar", value: formatTRY(service.amount, { keepDecimals: true }) },
                { label: "IP adresi", value: service.ipAddress, mono: true, copy: service.ipAddress ?? undefined },
              ]}
            />

            {service.pendingCancellation ? (
              <div className="mt-4 rounded-md border border-dashed border-amber-500/50 p-3 text-sm">
                <p className="font-medium">İptal talebi bekliyor</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {formatDate(service.pendingCancellation.createdAt)} tarihinde gönderildi
                </p>
                <p className="mt-2 line-clamp-3 text-muted-foreground">{service.pendingCancellation.reason}</p>
              </div>
            ) : null}

            <div className="mt-4 grid gap-2 border-t pt-4">
              {service.status !== "PENDING" ? (
                <Link href={`${P}/${service.id}/yenile`} className={appButton({ variant: "outline", className: "justify-start" })}>
                  <RefreshCcw aria-hidden />
                  Hizmeti yenile
                </Link>
              ) : null}
              {service.status === "ACTIVE" ? (
                <Link href={`${P}/${service.id}/yukselt`} className={appButton({ variant: "outline", className: "justify-start" })}>
                  <ArrowUpDown aria-hidden />
                  Paket değiştir
                </Link>
              ) : null}
              <Link href={`${P}/${service.id}/fatura`} className={appButton({ variant: "outline", className: "justify-start" })}>
                <CreditCard aria-hidden />
                Faturayı görüntüle
              </Link>
              {canRequestCancellation ? (
                <Dialog open={isCancelDialogOpen} onOpenChange={setIsCancelDialogOpen}>
                  <DialogTrigger asChild>
                    <button type="button" className={appButton({ variant: "destructive", className: "justify-start" })}>
                      <Ban aria-hidden />
                      İptal talebi gönder
                    </button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Hizmet iptal talebi</DialogTitle>
                      <DialogDescription>
                        İptal talebiniz yönetici onayından sonra işleme alınır. Lütfen iptal nedeninizi açıklayın.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-2 py-2">
                      <Label htmlFor="cancel-reason">İptal nedeni</Label>
                      <Textarea
                        id="cancel-reason"
                        placeholder="İptal nedeninizi en az 10 karakter olacak şekilde yazın…"
                        value={cancelReason}
                        onChange={(e) => setCancelReason(e.target.value)}
                        rows={4}
                      />
                      <p className="text-xs text-muted-foreground">
                        {cancelReason.trim().length}/1000 karakter (en az 10)
                      </p>
                    </div>
                    <DialogFooter className="gap-2">
                      <button
                        type="button"
                        className={appButton({ variant: "outline" })}
                        onClick={() => setIsCancelDialogOpen(false)}
                        disabled={isSubmittingCancel}
                      >
                        Vazgeç
                      </button>
                      <button
                        type="button"
                        className={appButton({ variant: "destructive" })}
                        onClick={() => void handleSubmitCancellation()}
                        disabled={isSubmittingCancel || cancelReason.trim().length < 10}
                      >
                        {isSubmittingCancel ? <Loader2 aria-hidden className="animate-spin" /> : null}
                        {isSubmittingCancel ? "Gönderiliyor…" : "Talebi gönder"}
                      </button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              ) : null}
            </div>
          </SectionCard>

          <div className="rounded-lg border border-dashed p-4 text-sm">
            <p className="font-medium">Yardıma mı ihtiyacınız var?</p>
            <p className="mt-1 text-muted-foreground">Bu hizmetle ilgili sorularınız için destek talebi açabilirsiniz.</p>
            <Link href="/musteri/panel/destek" className={appButton({ variant: "outline", size: "sm", className: "mt-3" })}>
              Destek talebi aç
            </Link>
          </div>
        </div>
      </div>
    </>
  );
}
