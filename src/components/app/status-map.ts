/**
 * Prisma enum → Turkish label + tone. Single source of truth for every status
 * shown in the customer and admin panels. Keep in sync with
 * prisma/schema.prisma enums.
 *
 * Tones only colour the badge's dot; the text stays `foreground`, so the UI
 * stays monochrome.
 */

export type StatusTone = "success" | "warning" | "danger" | "info" | "neutral" | "muted";

export type StatusKind =
  | "service"
  | "invoice"
  | "order"
  | "ticket"
  | "ticketPriority"
  | "domain"
  | "ssl"
  | "payment"
  | "backup"
  | "provisioning"
  | "notification"
  | "cronRun"
  | "queueJob"
  | "cancellation"
  | "planChange"
  | "eInvoice"
  | "user"
  | "product"
  | "emailAccount"
  | "systemStatus"
  | "incident"
  | "affiliatePayment"
  | "content"
  | "promo";

export type StatusAudience = "customer" | "admin";

type Entry = { label: string; tone: StatusTone };
type Map = Record<string, Entry>;

const service: Map = {
  PENDING: { label: "Kurulum sürüyor", tone: "info" },
  ACTIVE: { label: "Aktif", tone: "success" },
  SUSPENDED: { label: "Askıda", tone: "warning" },
  CANCELLED: { label: "İptal edildi", tone: "muted" },
  EXPIRED: { label: "Süresi doldu", tone: "danger" },
};

const invoice: Map = {
  DRAFT: { label: "Taslak", tone: "muted" },
  PENDING: { label: "Ödeme bekliyor", tone: "warning" },
  PAID: { label: "Ödendi", tone: "success" },
  OVERDUE: { label: "Gecikmiş", tone: "danger" },
  CANCELLED: { label: "İptal edildi", tone: "muted" },
};

const order: Map = {
  PENDING: { label: "Beklemede", tone: "warning" },
  APPROVED: { label: "Onaylandı", tone: "info" },
  PROCESSING: { label: "İşleniyor", tone: "info" },
  COMPLETED: { label: "Tamamlandı", tone: "success" },
  CANCELLED: { label: "İptal edildi", tone: "muted" },
  REFUNDED: { label: "İade edildi", tone: "neutral" },
};

const ticketCustomer: Map = {
  OPEN: { label: "Açık", tone: "info" },
  CUSTOMER_REPLY: { label: "Yanıt bekliyor", tone: "warning" },
  ADMIN_REPLY: { label: "Yanıtlandı", tone: "success" },
  WAITING: { label: "Beklemede", tone: "neutral" },
  CLOSED: { label: "Kapalı", tone: "muted" },
};

const ticketAdmin: Map = {
  ...ticketCustomer,
  CUSTOMER_REPLY: { label: "Müşteri yanıtladı", tone: "warning" },
};

const ticketPriority: Map = {
  LOW: { label: "Düşük", tone: "muted" },
  MEDIUM: { label: "Normal", tone: "neutral" },
  HIGH: { label: "Yüksek", tone: "warning" },
  URGENT: { label: "Acil", tone: "danger" },
};

const domain: Map = {
  ACTIVE: { label: "Aktif", tone: "success" },
  EXPIRED: { label: "Süresi doldu", tone: "danger" },
  TRANSFERRING: { label: "Transfer ediliyor", tone: "info" },
  PENDING: { label: "Beklemede", tone: "warning" },
};

const ssl: Map = {
  ACTIVE: { label: "Aktif", tone: "success" },
  EXPIRED: { label: "Süresi doldu", tone: "danger" },
  PENDING: { label: "Beklemede", tone: "warning" },
  REVOKED: { label: "İptal edildi", tone: "muted" },
};

const payment: Map = {
  PENDING: { label: "Beklemede", tone: "warning" },
  COMPLETED: { label: "Tamamlandı", tone: "success" },
  FAILED: { label: "Başarısız", tone: "danger" },
  REFUNDED: { label: "İade edildi", tone: "neutral" },
};

