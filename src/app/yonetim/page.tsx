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
  getStatusMeta,
  type StatusTone,
} from "@/components/app";
import { DashboardRecentOrders } from "@/components/admin/dashboard-recent-orders";
import { ROLE_LABELS, canAccessRoute, hasPermission, isStaffRole, type Permission } from "@/lib/auth/permissions";
import { getActivityLogs } from "@/lib/dal/activity-logs";
import {
  OPEN_TICKET_STATUSES,
  cacheMinute,
  getCurrentMrr,
  getDailySeries,
  getOpenTicketsByStatus,
  getOverdueReceivables,
  getPendingFraudReviews,
  getPendingKycCount,
  getPendingManualProvisioning,
  getRevenueSummary,
} from "@/lib/dal/admin-overview";
import { getAdminDashboardStats } from "@/lib/dal/dashboard";
import { getOrderStats } from "@/lib/dal/orders";
import { getServiceStats } from "@/lib/dal/services";
import { formatTRY } from "@/lib/format/price";
import { daysUntil, formatDate, formatDateLong, formatDateTime } from "@/lib/format/date";
import { dayLabel } from "@/lib/reports/range";
import { cn } from "@/lib/utils";
import { toNumber } from "@/lib/money";
import { requireStaff } from "@/lib/utils/auth-helpers";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Genel bakış" };

const money = (n: number | string) => formatTRY(toNumber(n), { keepDecimals: true });
const num = (n: number) => n.toLocaleString("tr-TR");

function customerName(c: { name: string; surname: string } | null | undefined) {
  return c ? `${c.name} ${c.surname}`.trim() : "—";
}

/** Skip a query the viewer may not see. */
const when = <T,>(condition: boolean, load: () => Promise<T>): Promise<T | null> => (condition ? load() : Promise.resolve(null));

const TICKET_TONES: Record<string, StatusTone> = {
  OPEN: "warning",
  CUSTOMER_REPLY: "danger",
  ADMIN_REPLY: "info",
  WAITING: "muted",
};

