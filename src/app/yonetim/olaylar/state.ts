import type { StatusTone } from "@/components/app";

/** Outbox event / delivery states → Turkish label + tone (local to /yonetim/olaylar). */
export const EVENT_STATE_META: Record<string, { label: string; tone: StatusTone }> = {
  PROCESSED: { label: "Dağıtıldı", tone: "success" },
  PENDING: { label: "Sırada", tone: "info" },
  RETRYING: { label: "Yeniden denenecek", tone: "warning" },
  FAILED: { label: "Başarısız", tone: "danger" },
};

export const DELIVERY_STATUS_META: Record<string, { label: string; tone: StatusTone }> = {
  PENDING: { label: "Sırada", tone: "info" },
  DELIVERED: { label: "Teslim edildi", tone: "success" },
  SKIPPED: { label: "Gerek yok", tone: "muted" },
  FAILED: { label: "Başarısız", tone: "danger" },
};

export const SUBSCRIBER_LABELS: Record<string, string> = {
  notifications: "Bildirimler",
  einvoice: "E-fatura",
  webhooks: "Webhook",
  "activity-log": "Aktivite kaydı",
  "admin-alert": "Yönetim uyarısı",
};
