"use client";

import Link from "next/link";
import { useMemo } from "react";
import { AlertTriangle, ArrowRight, CalendarClock, FileText, Globe, Headphones, Package, Plus, Wallet } from "lucide-react";
import {
  DataTable,
  EmptyState,
  ListRow,
  PageHeader,
  SectionCard,
  StatCard,
  StatGrid,
  StatusBadge,
  appButton,
  enumLabel,
  type ColumnDef,
} from "@/components/app";
import { formatTRY } from "@/lib/format/price";
import { billingPeriodUnit, daysUntil, formatDate, formatDateTime } from "@/lib/format/date";

interface DashboardService {
  id: string;
  label: string;
  domain: string | null;
  status: string;
  amount: number;
  billingPeriod: string;
  nextDueDate: string | null;
  product: { id: string; name: string };
}

interface DashboardDomain {
  id: string;
  name: string;
  status: string;
  expiresAt: string;
  autoRenew: boolean;
}

interface DashboardInvoice {
  id: string;
  invoiceNumber: string;
  status: string;
  totalAmount: number;
  paidAmount: number;
  dueDate: string;
  issuedAt: string;
}

interface DashboardTicket {
  id: string;
  ticketNumber: string;
  subject: string;
  status: string;
  department: string;
  updatedAt: string;
}

interface DashboardContentProps {
  userName: string;
  stats: {
    activeServices: number;
    totalInvoices: number;
    unpaidInvoices: number;
    openTickets: number;
    balance: number;
  };
  services: DashboardService[];
  domains: DashboardDomain[];
  invoices: DashboardInvoice[];
  tickets: DashboardTicket[];
}

const P = "/musteri/panel";
const money = (n: number) => formatTRY(n, { keepDecimals: true });

const serviceColumns: ColumnDef<DashboardService>[] = [
  {
    id: "product",
    header: "Hizmet",
    accessorFn: (s) => s.product.name,
    enableSorting: false,
    cell: ({ row }) => (
      <div className="min-w-0">
        <Link href={`${P}/hizmetlerim/${row.original.id}`} className="font-medium hover:underline">
          {row.original.product.name}
        </Link>
        <p className="truncate text-xs text-muted-foreground">{row.original.domain || row.original.label || "—"}</p>
      </div>
    ),
  },
  {
    id: "due",
    header: "Sonraki ödeme",
    enableSorting: false,
    cell: ({ row }) => <span className="tabular-nums text-muted-foreground">{formatDate(row.original.nextDueDate)}</span>,
  },
  {
    id: "amount",
    header: "Tutar",
    enableSorting: false,
    meta: { align: "right" },
    cell: ({ row }) => (
      <span className="whitespace-nowrap tabular-nums">
        {money(row.original.amount)}
        <span className="text-muted-foreground"> / {billingPeriodUnit(row.original.billingPeriod)}</span>
      </span>
    ),
  },
  {
    id: "status",
    header: "Durum",
    enableSorting: false,
    meta: { align: "right" },
    cell: ({ row }) => <StatusBadge kind="service" status={row.original.status} />,
  },
];