const backup: Map = {
  COMPLETED: { label: "Tamamlandı", tone: "success" },
  IN_PROGRESS: { label: "Sürüyor", tone: "info" },
  FAILED: { label: "Başarısız", tone: "danger" },
  SCHEDULED: { label: "Planlandı", tone: "neutral" },
};

const provisioning: Map = {
  PENDING: { label: "Sırada", tone: "warning" },
  PROCESSING: { label: "İşleniyor", tone: "info" },
  COMPLETED: { label: "Tamamlandı", tone: "success" },
  FAILED: { label: "Başarısız", tone: "danger" },
};

const notification: Map = {
  QUEUED: { label: "Sırada", tone: "info" },
  SENT: { label: "Gönderildi", tone: "success" },
  FAILED: { label: "Başarısız", tone: "danger" },
  SKIPPED: { label: "Atlandı", tone: "muted" },
};

const cronRun: Map = {
  RUNNING: { label: "Çalışıyor", tone: "info" },
  SUCCEEDED: { label: "Başarılı", tone: "success" },
  FAILED: { label: "Başarısız", tone: "danger" },
  LOCKED: { label: "Kilitli (zaten çalışıyor)", tone: "warning" },
  SKIPPED: { label: "Atlandı", tone: "muted" },
};

/** pg-boss job states (lower-case, not a Prisma enum). */
const queueJob: Map = {
  created: { label: "Sırada", tone: "neutral" },
  retry: { label: "Yeniden denenecek", tone: "warning" },
  active: { label: "Çalışıyor", tone: "info" },
  completed: { label: "Tamamlandı", tone: "success" },
  failed: { label: "Başarısız", tone: "danger" },
  cancelled: { label: "İptal edildi", tone: "muted" },
};

const cancellation: Map = {
  PENDING: { label: "Beklemede", tone: "warning" },
  APPROVED: { label: "Onaylandı", tone: "success" },
  REJECTED: { label: "Reddedildi", tone: "danger" },
};

const planChange: Map = {
  PENDING: { label: "Beklemede", tone: "warning" },
  PAYMENT_PENDING: { label: "Ödeme bekliyor", tone: "warning" },
  COMPLETED: { label: "Tamamlandı", tone: "success" },
  CANCELLED: { label: "İptal edildi", tone: "muted" },
};

const eInvoice: Map = {
  DRAFT: { label: "Taslak", tone: "muted" },
  QUEUED: { label: "Kuyrukta", tone: "neutral" },
  SENT: { label: "Gönderildi", tone: "info" },
  ACCEPTED: { label: "Kabul edildi", tone: "success" },
  REJECTED: { label: "Reddedildi", tone: "danger" },
  FAILED: { label: "Başarısız", tone: "danger" },
  CANCELLED: { label: "İptal edildi", tone: "muted" },
};

const user: Map = {
  ACTIVE: { label: "Aktif", tone: "success" },
  SUSPENDED: { label: "Askıda", tone: "warning" },
  CLOSED: { label: "Kapatıldı", tone: "muted" },
};

const product: Map = {
  ACTIVE: { label: "Aktif", tone: "success" },
  INACTIVE: { label: "Pasif", tone: "muted" },
  DRAFT: { label: "Taslak", tone: "neutral" },
  ARCHIVED: { label: "Arşivlendi", tone: "muted" },
};

const emailAccount: Map = user;

const systemStatus: Map = {
  OPERATIONAL: { label: "Çalışıyor", tone: "success" },
  DEGRADED: { label: "Performans düşük", tone: "warning" },
  PARTIAL_OUTAGE: { label: "Kısmi kesinti", tone: "warning" },
  MAJOR_OUTAGE: { label: "Büyük kesinti", tone: "danger" },
  MAINTENANCE: { label: "Bakımda", tone: "info" },
};

const incident: Map = {
  INVESTIGATING: { label: "İnceleniyor", tone: "warning" },
  IDENTIFIED: { label: "Tespit edildi", tone: "warning" },
  MONITORING: { label: "İzleniyor", tone: "info" },
  RESOLVED: { label: "Çözüldü", tone: "success" },
};

const affiliatePayment: Map = {
  PENDING: { label: "Beklemede", tone: "warning" },
  PAID: { label: "Ödendi", tone: "success" },
  CANCELLED: { label: "İptal edildi", tone: "muted" },
};

