import { formatTRY } from "@/lib/format/price";
import type { EventType } from "../catalog";
import type { DispatchedEvent, EventSubscriber } from "./types";
import { isEvent } from "./types";

interface Alert {
  title: string;
  message: string;
  details?: { label: string; value: string }[];
  path?: string;
}

const money = (value: string | undefined) => (value ? formatTRY(Number(value), { keepDecimals: true }) : "—");

/** Staff alert content per event; null = nothing to alert for this payload. */
export function buildAdminAlert(event: DispatchedEvent): Alert | null {
  if (isEvent(event, "ticket.opened")) {
    const p = event.payload;
    return {
      title: `Yeni destek talebi: ${p.ticketNumber}`,
      message: `${p.customerName ?? "Bir müşteri"} yeni bir destek talebi açtı: ${p.subject}`,
      details: [
        ...(p.department ? [{ label: "Departman", value: p.department }] : []),
        ...(p.priority ? [{ label: "Öncelik", value: p.priority }] : []),
        ...(p.messagePreview ? [{ label: "Mesaj", value: p.messagePreview.slice(0, 600) }] : []),
      ],
      path: `/yonetim/destek/${p.ticketId}`,
    };
  }
  if (isEvent(event, "bank_transfer.submitted")) {
    const p = event.payload;
    return {
      title: `Havale bildirimi: ${p.invoiceNumber}`,
      message: "Bir müşteri havale/EFT ödeme bildirimi gönderdi; onay bekliyor.",
      details: [
        { label: "Fatura", value: p.invoiceNumber },
        { label: "Tutar", value: money(p.amount) },
        ...(p.senderName ? [{ label: "Gönderen", value: p.senderName }] : []),
      ],
      path: "/yonetim/faturalar/havale-bildirimleri",
    };
  }
  if (isEvent(event, "service.provisioning_failed")) {
    const p = event.payload;
    return {
      title: `Kurulum başarısız${p.orderNumber ? `: ${p.orderNumber}` : ""}`,
      message: "Otomatik kurulum tüm denemelerden sonra başarısız oldu; yönetici müdahalesi gerekli.",
      details: [{ label: "Hata", value: p.error.slice(0, 500) }],
      path: p.provisioningJobId ? `/yonetim/provisioning` : p.serviceId ? `/yonetim/hizmetler/${p.serviceId}` : undefined,
    };
  }
  if (isEvent(event, "backup.failed")) {
    const p = event.payload;
    const what = p.operation === "restore" ? "Geri yükleme" : p.trigger === "FINAL" ? "Fesih öncesi son yedek" : "Yedek";
    return {
      title: `${what} başarısız: ${p.serviceLabel}`,
      message:
        p.trigger === "FINAL" && p.operation === "backup"
          ? "Fesih öncesi son yedek alınamadı; VM silinmedi. Hizmet sayfasından yeniden deneyin veya yedeksiz silin."
          : `${what} tüm denemelerden sonra başarısız oldu.`,
      details: [{ label: "Hata", value: p.error.slice(0, 500) }],
      path: `/yonetim/hizmetler/${p.serviceId}`,
    };
  }
  if (isEvent(event, "payment.failed")) {
    const p = event.payload;
    if (!p.automatic) return null; // customer retries at checkout are not staff work
    return {
      title: `Otomatik tahsilat başarısız${p.invoiceNumber ? `: ${p.invoiceNumber}` : ""}`,
      message: "Kayıtlı karttan otomatik çekim başarısız oldu.",
      details: [
        { label: "Tutar", value: money(p.amount) },
        ...(p.reason ? [{ label: "Sebep", value: p.reason }] : []),
      ],
      path: `/yonetim/faturalar/${p.invoiceId}`,
    };
  }
  if (isEvent(event, "user.login_failed_locked")) {
    const p = event.payload;
    return {
      title: "Hesap kilitlendi (başarısız girişler)",
      message: `${p.email ?? p.userId} hesabı art arda başarısız giriş denemeleri nedeniyle geçici olarak kilitlendi.`,
      details: [
        ...(p.failedAttempts ? [{ label: "Deneme", value: String(p.failedAttempts) }] : []),
        ...(p.ipAddress ? [{ label: "IP", value: p.ipAddress }] : []),
      ],
      path: `/yonetim/musteriler/${p.userId}`,
    };
  }
  return null;
}

export const ADMIN_ALERT_EVENTS: readonly EventType[] = [
  "ticket.opened",
  "bank_transfer.submitted",
  "service.provisioning_failed",
  "backup.failed",
  "payment.failed",
  "user.login_failed_locked",
];

/** E-mail (and SMS when admin_notification_phone is set) to the staff address. */
export const adminAlertSubscriber: EventSubscriber = {
  name: "admin-alert",
  label: "Yönetim uyarısı",
  handles: (type) => ADMIN_ALERT_EVENTS.includes(type),
  async handle(event) {
    const alert = buildAdminAlert(event);
    if (!alert) return { skipped: "NOT_ALERTABLE" };

    const { getAdminNotificationRecipients } = await import("@/lib/provisioning/manual");
    const recipients = await getAdminNotificationRecipients();
    if (!recipients.email && !recipients.phone) return { skipped: "NO_ADMIN_RECIPIENT" };

    const { sendNotification } = await import("@/lib/notifications/send");
    const result = await sendNotification({
      template: "admin.event-alert",
      data: { ...alert, details: alert.details?.length ? alert.details : undefined, eventType: event.type },
      to: recipients.email,
      phone: recipients.phone,
      dedupeKey: `admin-alert:${event.id}`,
    });
    if (!result.ok) throw new Error(result.error ?? "NOTIFICATION_NOT_QUEUED");
    return { logIds: result.logIds, deduplicated: result.deduplicated };
  },
};
