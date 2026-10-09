import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, CalendarClock, FilePlus, ScrollText, UserPlus } from "lucide-react";
import {
  ChartCard,
  EmptyState,
  PageHeader,
  SectionCard,
  StatCard,
  StatGrid,
  StatusBadge,
  ToneDot,
  appButton,
  type StatusTone,
} from "@/components/app";
import { DashboardRecentOrders } from "@/components/admin/dashboard-recent-orders";
import { ROLE_LABELS, canAccessRoute, hasPermission, isStaffRole, type Permission } from "@/lib/auth/permissions";
import { getActivityLogs } from "@/lib/dal/activity-logs";
import { getAdminDashboardStats } from "@/lib/dal/dashboard";
import { getInvoiceStats } from "@/lib/dal/invoices";
import { getOrderStats } from "@/lib/dal/orders";
import { getRevenueReport } from "@/lib/dal/reports";
import { getServiceStats } from "@/lib/dal/services";
import { formatTRY } from "@/lib/format/price";
import { daysUntil, formatDate, formatDateLong, formatDateTime } from "@/lib/format/date";
import { cn } from "@/lib/utils";
import { add, money as toMoney, sum, toNumber } from "@/lib/money";
import { requireStaff } from "@/lib/utils/auth-helpers";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Genel bakış" };

const TZ = "Europe/Istanbul";
const money = (n: number) => formatTRY(n, { keepDecimals: true });
const num = (n: number) => n.toLocaleString("tr-TR");

const monthKeyFmt = new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit" });
const monthLabelFmt = new Intl.DateTimeFormat("tr-TR", { timeZone: TZ, month: "short" });

/** Last `count` calendar months (Istanbul), oldest first: { key: "2026-10", label: "Eki" }. */
function lastMonths(now: Date, count: number) {
  const out: { key: string; label: string }[] = [];
  for (let i = count - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 15));
    out.push({ key: monthKeyFmt.format(d).slice(0, 7), label: monthLabelFmt.format(d) });
  }
  return out;
}

function customerName(c: { name: string; surname: string } | null | undefined) {
  return c ? `${c.name} ${c.surname}`.trim() : "—";
}

