import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowUpRight, FileText, Package } from "lucide-react";
import {
  AppBreadcrumbLabel,
  DetailList,
  EmptyState,
  IconTile,
  PageHeader,
  SectionCard,
  StatusBadge,
  enumLabel,
} from "@/components/app";
import { getOrderById } from "@/lib/dal/orders";
import { getOrderConsentRecords } from "@/lib/legal/documents";
import { formatTRY } from "@/lib/format/price";
import { billingPeriodLabel, formatDate, formatDateTime } from "@/lib/format/date";
import { OrderDetailActions } from "./content";
import { requirePermission } from "@/lib/utils/auth-helpers";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Sipariş detayı" };

const money = (n: unknown) => formatTRY(Number(n ?? 0), { keepDecimals: true });

export default async function OrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requirePermission("orders.view");
  const { id } = await params;
  const [order, consents] = await Promise.all([getOrderById(id), getOrderConsentRecords(id)]);

  if (!order) return notFound();

  const customerName = `${order.customer.name} ${order.customer.surname}`.trim();
  const discount = Number(order.discountAmount);
  const setupFee = Number(order.setupFee);

  return (
    <>
      <AppBreadcrumbLabel segment={order.id} label={order.orderNumber} />

      <PageHeader
        back={{ href: "/yonetim/siparisler/tum-siparisler", label: "Siparişler" }}
        eyebrow="Sipariş"
        title={<span className="font-mono">{order.orderNumber}</span>}
        meta={
          <>
            <StatusBadge kind="order" status={order.status} size="md" />
            <span>Oluşturulma: {formatDateTime(order.createdAt)}</span>
          </>
        }
        actions={<OrderDetailActions orderId={order.id} status={order.status} />}
      />

      <div className="grid items-start gap-6 lg:grid-cols-3">
        <div className="min-w-0 space-y-6 lg:col-span-2">
          <SectionCard title="Ürün" description={order.product.category?.name ?? undefined}>
            <div className="flex items-start gap-3">
              <IconTile>
                <Package />
              </IconTile>
              <div className="min-w-0 flex-1">
                <p className="font-medium">{order.product.name}</p>
                <p className="font-mono text-xs text-muted-foreground">{order.product.sku}</p>
                {order.domain ? <p className="mt-1 break-all text-sm text-muted-foreground">{order.domain}</p> : null}
              </div>
              <div className="shrink-0 text-right">
                <p className="font-semibold tabular-nums">{money(order.basePrice)}</p>
                <p className="text-xs text-muted-foreground">{billingPeriodLabel(order.billingPeriod)}</p>
              </div>
            </div>

            {order.items.length > 0 ? (
              <div className="mt-5">
                <p className="mb-2 font-mono text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
                  Sipariş kalemleri (KDV hariç)
                </p>
                <ul className="divide-y divide-dashed rounded-md border">
                  {order.items.map((item) => (
                    <li key={item.id} className="flex items-center justify-between gap-4 px-3 py-2.5 text-sm">
                      <span className="min-w-0">
                        <span className="break-words">{item.productName}</span>
                        <span className="ml-2 text-xs text-muted-foreground">× {item.quantity}</span>
                      </span>
                      <span className="shrink-0 font-medium tabular-nums">{money(item.totalPrice)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </SectionCard>

          <SectionCard title="Fiyat dökümü">
            <DetailList
              items={[
                { label: `Paket ücreti (${billingPeriodLabel(order.billingPeriod).toLocaleLowerCase("tr-TR")})`, value: money(order.basePrice) },
                { label: "Kurulum ücreti", value: setupFee > 0 ? money(setupFee) : null },
                {
                  label: order.promoCode ? `İndirim (${order.promoCode.code})` : "İndirim",
                  value: discount > 0 ? `−${money(discount)}` : null,
                },
                { label: `KDV (%${Number(order.taxRate)})`, value: money(order.taxAmount) },
              ]}
            />
            <div className="mt-3 flex items-center justify-between border-t pt-3">
              <span className="font-medium">Toplam</span>
              <span className="text-lg font-semibold tabular-nums">{money(order.totalAmount)}</span>
            </div>
          </SectionCard>

          <SectionCard
            title="Yasal onaylar"
            description="Müşterinin sipariş anında onayladığı metinler (sürüm, zaman, IP ve metnin SHA-256 özeti)."
          >
            {consents.length > 0 ? (
              <ul className="divide-y divide-dashed rounded-md border">
                {consents.map((consent) => (
                  <li key={consent.id} className="space-y-1 px-3 py-3 text-sm">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-medium">
                        {consent.document.title}{" "}
                        <span className="text-xs font-normal text-muted-foreground">v{consent.documentVersion}</span>
                        {consent.document.isPlaceholder ? (
                          <span className="ml-2 rounded-sm border border-amber-500/40 bg-amber-500/10 px-1.5 py-0.5 text-[11px] font-normal">
                            taslak metin
                          </span>
                        ) : null}
                      </span>
                      <time className="text-xs tabular-nums text-muted-foreground" dateTime={consent.acceptedAt.toISOString()}>
                        {formatDateTime(consent.acceptedAt)}
                      </time>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      IP: <span className="font-mono">{consent.ipAddress || "—"}</span>
                      {consent.userAgent ? <span className="block break-all">{consent.userAgent}</span> : null}
                    </p>
                    <p className="break-all font-mono text-[11px] text-muted-foreground">sha256: {consent.snapshotHash}</p>
                    <details className="text-xs">
                      <summary className="cursor-pointer text-muted-foreground hover:text-foreground">Onaylanan metni göster</summary>
                      <div
                        className="mt-2 max-h-96 overflow-y-auto rounded-md border bg-muted/30 p-3 [&_h2]:mt-3 [&_h2]:font-semibold [&_table]:w-full [&_td]:border [&_td]:px-1.5 [&_th]:border [&_th]:px-1.5"
                        // Stored snapshot rendered by renderLegalTemplate (variables escaped).
                        dangerouslySetInnerHTML={{ __html: consent.snapshot }}
                      />
                    </details>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState
                compact
                title="Onay kaydı yok"
                description="Bu sipariş sözleşme onayı zorunlu hale gelmeden önce veya yönetim panelinden oluşturulmuş."
              />
            )}
          </SectionCard>

          <SectionCard title="Sipariş geçmişi">
            {order.activities.length > 0 ? (
              <ol className="relative space-y-5 border-l border-dashed pl-5">
                {order.activities.map((activity) => (
                  <li key={activity.id} className="relative">
                    <span aria-hidden className="absolute -left-[25px] top-1.5 size-2 rounded-full border bg-background" />
                    <div className="flex flex-col gap-0.5 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                      <div className="min-w-0">
                        <p className="text-sm font-medium">{activity.description || activity.action}</p>
                        {activity.description ? (
                          <p className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">{activity.action}</p>
                        ) : null}
                      </div>
                      <time className="shrink-0 text-xs tabular-nums text-muted-foreground" dateTime={activity.createdAt.toISOString()}>
                        {formatDateTime(activity.createdAt)}
                      </time>
                    </div>
                  </li>
                ))}
              </ol>
            ) : (
              <EmptyState compact title="Henüz kayıt yok" description="Onay, kurulum ve iptal adımları burada görünür." />
            )}
          </SectionCard>
        </div>

        <div className="space-y-6">
          <SectionCard title="Sipariş bilgileri" headingLevel={2}>
            <DetailList
              items={[
                { label: "Durum", value: <StatusBadge kind="order" status={order.status} /> },
                { label: "Fatura dönemi", value: billingPeriodLabel(order.billingPeriod) },
                { label: "Adet", value: order.quantity > 1 ? String(order.quantity) : null },
                { label: "Oluşturulma", value: formatDate(order.createdAt) },
                { label: "Onaylanma", value: order.approvedAt ? formatDate(order.approvedAt) : null },
                { label: "Tamamlanma", value: order.completedAt ? formatDate(order.completedAt) : null },
                { label: "İptal tarihi", value: order.cancelledAt ? formatDate(order.cancelledAt) : null },
                { label: "İptal nedeni", value: order.cancellationReason || null },
                { label: "İade", value: order.refundedAt ? `${money(order.refundAmount)} · ${formatDate(order.refundedAt)}` : null },
              ]}
            />
          </SectionCard>

          <SectionCard title="Müşteri">
            <DetailList
              items={[
                {
                  label: "Ad soyad",
                  value: (
                    <Link href={`/yonetim/musteriler/${order.customer.id}`} className="hover:underline">
                      {customerName}
                    </Link>
                  ),
                },
                { label: "Firma", value: order.customer.companyName || null },
                { label: "Tür", value: enumLabel("customerType", order.customer.customerType) },
                { label: "E-posta", value: order.customer.email, copy: order.customer.email },
                { label: "Telefon", value: order.customer.phone || null },
              ]}
            />
          </SectionCard>

          <SectionCard title="Bağlantılı kayıtlar">
            <ul className="space-y-2">
              {order.invoice ? (
                <li>
                  <Link
                    href={`/yonetim/faturalar/${order.invoice.id}`}
                    className="flex min-h-11 items-center gap-3 rounded-md border px-3 py-2 transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <FileText aria-hidden className="size-4 shrink-0 text-muted-foreground" />
                    <span className="min-w-0 flex-1">
                      <span className="block font-mono text-[13px] font-medium">{order.invoice.invoiceNumber}</span>
                      <span className="block text-xs text-muted-foreground">Fatura · {money(order.invoice.totalAmount)}</span>
                    </span>
                    <StatusBadge kind="invoice" status={order.invoice.status} />
                  </Link>
                </li>
              ) : null}
              {order.serviceId ? (
                <li>
                  <Link
                    href={`/yonetim/hizmetler/${order.serviceId}`}
                    className="flex min-h-11 items-center gap-3 rounded-md border px-3 py-2 transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <Package aria-hidden className="size-4 shrink-0 text-muted-foreground" />
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-medium">Hizmet</span>
                      <span className="block truncate text-xs text-muted-foreground">{order.domain || order.product.name}</span>
                    </span>
                    <ArrowUpRight aria-hidden className="size-4 text-muted-foreground" />
                  </Link>
                </li>
              ) : null}
              {!order.invoice && !order.serviceId ? (
                <li className="text-sm text-muted-foreground">Bu siparişe bağlı fatura veya hizmet yok.</li>
              ) : null}
            </ul>
          </SectionCard>

          <SectionCard title="Notlar">
            <div className="space-y-3 text-sm">
              <div>
                <p className="text-xs text-muted-foreground">Müşteri notu</p>
                <p className="mt-0.5 whitespace-pre-line">{order.customerNotes || "—"}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Yönetici notu</p>
                <p className="mt-0.5 whitespace-pre-line">{order.adminNotes || "—"}</p>
              </div>
            </div>
          </SectionCard>
        </div>
      </div>
    </>
  );
}