export function DashboardContent({ userName, stats, services, domains, invoices, tickets }: DashboardContentProps) {
  const firstName = userName.trim().split(/\s+/)[0] ?? "";

  const derived = useMemo(() => {
    const unpaid = invoices.filter((i) => i.status === "PENDING" || i.status === "OVERDUE");
    const overdue = unpaid.filter((i) => i.status === "OVERDUE");
    const unpaidTotal = unpaid.reduce((sum, i) => sum + Math.max(i.totalAmount - i.paidAmount, 0), 0);
    const activeDomains = domains.filter((d) => d.status === "ACTIVE");
    const within = (date: string | null, days: number) => {
      const d = daysUntil(date);
      return d !== null && d >= 0 && d <= days;
    };
    const renewals = [
      ...services
        .filter((s) => s.status === "ACTIVE" && within(s.nextDueDate, 30))
        .map((s) => ({
          key: `s-${s.id}`,
          title: s.product.name,
          subtitle: s.domain || s.label || "Hizmet",
          date: s.nextDueDate!,
          href: `${P}/hizmetlerim/${s.id}/yenile`,
          icon: Package,
        })),
      ...activeDomains
        .filter((d) => within(d.expiresAt, 30))
        .map((d) => ({
          key: `d-${d.id}`,
          title: d.name,
          subtitle: d.autoRenew ? "Alan adı · otomatik yenileme açık" : "Alan adı",
          date: d.expiresAt,
          href: `${P}/domainler/${d.id}`,
          icon: Globe,
        })),
    ].sort((a, b) => a.date.localeCompare(b.date));
    const openTickets = tickets.filter((t) => t.status !== "CLOSED");
    const activeServices = services.filter((s) => s.status === "ACTIVE");
    return { unpaid, overdue, unpaidTotal, activeDomains, renewals, openTickets, activeServices };
  }, [services, domains, invoices, tickets]);

  const servicesPreview = derived.activeServices.length ? derived.activeServices : services;

  return (
    <>
      <PageHeader
        eyebrow="Genel bakış"
        title={firstName ? `Hoş geldiniz, ${firstName}` : "Hoş geldiniz"}
        description="Hizmetleriniz, faturalarınız ve destek talepleriniz tek bakışta."
        actions={
          <>
            <Link href={`${P}/destek/yeni`} className={appButton({ variant: "outline" })}>
              <Headphones aria-hidden />
              Destek talebi
            </Link>
            <Link href="/hosting/linux" className={appButton()}>
              <Plus aria-hidden />
              Yeni hizmet al
            </Link>
          </>
        }
      />

      {derived.unpaid.length > 0 ? (
        <div
          role="status"
          className="flex flex-col gap-3 rounded-lg border border-dashed border-foreground/25 bg-card p-4 sm:flex-row sm:items-center sm:justify-between"
        >
          <div className="flex items-start gap-3">
            <AlertTriangle aria-hidden className="mt-0.5 size-4 shrink-0 text-amber-500" />
            <div className="text-sm">
              <p className="font-medium">
                {derived.unpaid.length} ödenmemiş faturanız var
                {derived.overdue.length ? `, ${derived.overdue.length} tanesinin vadesi geçti` : ""}.
              </p>
              <p className="text-muted-foreground">
                Toplam ödenecek tutar <span className="font-medium text-foreground tabular-nums">{money(derived.unpaidTotal)}</span>.
                Vadesi geçen faturalar hizmetlerinizin askıya alınmasına neden olabilir.
              </p>
            </div>
          </div>
          <Link href={`${P}/faturalar`} className={appButton({ className: "shrink-0" })}>
            Faturalara git
          </Link>
        </div>
      ) : null}

      <StatGrid>
        <StatCard
          label="Aktif hizmet"
          value={stats.activeServices}
          hint={
            derived.renewals.filter((r) => r.key.startsWith("s-")).length
              ? `${derived.renewals.filter((r) => r.key.startsWith("s-")).length} tanesi 30 gün içinde yenilenecek`
              : `Toplam ${services.length} hizmet`
          }
          href={`${P}/hizmetlerim`}
        />
        <StatCard
          label="Alan adı"
          value={derived.activeDomains.length}
          hint={
            derived.renewals.filter((r) => r.key.startsWith("d-")).length
              ? `${derived.renewals.filter((r) => r.key.startsWith("d-")).length} tanesinin süresi yakında doluyor`
              : `Toplam ${domains.length} alan adı`
          }
          tone={derived.renewals.some((r) => r.key.startsWith("d-")) ? "warning" : undefined}
          href={`${P}/domainler`}
        />
        <StatCard
          label="Ödenmemiş fatura"
          value={stats.unpaidInvoices}
          hint={stats.unpaidInvoices ? `Toplam ${money(derived.unpaidTotal)}` : "Tüm faturalar ödendi"}
          tone={derived.overdue.length ? "danger" : stats.unpaidInvoices ? "warning" : undefined}
          href={`${P}/faturalar`}
        />
        <StatCard
          label="Açık destek talebi"
          value={stats.openTickets}
          hint={
            derived.openTickets.filter((t) => t.status === "ADMIN_REPLY").length
              ? `${derived.openTickets.filter((t) => t.status === "ADMIN_REPLY").length} talebe yanıt verildi`
              : "Yeni yanıt yok"
          }
          tone={derived.openTickets.some((t) => t.status === "ADMIN_REPLY") ? "info" : undefined}
          href={`${P}/destek`}
        />
      </StatGrid>

      <div className="grid items-start gap-6 lg:grid-cols-3">
        <SectionCard
          className="lg:col-span-2"
          title="Hizmetlerim"
          description={derived.activeServices.length ? "Aktif hizmetleriniz" : undefined}
          actions={
            <Link href={`${P}/hizmetlerim`} className={appButton({ variant: "ghost", size: "sm" })}>
              Tümü
              <ArrowRight aria-hidden />
            </Link>
          }
          flush
        >
          <DataTable
            framed={false}
            columns={serviceColumns}
            data={servicesPreview.slice(0, 5)}
            pageSize={0}
            rowHref={(s) => `${P}/hizmetlerim/${s.id}`}
            caption="Hizmetlerim"
            mobileCard={(s) => (
              <ListRow
                title={s.product.name}
                subtitle={s.domain || s.label || "—"}
                trailing={<StatusBadge kind="service" status={s.status} />}
                meta={<span>Sonraki ödeme {formatDate(s.nextDueDate)}</span>}
              />
            )}
            emptyState={
              <EmptyState
                compact
                className="m-4"
                icon={Package}
                title="Henüz hizmetiniz yok"
                description="Hosting, sunucu veya alan adı alarak başlayabilirsiniz."
                action={
                  <Link href="/hosting/linux" className={appButton({ size: "sm" })}>
                    Paketleri incele
                  </Link>
                }
              />
            }
          />
        </SectionCard>

        <div className="space-y-6">
          <SectionCard title="Yaklaşan yenilemeler" description="Önümüzdeki 30 gün">
            {derived.renewals.length ? (
              <ul className="-my-1 divide-y divide-dashed">
                {derived.renewals.slice(0, 5).map((r) => {
                  const days = daysUntil(r.date) ?? 0;
                  return (
                    <li key={r.key}>
                      <Link
                        href={r.href}
                        className="-mx-2 flex items-center gap-3 rounded-md px-2 py-2.5 transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        <r.icon aria-hidden className="size-4 shrink-0 text-muted-foreground" />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium">{r.title}</span>
                          <span className="block truncate text-xs text-muted-foreground">{r.subtitle}</span>
                        </span>
                        <span className="shrink-0 text-right">
                          <span className="block text-xs font-medium tabular-nums">{days === 0 ? "Bugün" : `${days} gün`}</span>
                          <span className="block font-mono text-[10px] text-muted-foreground">{formatDate(r.date)}</span>
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <div className="flex items-center gap-3 text-sm text-muted-foreground">
                <CalendarClock aria-hidden className="size-4" />
                30 gün içinde yenilenecek hizmet yok.
              </div>
            )}
          </SectionCard>

          <SectionCard title="Hesap bakiyesi">
            <div className="flex items-end justify-between gap-3">
              <div>
                <p className="text-2xl font-semibold tabular-nums tracking-tight">{money(stats.balance)}</p>
                <p className="mt-1 text-xs text-muted-foreground">Fatura ödemelerinde kullanılabilir.</p>
              </div>
              <Link href={`${P}/kredi`} className={appButton({ variant: "outline", size: "sm" })}>
                <Wallet aria-hidden />
                Bakiye yükle
              </Link>
            </div>
          </SectionCard>
        </div>
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-2">
        <SectionCard
          title="Son faturalar"
          actions={
            <Link href={`${P}/faturalar`} className={appButton({ variant: "ghost", size: "sm" })}>
              Tümü
              <ArrowRight aria-hidden />
            </Link>
          }
          flush
        >
          {invoices.length ? (
            <ul className="divide-y">
              {invoices.slice(0, 5).map((inv) => (
                <li key={inv.id}>
                  <Link
                    href={`${P}/faturalar/${inv.id}`}
                    className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/40 focus-visible:bg-muted/40 focus-visible:outline-none md:px-5"
                  >
                    <FileText aria-hidden className="size-4 shrink-0 text-muted-foreground" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-mono text-[13px] font-medium">{inv.invoiceNumber}</span>
                      <span className="block text-xs text-muted-foreground">Son ödeme {formatDate(inv.dueDate)}</span>
                    </span>
                    <span className="hidden shrink-0 text-sm font-medium tabular-nums sm:block">{money(inv.totalAmount)}</span>
                    <StatusBadge kind="invoice" status={inv.status} />
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState compact className="m-4" icon={FileText} title="Henüz faturanız yok" />
          )}
        </SectionCard>

        <SectionCard
          title="Destek talepleri"
          actions={
            <Link href={`${P}/destek/yeni`} className={appButton({ variant: "outline", size: "sm" })}>
              <Plus aria-hidden />
              Yeni talep
            </Link>
          }
          flush
        >
          {derived.openTickets.length ? (
            <ul className="divide-y">
              {derived.openTickets.slice(0, 5).map((t) => (
                <li key={t.id}>
                  <Link
                    href={`${P}/destek/${t.id}`}
                    className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/40 focus-visible:bg-muted/40 focus-visible:outline-none md:px-5"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{t.subject}</span>
                      <span className="block truncate text-xs text-muted-foreground">
                        <span className="font-mono">#{t.ticketNumber}</span> · {enumLabel("ticketDepartment", t.department)} ·{" "}
                        {formatDateTime(t.updatedAt)}
                      </span>
                    </span>
                    <StatusBadge kind="ticket" status={t.status} />
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState
              compact
              className="m-4"
              icon={Headphones}
              title="Açık destek talebiniz yok"
              description="Bir sorun yaşarsanız yeni talep oluşturabilirsiniz."
            />
          )}
        </SectionCard>
      </div>
    </>
  );
}