export default async function AdminDashboard() {
  // Any staff role sees the dashboard; each block is shown only with its permission.
  const session = await requireStaff();
  const role = session.user.role;
  const can = (permission: Permission) => hasPermission(role, permission);
  const canOpen = (href: string) => canAccessRoute(role, href);
  const showFinance = can("invoices.view");
  const showOrders = can("orders.view");
  const showActivity = can("activity.view");

  const now = new Date();
  const months = lastMonths(now, 6);
  const chartFrom = new Date(now.getFullYear(), now.getMonth() - 5, 1);

  const [data, orderStats, invoiceStats, serviceStats, revenue, activity] = await Promise.all([
    getAdminDashboardStats(),
    getOrderStats(),
    getInvoiceStats(),
    getServiceStats(),
    getRevenueReport({ from: chartFrom, to: now }),
    getActivityLogs({ page: 1, perPage: 6 }),
  ]);

  // Monthly collections from paid invoices (paidAmount by paidAt month).
  const byMonth = new Map(months.map((m) => [m.key, toMoney(0)]));
  for (const inv of revenue.paidInvoices) {
    if (!inv.paidAt) continue;
    const key = monthKeyFmt.format(inv.paidAt).slice(0, 7);
    if (byMonth.has(key)) byMonth.set(key, add(byMonth.get(key), inv.paidAmount));
  }
  const chartData = months.map((m) => ({ label: m.label, value: toNumber(byMonth.get(m.key)) }));
  const sixMonthTotal = toNumber(sum(chartData.map((d) => d.value)));

  const recentOrders = data.recentOrders.map((o) => ({
    id: o.id,
    orderNumber: o.orderNumber,
    status: o.status,
    totalAmount: Number(o.totalAmount),
    createdAt: o.createdAt.toISOString(),
    productName: o.product?.name ?? null,
    customer: o.customer ? { id: o.customer.id, name: customerName(o.customer) } : null,
  }));

  const todoAll: { label: string; value: number; href: string; tone: StatusTone; hint: string }[] = [
    { label: "Onay bekleyen sipariş", value: orderStats.pending, href: "/yonetim/siparisler/beklemede", tone: "warning", hint: "Beklemede" },
    { label: "İşlemdeki sipariş", value: orderStats.processing, href: "/yonetim/siparisler/tum-siparisler", tone: "info", hint: "Kurulum sürüyor" },
    { label: "Yanıt bekleyen talep", value: data.pendingTickets, href: "/yonetim/destek", tone: "warning", hint: "Açık veya müşteri yanıtladı" },
    { label: "Gecikmiş fatura", value: invoiceStats.overdue, href: "/yonetim/faturalar/gecikmis", tone: "danger", hint: "Vadesi geçti" },
    { label: "Askıdaki hizmet", value: serviceStats.suspended, href: "/yonetim/hizmetler/askida", tone: "warning", hint: "Erişim kapalı" },
  ];
  const todo = todoAll.filter((t) => canOpen(t.href));

  const invoiceMix = [
    { label: "Ödendi", value: invoiceStats.paid, tone: "success" as const, cls: "bg-foreground" },
    { label: "Bekleyen", value: invoiceStats.pending, tone: "warning" as const, cls: "bg-foreground/45" },
    { label: "Gecikmiş", value: invoiceStats.overdue, tone: "danger" as const, cls: "bg-foreground/20" },
  ];
  const mixTotal = invoiceMix.reduce((s, x) => s + x.value, 0);

  return (
    <>
      <PageHeader
        title="Genel bakış"
        description={`${formatDateLong(now)} itibarıyla satış, tahsilat ve destek durumu.`}
        actions={
          <>
            {can("customers.edit") && (
              <Link href="/yonetim/musteri-ekle" prefetch={false} className={appButton({ variant: "outline" })}>
                <UserPlus aria-hidden />
                Müşteri ekle
              </Link>
            )}
            {can("invoices.edit") && (
              <Link href="/yonetim/faturalar/olustur" className={appButton()}>
                <FilePlus aria-hidden />
                Fatura oluştur
              </Link>
            )}
          </>
        }
      />

      <StatGrid columns={4}>
        {showFinance && (
          <StatCard
          label="Bu ay tahsilat"
          value={money(Number(data.monthlyRevenue))}
          hint={`Toplam tahsilat ${money(Number(data.totalRevenue))}`}
          href="/yonetim/faturalar/odendi"
          />
        )}
        {showFinance && (
          <StatCard
          label="Açık alacak"
          value={money(Math.max(0, Number(invoiceStats.unpaidAmount)))}
          hint={
            invoiceStats.overdue
              ? `${num(invoiceStats.overdue)} gecikmiş, ${num(invoiceStats.pending)} bekleyen fatura`
              : `${num(invoiceStats.pending)} bekleyen fatura`
          }
          tone={invoiceStats.overdue ? "danger" : undefined}
          href="/yonetim/faturalar/bekleyen"
          />
        )}
        {canOpen("/yonetim/hizmetler") && (
          <StatCard
          label="Aktif hizmet"
          value={num(serviceStats.active)}
          hint={`${num(serviceStats.total)} hizmetin ${num(serviceStats.suspended)} tanesi askıda`}
          tone={serviceStats.suspended ? "warning" : undefined}
          href="/yonetim/hizmetler/aktif"
          />
        )}
        {canOpen("/yonetim/musteriler") && (
          <StatCard
          label="Müşteri"
          value={num(data.totalCustomers)}
          hint={data.newCustomersThisMonth ? `Bu ay ${num(data.newCustomersThisMonth)} yeni kayıt` : "Bu ay yeni kayıt yok"}
          href="/yonetim/musteriler"
          />
        )}
      </StatGrid>

      <div className={cn("grid items-start gap-6", showFinance && "lg:grid-cols-3")}>
        {showFinance && (
        <ChartCard
          className="lg:col-span-2"
          title="Aylık tahsilat"
          description={`Son 6 ayda ödenen faturalar · toplam ${money(sixMonthTotal)}`}
          data={chartData}
          formatValue={(n) => formatTRY(n)}
          height={200}
          emptyText="Son 6 ayda ödenmiş fatura yok."
          actions={
            can("reports.view") ? (
              <Link href="/yonetim/raporlar" className={appButton({ variant: "ghost", size: "sm" })}>
                Raporlar
                <ArrowRight aria-hidden />
              </Link>
            ) : undefined
          }
        />
        )}

        <SectionCard title="Bekleyen işler" description="Müdahale gerektiren kayıtlar" flush>
          <ul className="divide-y">
            {todo.map((t) => (
              <li key={t.label}>
                <Link
                  href={t.href}
                  className="group flex min-h-[52px] items-center gap-3 px-4 py-2.5 transition-colors hover:bg-muted/40 focus-visible:bg-muted/40 focus-visible:outline-none md:px-5"
                >
                  <ToneDot tone={t.value ? t.tone : "muted"} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm">{t.label}</span>
                    <span className="block truncate text-xs text-muted-foreground">{t.hint}</span>
                  </span>
                  <span className={cn("font-mono text-base tabular-nums", t.value ? "text-foreground" : "text-muted-foreground")}>
                    {num(t.value)}
                  </span>
                  <ArrowRight aria-hidden className="size-4 text-muted-foreground/50 transition-colors group-hover:text-foreground" />
                </Link>
              </li>
            ))}
          </ul>
        </SectionCard>
      </div>

      {(showOrders || showFinance) && (
      <div className={cn("grid items-start gap-6", showOrders && showFinance && "lg:grid-cols-3")}>
        {showOrders && (
        <SectionCard
          className={showFinance ? "lg:col-span-2" : undefined}
          title="Son siparişler"
          description={`Toplam ${num(orderStats.total)} sipariş, ${num(orderStats.completed)} tamamlandı`}
          flush
          actions={
            <Link href="/yonetim/siparisler/tum-siparisler" className={appButton({ variant: "ghost", size: "sm" })}>
              Tümü
              <ArrowRight aria-hidden />
            </Link>
          }
        >
          <DashboardRecentOrders orders={recentOrders} />
        </SectionCard>
        )}

        {showFinance && (
        <SectionCard title="Fatura durumu" description={`${num(invoiceStats.total)} fatura`}>
          {mixTotal > 0 ? (
            <div className="space-y-4">
              <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-muted" aria-hidden>
                {invoiceMix.map((m) =>
                  m.value ? (
                    <span key={m.label} className={cn("h-full", m.cls)} style={{ width: `${(m.value / mixTotal) * 100}%` }} />
                  ) : null
                )}
              </div>
              <dl className="space-y-2.5">
                {invoiceMix.map((m) => (
                  <div key={m.label} className="flex items-center gap-2 text-sm">
                    <span aria-hidden className={cn("size-2.5 shrink-0 rounded-sm", m.cls)} />
                    <dt className="flex-1 text-muted-foreground">{m.label}</dt>
                    <dd className="font-mono tabular-nums">
                      {num(m.value)}
                      <span className="ml-2 text-xs text-muted-foreground">%{Math.round((m.value / mixTotal) * 100)}</span>
                    </dd>
                  </div>
                ))}
              </dl>
              <p className="border-t border-dashed pt-3 text-xs text-muted-foreground">
                Tahsil edilen {money(Number(invoiceStats.paidAmount))} · Kesilen {money(Number(invoiceStats.totalAmount))}
              </p>
            </div>
          ) : (
            <EmptyState compact title="Henüz fatura yok" />
          )}
        </SectionCard>
        )}
      </div>
      )}

      {(showFinance || showActivity) && (
      <div className={cn("grid items-start gap-6", showFinance && showActivity && "lg:grid-cols-2")}>
        {showFinance && (
        <SectionCard
          title="Yaklaşan ödemeler"
          description="30 gün içinde vadesi dolan veya geçmiş faturalar"
          flush
          actions={
            <Link href="/yonetim/faturalar/bekleyen" className={appButton({ variant: "ghost", size: "sm" })}>
              Tümü
              <ArrowRight aria-hidden />
            </Link>
          }
        >
          {data.upcomingInvoices.length ? (
            <ul className="divide-y">
              {data.upcomingInvoices.map((inv) => {
                const remaining = Math.max(0, Number(inv.totalAmount) - Number(inv.paidAmount));
                const days = daysUntil(inv.dueDate, now);
                return (
                  <li key={inv.id}>
                    <Link
                      href={`/yonetim/faturalar/${inv.id}`}
                      className="flex min-h-[56px] items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/40 focus-visible:bg-muted/40 focus-visible:outline-none md:px-5"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm">
                          <span className="font-mono text-[13px] font-medium">{inv.invoiceNumber}</span>
                          <span className="text-muted-foreground"> · {customerName(inv.customer)}</span>
                        </p>
                        <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                          <StatusBadge kind="invoice" status={inv.status} size="sm" />
                          <span>
                            {formatDate(inv.dueDate)}
                            {days !== null ? (days < 0 ? ` · ${-days} gün gecikti` : days === 0 ? " · bugün" : ` · ${days} gün kaldı`) : ""}
                          </span>
                        </p>
                      </div>
                      <span className="whitespace-nowrap text-sm font-medium tabular-nums">{money(remaining)}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          ) : (
            <div className="p-4 md:p-5">
              <EmptyState compact icon={CalendarClock} title="Yaklaşan ödeme yok" description="30 gün içinde vadesi dolan fatura bulunmuyor." />
            </div>
          )}
        </SectionCard>
        )}

        {showActivity && (
        <SectionCard
          title="Son aktivite"
          description="Panel ve müşteri işlemleri"
          flush
          actions={
            <Link href="/yonetim/aktivite" className={appButton({ variant: "ghost", size: "sm" })}>
              Tümü
              <ArrowRight aria-hidden />
            </Link>
          }
        >
          {activity.data.length ? (
            <ol className="relative px-4 py-4 md:px-5">
              <span aria-hidden className="absolute bottom-6 left-[20px] top-6 w-px border-l border-dashed md:left-[24px]" />
              {activity.data.map((log) => (
                <li key={log.id} className="relative flex gap-3 py-2">
                  <span className="relative z-[1] mt-1.5 flex size-2 shrink-0 items-center justify-center rounded-full bg-foreground ring-4 ring-card" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm">
                      <span className="font-medium">{log.user ? customerName(log.user) : "Sistem"}</span>
                      <span className="text-muted-foreground"> · {log.user && isStaffRole(log.user.role) ? ROLE_LABELS[log.user.role].toLocaleLowerCase("tr-TR") : "müşteri"}</span>
                    </p>
                    <p className="mt-0.5 truncate font-mono text-[12px] text-muted-foreground">
                      {log.entity} · {log.action}
                    </p>
                  </div>
                  <time dateTime={log.createdAt.toISOString()} className="shrink-0 text-xs tabular-nums text-muted-foreground">
                    {formatDateTime(log.createdAt)}
                  </time>
                </li>
              ))}
            </ol>
          ) : (
            <div className="p-4 md:p-5">
              <EmptyState compact icon={ScrollText} title="Kayıt yok" description="Henüz aktivite kaydı bulunmuyor." />
            </div>
          )}
        </SectionCard>
        )}
      </div>
      )}
    </>
  );
}