export default async function AdminDashboard() {
  // Any staff role sees the dashboard; each block is loaded and shown only with its permission.
  const session = await requireStaff();
  const role = session.user.role;
  const can = (permission: Permission) => hasPermission(role, permission);
  const canOpen = (href: string) => canAccessRoute(role, href);
  const showFinance = can("invoices.view");
  const showMrr = can("reports.view");
  const showOrders = can("orders.view");
  const showActivity = can("activity.view");
  const showTickets = can("tickets.view");
  const showCustomers = can("customers.view");
  const showServices = can("services.view");

  const now = new Date();
  const minute = cacheMinute(now);

  const [data, orderStats, serviceStats, revenue, mrr, overdue, tickets, manualJobs, kycPending, fraudPending, series, activity] =
    await Promise.all([
      getAdminDashboardStats(),
      when(showOrders, getOrderStats),
      when(showServices, getServiceStats),
      when(showFinance, () => getRevenueSummary(minute)),
      when(showMrr, () => getCurrentMrr()),
      when(showFinance, () => getOverdueReceivables()),
      when(showTickets, getOpenTicketsByStatus),
      when(can("provisioning.manage"), getPendingManualProvisioning),
      when(can("kyc.review"), getPendingKycCount),
      when(showOrders, getPendingFraudReviews),
      when(showFinance || showCustomers, () => getDailySeries(minute, 30)),
      when(showActivity, () => getActivityLogs({ page: 1, perPage: 6 })),
    ]);

  const recentOrders = data.recentOrders.map((o) => ({
    id: o.id,
    orderNumber: o.orderNumber,
    status: o.status,
    totalAmount: Number(o.totalAmount),
    createdAt: o.createdAt.toISOString(),
    productName: o.product?.name ?? null,
    customer: o.customer ? { id: o.customer.id, name: customerName(o.customer) } : null,
  }));

  const ticketTotal = tickets ? Object.values(tickets).reduce((s, v) => s + v, 0) : 0;

  const queueAll: { label: string; value: number | null; href: string; tone: StatusTone; hint: string }[] = [
    { label: "Onay bekleyen sipariş", value: orderStats?.pending ?? null, href: "/yonetim/siparisler/beklemede", tone: "warning", hint: "Beklemede" },
    { label: "Risk incelemesi", value: fraudPending, href: "/yonetim/siparisler/inceleme", tone: "danger", hint: "Dolandırıcılık puanı eşiği aştı" },
    { label: "Kimlik doğrulama (KYC)", value: kycPending, href: "/yonetim/kyc", tone: "warning", hint: "Belge incelemesi bekliyor" },
    { label: "Manuel kurulum", value: manualJobs, href: "/yonetim/kurulumlar", tone: "info", hint: "Otomasyonu olmayan hizmetler" },
    { label: "Yanıt bekleyen talep", value: tickets ? tickets.OPEN + tickets.CUSTOMER_REPLY : null, href: "/yonetim/destek", tone: "warning", hint: "Açık veya müşteri yanıtladı" },
    { label: "Askıdaki hizmet", value: serviceStats?.suspended ?? null, href: "/yonetim/hizmetler/askida", tone: "warning", hint: "Erişim kapalı" },
  ];
  const queue = queueAll.filter((t): t is typeof t & { value: number } => t.value !== null && canOpen(t.href));

  const revenueChart = series?.revenue.map((p) => ({ label: dayLabel(p.day, true), value: p.value })) ?? [];
  const revenue30 = series ? series.revenue.reduce((s, p) => s + p.value, 0) : 0;
  const revenueNet30 = series ? series.revenueNet.reduce((s, p) => s + p.value, 0) : 0;
  const signupChart = series?.signups.map((p) => ({ label: dayLabel(p.day, true), value: p.value })) ?? [];
  const signups30 = series ? series.signups.reduce((s, p) => s + p.value, 0) : 0;

  const periodHint = (t: { net: string; tax: string; count: number }) =>
    t.count ? `Net ${money(t.net)} + KDV ${money(t.tax)} · ${num(t.count)} fatura` : "Ödenen fatura yok";

  return (
    <>
      <PageHeader
        title="Genel bakış"
        description={`${formatDateLong(now)} itibarıyla tahsilat, bekleyen işler ve destek durumu.`}
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

      {revenue || mrr || overdue ? (
        <StatGrid columns={4}>
          {revenue ? (
            <StatCard label="Bugün tahsilat" value={money(revenue.today.gross)} hint={periodHint(revenue.today)} href="/yonetim/faturalar/odendi" />
          ) : null}
          {revenue ? (
            <StatCard label="Bu ay tahsilat" value={money(revenue.month.gross)} hint={periodHint(revenue.month)} href="/yonetim/faturalar/odendi" />
          ) : null}
          {mrr ? (
            <StatCard
              label="MRR"
              value={money(mrr.mrr)}
              hint={`KDV hariç · ARR ${money(mrr.arr)} · ${num(mrr.customers)} müşteri`}
              href="/yonetim/raporlar?tab=mrr"
            />
          ) : null}
          {overdue ? (
            <StatCard
              label="Gecikmiş alacak"
              value={money(overdue.amount)}
              hint={overdue.count ? `${num(overdue.count)} gecikmiş fatura (kalan tutar, KDV dahil)` : "Gecikmiş fatura yok"}
              tone={overdue.count ? "danger" : undefined}
              href="/yonetim/faturalar/gecikmis"
            />
          ) : null}
        </StatGrid>
      ) : (
        <StatGrid columns={3}>
          {showServices && serviceStats ? (
            <StatCard
              label="Aktif hizmet"
              value={num(serviceStats.active)}
              hint={`${num(serviceStats.total)} hizmetin ${num(serviceStats.suspended)} tanesi askıda`}
              href="/yonetim/hizmetler/aktif"
            />
          ) : null}
          {showCustomers ? (
            <StatCard
              label="Müşteri"
              value={num(data.totalCustomers)}
              hint={data.newCustomersThisMonth ? `Bu ay ${num(data.newCustomersThisMonth)} yeni kayıt` : "Bu ay yeni kayıt yok"}
              href="/yonetim/musteriler"
            />
          ) : null}
          {showTickets ? (
            <StatCard label="Açık talep" value={num(ticketTotal)} hint="Kapatılmamış destek talepleri" href="/yonetim/destek" />
          ) : null}
        </StatGrid>
      )}

      <div className={cn("grid items-start gap-6", (series && showFinance) || queue.length ? "lg:grid-cols-3" : undefined)}>
        {series && showFinance ? (
          <ChartCard
            className="lg:col-span-2"
            title="Son 30 gün tahsilat"
            description={`Ödenen faturalar, KDV dahil · toplam ${money(revenue30)} (net ${money(revenueNet30)})`}
            data={revenueChart}
            formatValue={(n) => formatTRY(n)}
            height={180}
            labelEvery={5}
            emptyText="Son 30 günde ödenmiş fatura yok."
            actions={
              showMrr ? (
                <Link href="/yonetim/raporlar?period=30days" className={appButton({ variant: "ghost", size: "sm" })}>
                  Raporlar
                  <ArrowRight aria-hidden />
                </Link>
              ) : undefined
            }
          />
        ) : null}

        {queue.length ? (
          <SectionCard
            title="Bekleyen işler"
            description="Müdahale gerektiren kayıtlar"
            flush
            className={series && showFinance ? undefined : "lg:col-span-3"}
          >
            <ul className="divide-y">
              {queue.map((t) => (
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
        ) : null}
      </div>

      {(tickets || (series && showCustomers)) && (
        <div className={cn("grid items-start gap-6", tickets && series && showCustomers && "lg:grid-cols-3")}>
          {series && showCustomers ? (
            <ChartCard
              className={tickets ? "lg:col-span-2" : undefined}
              title="Yeni müşteriler"
              description={`Son 30 günde ${num(signups30)} kayıt`}
              data={signupChart}
              height={140}
              labelEvery={5}
              emptyText="Son 30 günde yeni kayıt yok."
              actions={
                <Link href="/yonetim/musteriler/tum-musteriler" className={appButton({ variant: "ghost", size: "sm" })}>
                  Müşteriler
                  <ArrowRight aria-hidden />
                </Link>
              }
            />
          ) : null}

          {tickets ? (
            <SectionCard
              title="Açık destek talepleri"
              description={ticketTotal ? `${num(ticketTotal)} talep kapatılmadı` : "Açık talep yok"}
              flush
              actions={
                <Link href="/yonetim/destek" className={appButton({ variant: "ghost", size: "sm" })}>
                  Tümü
                  <ArrowRight aria-hidden />
                </Link>
              }
            >
              <ul className="divide-y">
                {OPEN_TICKET_STATUSES.map((status) => {
                  const meta = getStatusMeta("ticket", status, "admin");
                  const value = tickets[status] ?? 0;
                  return (
                    <li key={status}>
                      <Link
                        href={`/yonetim/destek?status=${status}`}
                        className="group flex min-h-[48px] items-center gap-3 px-4 py-2 transition-colors hover:bg-muted/40 focus-visible:bg-muted/40 focus-visible:outline-none md:px-5"
                      >
                        <ToneDot tone={value ? TICKET_TONES[status] : "muted"} />
                        <span className="min-w-0 flex-1 truncate text-sm">{meta.label}</span>
                        <span className="relative hidden h-1.5 w-20 overflow-hidden rounded-full bg-muted sm:block" aria-hidden>
                          <span
                            className="absolute inset-y-0 left-0 rounded-full bg-foreground/70"
                            style={{ width: `${ticketTotal ? (value / ticketTotal) * 100 : 0}%` }}
                          />
                        </span>
                        <span className={cn("w-8 text-right font-mono tabular-nums", value ? "text-foreground" : "text-muted-foreground")}>
                          {num(value)}
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </SectionCard>
          ) : null}
        </div>
      )}

      {(showOrders || showFinance) && (
        <div className={cn("grid items-start gap-6", showOrders && showFinance && "lg:grid-cols-5")}>
          {showOrders && orderStats ? (
            <SectionCard
              className={showFinance ? "lg:col-span-3" : undefined}
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
          ) : null}

          {showFinance ? (
            <SectionCard
              className={showOrders ? "lg:col-span-2" : undefined}
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
          ) : null}
        </div>
      )}

      {activity ? (
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
                      <span className="text-muted-foreground">
                        {" · "}
                        {log.user && isStaffRole(log.user.role) ? ROLE_LABELS[log.user.role].toLocaleLowerCase("tr-TR") : "müşteri"}
                      </span>
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
      ) : null}
    </>
  );
}