const content: Map = {
  DRAFT: { label: "Taslak", tone: "neutral" },
  PUBLISHED: { label: "Yayında", tone: "success" },
  ARCHIVED: { label: "Arşivlendi", tone: "muted" },
};

const promo: Map = {
  ACTIVE: { label: "Aktif", tone: "success" },
  INACTIVE: { label: "Pasif", tone: "muted" },
  EXPIRED: { label: "Süresi doldu", tone: "danger" },
};

const MAPS: Record<StatusKind, Map> = {
  service,
  invoice,
  order,
  ticket: ticketCustomer,
  ticketPriority,
  domain,
  ssl,
  payment,
  backup,
  provisioning,
  notification,
  cronRun,
  queueJob,
  cancellation,
  planChange,
  eInvoice,
  user,
  product,
  emailAccount,
  systemStatus,
  incident,
  affiliatePayment,
  content,
  promo,
};

/** Label + tone for a status. Unknown values fall back to the raw value. */
export function getStatusMeta(
  kind: StatusKind,
  status: string | null | undefined,
  audience: StatusAudience = "customer"
): Entry {
  if (!status) return { label: "—", tone: "muted" };
  const map = kind === "ticket" && audience === "admin" ? ticketAdmin : MAPS[kind];
  return map[status] ?? { label: status, tone: "neutral" };
}

/** `[{ value, label }]` for a kind — handy for filter tabs / selects. */
export function getStatusOptions(kind: StatusKind, audience: StatusAudience = "customer") {
  const map = kind === "ticket" && audience === "admin" ? ticketAdmin : MAPS[kind];
  return Object.entries(map).map(([value, meta]) => ({ value, label: meta.label }));
}

/** Non-status enums that still need Turkish labels. */
export const ENUM_LABELS = {
  ticketDepartment: {
    GENERAL: "Genel",
    TECHNICAL: "Teknik destek",
    BILLING: "Muhasebe",
    SALES: "Satış",
  },
  paymentMethod: {
    CREDIT_CARD: "Kredi kartı",
    BANK_TRANSFER: "Havale / EFT",
    BALANCE: "Bakiye",
  },
  backupType: {
    FULL: "Tam",
    INCREMENTAL: "Artımlı",
    DATABASE: "Veritabanı",
    FILES: "Dosyalar",
  },
  dnsRecordType: { A: "A", AAAA: "AAAA", CNAME: "CNAME", MX: "MX", TXT: "TXT", NS: "NS", SRV: "SRV" },
  sslType: { DV: "Alan adı doğrulamalı (DV)", OV: "Kurum doğrulamalı (OV)", EV: "Genişletilmiş doğrulama (EV)", WILDCARD: "Wildcard" },
  customerType: { INDIVIDUAL: "Bireysel", CORPORATE: "Kurumsal" },
  userRole: { ADMIN: "Yönetici", CUSTOMER: "Müşteri" },
  transactionType: { DEPOSIT: "Yükleme", PAYMENT: "Ödeme", REFUND: "İade", ADJUSTMENT: "Düzeltme" },
  discountType: { PERCENTAGE: "Yüzde", FIXED: "Sabit tutar" },
  planChangeType: { UPGRADE: "Yükseltme", DOWNGRADE: "Düşürme" },
  incidentSeverity: { MINOR: "Düşük", MAJOR: "Yüksek", CRITICAL: "Kritik" },
  productCategory: {
    hosting: "Hosting",
    vds: "VDS",
    vps: "VPS",
    server: "Sunucu",
    cloud: "Bulut",
    datacenter: "Veri merkezi",
    domain: "Alan adı",
    ssl: "SSL",
    email: "E-posta",
  },
} as const satisfies Record<string, Record<string, string>>;

export type EnumLabelKind = keyof typeof ENUM_LABELS;

/** Turkish label for a non-status enum (falls back to the raw value). */
export function enumLabel(kind: EnumLabelKind, value: string | null | undefined): string {
  if (!value) return "—";
  return (ENUM_LABELS[kind] as Record<string, string>)[value] ?? value;
}
