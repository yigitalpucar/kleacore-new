import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  AppBreadcrumbLabel,
  DetailList,
  PageHeader,
  SectionCard,
  StatusBadge,
  appButton,
} from "@/components/app";
import { getManualProvisioningTask } from "@/lib/dal/manual-provisioning";
import { billingPeriodLabel, formatDateTime } from "@/lib/format/date";
import { getManualSlaHours } from "@/lib/provisioning/manual";
import { SLA_LABELS, formatWaiting, slaState } from "@/lib/provisioning/sla";
import { ActivationForm } from "./activation-form";
import { requirePermission } from "@/lib/utils/auth-helpers";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Kurulum görevi" };

type Delivery = {
  ipAddress?: string | null;
  hostname?: string | null;
  username?: string | null;
  panelUrl?: string | null;
  passwordDelivery?: "included" | "separately";
  passwordEncrypted?: string | null;
  notes?: string | null;
  activatedAt?: string;
};

export default async function KurulumDetayPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePermission("provisioning.manage");
  const { id } = await params;
  const [task, slaHours] = await Promise.all([getManualProvisioningTask(id), getManualSlaHours()]);
  if (!task) notFound();

  const { order } = task;
  const customer = order.customer;
  const customerName = customer.companyName || `${customer.name} ${customer.surname}`.trim() || customer.email;
  const done = task.status === "COMPLETED";
  const waitingMs = (task.completedAt?.getTime() ?? Date.now()) - task.createdAt.getTime();
  const sla = SLA_LABELS[slaState(waitingMs, slaHours)];
  const delivery = (task.deliveryDetails ?? {}) as Delivery;
  const isServer = ["vds", "vps", "server", "cloud", "datacenter"].includes(order.product.category.slug);
  // What the customer chose at checkout (VDS configurator): hostname + config options.
  const itemConfig = (order.items[0]?.configuration ?? {}) as {
    hostname?: string;
    configOptions?: Array<{ name?: string; label?: string }>;
  };
  const requestedHostname = typeof itemConfig.hostname === "string" ? itemConfig.hostname : null;
  const chosenOptions = Array.isArray(itemConfig.configOptions)
    ? itemConfig.configOptions.filter((line) => typeof line?.name === "string" && typeof line?.label === "string")
    : [];

  return (
    <>
      <AppBreadcrumbLabel segment={task.id} label={order.orderNumber} />
      <PageHeader
        back={{ href: "/yonetim/kurulumlar", label: "Kurulum görevleri" }}
        eyebrow="Manuel kurulum"
        title={`${order.product.name} — ${order.orderNumber}`}
        description={customerName}
        meta={
          <>
            <StatusBadge size="md" tone={done ? "success" : "warning"} label={done ? "Tamamlandı" : "Kurulum bekliyor"} />
            <StatusBadge size="md" tone={sla.tone} label={`${done ? "Teslim süresi" : "Bekleme"}: ${formatWaiting(waitingMs)}`} />
            <span>Hedef {slaHours} saat</span>
          </>
        }
        actions={
          <Link href={`/yonetim/siparisler/${order.id}`} className={appButton({ variant: "outline" })}>
            Siparişi aç
          </Link>
        }
      />

      <div className="grid items-start gap-6 lg:grid-cols-3">
        <div className="min-w-0 space-y-6 lg:col-span-2">
          {done ? (
            <SectionCard title="Teslim bilgileri" description={task.completedAt ? `Aktifleştirildi ${formatDateTime(task.completedAt)}` : undefined}>
              <DetailList
                items={[
                  { label: "IP adresi", value: delivery.ipAddress, mono: true, copy: delivery.ipAddress ?? undefined },
                  { label: "Sunucu adı", value: delivery.hostname, mono: true },
                  { label: "Kullanıcı adı", value: delivery.username, mono: true },
                  { label: "Panel adresi", value: delivery.panelUrl, mono: true },
                  {
                    label: "İlk şifre",
                    value:
                      delivery.passwordDelivery === "separately"
                        ? "Müşteriye ayrıca iletildi"
                        : delivery.passwordEncrypted
                          ? "Müşteriye e-postayla gönderildi (şifreli saklanıyor)"
                          : null,
                  },
                  { label: "Notlar", value: delivery.notes },
                ]}
              />
            </SectionCard>
          ) : (
            <ActivationForm
              taskId={task.id}
              isServer={isServer}
              defaultUsername={isServer ? "root" : (task.service?.username ?? "")}
              defaultHostname={requestedHostname ?? ""}
            />
          )}
        </div>

        <div className="space-y-6">
          <SectionCard title="Sipariş">
            <DetailList
              items={[
                { label: "Sipariş no", value: order.orderNumber, mono: true },
                { label: "Ürün", value: `${order.product.name} (${order.product.category.name})` },
                { label: "Alan adı", value: task.service?.domain ?? order.domain, mono: true },
                { label: "Dönem", value: billingPeriodLabel(order.billingPeriod) },
                { label: "Fatura", value: order.invoice?.invoiceNumber, mono: true },
                { label: "Ödeme", value: order.invoice?.paidAt ? formatDateTime(order.invoice.paidAt) : formatDateTime(task.createdAt) },
                { label: "İstenen sunucu adı", value: requestedHostname, mono: true },
                ...chosenOptions.map((line) => ({ label: line.name as string, value: line.label as string })),
                { label: "Müşteri notu", value: order.customerNotes },
              ]}
            />
          </SectionCard>
          <SectionCard title="Müşteri">
            <DetailList
              items={[
                { label: "Ad", value: customerName },
                { label: "E-posta", value: customer.email, copy: customer.email },
                { label: "Telefon", value: customer.phone, mono: true },
              ]}
            />
            <Link href={`/yonetim/musteriler/${customer.id}`} className={`${appButton({ variant: "ghost", size: "sm" })} mt-3`}>
              Müşteri kaydı
            </Link>
          </SectionCard>
        </div>
      </div>
    </>
  );
}
