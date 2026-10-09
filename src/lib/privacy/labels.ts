/**
 * KVKK request labels and deadline helpers. Pure module (no server imports):
 * used by templates, the public form, the customer panel and the admin queue.
 */

export const DATA_REQUEST_TYPES = ["INFORMATION", "EXPORT", "RECTIFICATION", "ERASURE", "OBJECTION"] as const;
export type DataRequestTypeValue = (typeof DATA_REQUEST_TYPES)[number];

export const DATA_REQUEST_STATUSES = [
  "PENDING_VERIFICATION",
  "RECEIVED",
  "IN_PROGRESS",
  "COMPLETED",
  "REJECTED",
  "CANCELLED",
] as const;
export type DataRequestStatusValue = (typeof DATA_REQUEST_STATUSES)[number];

export const DATA_REQUEST_TYPE_LABELS: Record<DataRequestTypeValue, string> = {
  INFORMATION: "Bilgi talebi",
  EXPORT: "Verilerimin bir kopyası",
  RECTIFICATION: "Düzeltme",
  ERASURE: "Silme / anonimleştirme",
  OBJECTION: "İtiraz",
};

export const DATA_REQUEST_TYPE_DESCRIPTIONS: Record<DataRequestTypeValue, string> = {
  INFORMATION: "Kişisel verilerimin işlenip işlenmediğini, hangi amaçla işlendiğini ve kimlere aktarıldığını öğrenmek istiyorum.",
  EXPORT: "Hakkımda tutulan kişisel verilerin bir kopyasını (JSON + CSV) almak istiyorum.",
  RECTIFICATION: "Eksik veya yanlış işlenen kişisel verilerimin düzeltilmesini istiyorum.",
  ERASURE: "Kişisel verilerimin silinmesini veya anonim hâle getirilmesini istiyorum.",
  OBJECTION: "Verilerimin işlenmesine veya otomatik analiz sonucuna itiraz ediyorum.",
};

export const DATA_REQUEST_STATUS_LABELS: Record<DataRequestStatusValue, string> = {
  PENDING_VERIFICATION: "E-posta doğrulaması bekliyor",
  RECEIVED: "Alındı",
  IN_PROGRESS: "İnceleniyor",
  COMPLETED: "Sonuçlandı",
  REJECTED: "Reddedildi",
  CANCELLED: "İptal edildi",
};

export type Tone = "success" | "warning" | "danger" | "info" | "neutral" | "muted";

export const DATA_REQUEST_STATUS_TONES: Record<DataRequestStatusValue, Tone> = {
  PENDING_VERIFICATION: "muted",
  RECEIVED: "info",
  IN_PROGRESS: "warning",
  COMPLETED: "success",
  REJECTED: "danger",
  CANCELLED: "muted",
};

export function dataRequestTypeLabel(type: string) {
  return DATA_REQUEST_TYPE_LABELS[type as DataRequestTypeValue] ?? type;
}

export function dataRequestStatusLabel(status: string) {
  return DATA_REQUEST_STATUS_LABELS[status as DataRequestStatusValue] ?? status;
}

/** KVKK m.13/2: the controller answers within 30 days at the latest. */
export const STATUTORY_DEADLINE_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;

export function computeDueAt(receivedAt: Date) {
  return new Date(receivedAt.getTime() + STATUTORY_DEADLINE_DAYS * DAY_MS);
}

export const OPEN_DATA_REQUEST_STATUSES: readonly DataRequestStatusValue[] = ["RECEIVED", "IN_PROGRESS"];

export function isOpenDataRequestStatus(status: string) {
  return (OPEN_DATA_REQUEST_STATUSES as readonly string[]).includes(status);
}

export type DeadlineState =
  | { kind: "none" }
  | { kind: "closed" }
  | { kind: "open"; daysLeft: number; tone: Tone; label: string };

/**
 * Deadline display for an open request: overdue → danger, ≤ 7 days → warning.
 * Days are counted in whole days, rounded up (due in 3h = "1 gün").
 */
export function deadlineState(
  request: { status: string; dueAt: Date | string | null },
  now = new Date()
): DeadlineState {
  if (!isOpenDataRequestStatus(request.status)) {
    return request.status === "PENDING_VERIFICATION" || !request.dueAt ? { kind: "none" } : { kind: "closed" };
  }
  if (!request.dueAt) return { kind: "none" };
  const due = new Date(request.dueAt).getTime();
  const diff = due - now.getTime();
  const daysLeft = diff >= 0 ? Math.ceil(diff / DAY_MS) : -Math.ceil(-diff / DAY_MS);
  if (diff < 0) {
    return { kind: "open", daysLeft, tone: "danger", label: `Süre ${-daysLeft} gün geçti` };
  }
  if (daysLeft <= 7) {
    return { kind: "open", daysLeft, tone: "warning", label: daysLeft === 0 ? "Bugün son gün" : `${daysLeft} gün kaldı` };
  }
  return { kind: "open", daysLeft, tone: "neutral", label: `${daysLeft} gün kaldı` };
}

/** Allowed manual status changes in the admin queue (completion/rejection go through the response form). */
export function canTransition(from: string, to: string) {
  const allowed: Record<string, readonly string[]> = {
    PENDING_VERIFICATION: ["CANCELLED"],
    RECEIVED: ["IN_PROGRESS", "COMPLETED", "REJECTED"],
    IN_PROGRESS: ["RECEIVED", "COMPLETED", "REJECTED"],
    COMPLETED: [],
    REJECTED: [],
    CANCELLED: [],
  };
  return allowed[from]?.includes(to) ?? false;
}
