/**
 * Customer 360 timeline (UI3 item 12): one newest-first stream of a
 * customer's orders, invoices, payments, tickets, sign-ins, KYC / fraud
 * events and activity log rows. Each source is queried for at most
 * `limit + 1` rows older than the cursor, then merged, so a page costs one
 * small indexed query per visible source regardless of history size.
 * Sources the viewer has no permission for are never queried.
 */
import { db } from "@/lib/db";
import { hasPermission, type Permission } from "@/lib/auth/permissions";

export const TIMELINE_KINDS = ["order", "invoice", "payment", "ticket", "login", "kyc", "fraud", "activity"] as const;
export type TimelineKind = (typeof TIMELINE_KINDS)[number];

export const TIMELINE_KIND_LABELS: Record<TimelineKind, string> = {
  order: "Siparişler",
  invoice: "Faturalar",
  payment: "Ödemeler",
  ticket: "Destek",
  login: "Girişler",
  kyc: "Kimlik (KYC)",
  fraud: "Risk",
  activity: "Aktivite",
};

/** Permission needed to see each kind (KYC documents only with kyc.review). */
export const TIMELINE_KIND_PERMISSION: Record<TimelineKind, Permission> = {
  order: "orders.view",
  invoice: "invoices.view",
  payment: "invoices.view",
  ticket: "tickets.view",
  login: "customers.view",
  kyc: "kyc.review",
  fraud: "orders.view",
  activity: "activity.view",
};

export function allowedTimelineKinds(role: unknown): TimelineKind[] {
  return TIMELINE_KINDS.filter((k) => hasPermission(role, TIMELINE_KIND_PERMISSION[k]));
}

export interface TimelineEvent {
  /** Unique per event (also the tie-breaker of the cursor). */
  key: string;
  kind: TimelineKind;
  at: Date;
  title: string;
  detail?: string | null;
  href?: string | null;
  /** StatusBadge kind + status, when the row has one. */
  status?: { kind: string; value: string } | null;
  /** Tone for events without a status (failed login, fraud review…). */
  tone?: "success" | "warning" | "danger" | "info" | "neutral" | "muted";
  amount?: number | null;
}

export interface TimelineCursor {
  at: Date;
  key: string;
}

export function encodeCursor(c: TimelineCursor): string {
  return `${c.at.toISOString()}~${c.key}`;
}

export function decodeCursor(raw: string | null | undefined): TimelineCursor | null {
  if (!raw) return null;
  const i = raw.indexOf("~");
  if (i < 0) return null;
  const at = new Date(raw.slice(0, i));
  const key = raw.slice(i + 1);
  if (Number.isNaN(at.getTime()) || !key || key.length > 120) return null;
  return { at, key };
}

/** Newest first; equal instants ordered by key (descending) so paging is stable. */
function compare(a: Pick<TimelineEvent, "at" | "key">, b: Pick<TimelineEvent, "at" | "key">) {
  const d = b.at.getTime() - a.at.getTime();
  if (d !== 0) return d;
  return a.key < b.key ? 1 : a.key > b.key ? -1 : 0;
}

/**
 * Pure: merges per-source lists into one page after `cursor`. Returns the
 * page and the cursor of the next page (null when nothing older is left).
 */
export function mergeTimeline(
  sources: TimelineEvent[][],
  limit: number,
  cursor: TimelineCursor | null = null
): { events: TimelineEvent[]; next: TimelineCursor | null } {
  const all = sources
    .flat()
    .filter((e) => !cursor || compare(cursor, e) < 0)
    .sort(compare);
  const events = all.slice(0, limit);
  const last = events[events.length - 1];
  return { events, next: all.length > limit && last ? { at: last.at, key: last.key } : null };
}

/** Parses `?tur=order,invoice` against the kinds the viewer may see (empty = all allowed). */
export function parseKinds(raw: string | string[] | undefined, allowed: TimelineKind[]): TimelineKind[] {
  const value = Array.isArray(raw) ? raw.join(",") : (raw ?? "");
  const picked = value
    .split(",")
    .map((s) => s.trim())
    .filter((s): s is TimelineKind => (allowed as string[]).includes(s));
  return picked.length ? [...new Set(picked)] : allowed;
}

const name = (u: { name: string; surname: string } | null | undefined) => (u ? `${u.name} ${u.surname}`.trim() : "");
const n = (v: unknown) => Number(v ?? 0);

export async function getCustomerTimeline(
  customerId: string,
  options: { kinds: TimelineKind[]; cursor: TimelineCursor | null; limit?: number }
) {
  const limit = Math.min(Math.max(options.limit ?? 20, 1), 50);
  const take = limit + 1;
  // `lte` + the merge filter keeps rows sharing the cursor's instant.
  const at = options.cursor ? { lte: options.cursor.at } : undefined;
  const want = (k: TimelineKind) => options.kinds.includes(k);
  const none = Promise.resolve([] as TimelineEvent[]);

  const sources = await Promise.all([
    want("order")
      ? db.order
          .findMany({
            where: { customerId, ...(at && { createdAt: at }) },
            orderBy: { createdAt: "desc" },
            take,
            select: { id: true, orderNumber: true, status: true, totalAmount: true, createdAt: true, domain: true, product: { select: { name: true } } },
          })
          .then((rows) =>
            rows.map<TimelineEvent>((o) => ({
              key: `order:${o.id}`,
              kind: "order",
              at: o.createdAt,
              title: `Sipariş ${o.orderNumber}`,
              detail: [o.product?.name, o.domain].filter(Boolean).join(" · "),
              href: `/yonetim/siparisler/${o.id}`,
              status: { kind: "order", value: o.status },
              amount: n(o.totalAmount),
            }))
          )
      : none,
    want("invoice")
      ? db.invoice
          .findMany({
            where: { customerId, ...(at && { createdAt: at }) },
            orderBy: { createdAt: "desc" },
            take,
            select: { id: true, invoiceNumber: true, status: true, totalAmount: true, createdAt: true, dueDate: true },
          })
          .then((rows) =>
            rows.map<TimelineEvent>((i) => ({
              key: `invoice:${i.id}`,
              kind: "invoice",
              at: i.createdAt,
              title: `Fatura ${i.invoiceNumber} kesildi`,
              detail: `Son ödeme ${i.dueDate.toLocaleDateString("tr-TR", { timeZone: "Europe/Istanbul" })}`,
              href: `/yonetim/faturalar/${i.id}`,
              status: { kind: "invoice", value: i.status },
              amount: n(i.totalAmount),
            }))
          )
      : none,
    want("payment")
      ? db.payment
          .findMany({
            where: { customerId, ...(at && { createdAt: at }) },
            orderBy: { createdAt: "desc" },
            take,
            select: { id: true, amount: true, method: true, status: true, createdAt: true, invoice: { select: { id: true, invoiceNumber: true } } },
          })
          .then((rows) =>
            rows.map<TimelineEvent>((p) => ({
              key: `payment:${p.id}`,
              kind: "payment",
              at: p.createdAt,
              title: `Ödeme · ${p.invoice.invoiceNumber}`,
              detail: p.method === "CREDIT_CARD" ? "Kredi kartı" : p.method === "BANK_TRANSFER" ? "Havale / EFT" : "Bakiye",
              href: `/yonetim/faturalar/${p.invoice.id}`,
              status: { kind: "payment", value: p.status },
              amount: n(p.amount),
            }))
          )
      : none,
    want("ticket")
      ? db.supportTicket
          .findMany({
            where: { customerId, ...(at && { createdAt: at }) },
            orderBy: { createdAt: "desc" },
            take,
            select: { id: true, ticketNumber: true, subject: true, status: true, createdAt: true },
          })
          .then((rows) =>
            rows.map<TimelineEvent>((t) => ({
              key: `ticket:${t.id}`,
              kind: "ticket",
              at: t.createdAt,
              title: `Destek talebi #${t.ticketNumber}`,
              detail: t.subject,
              href: `/yonetim/destek/${t.id}`,
              status: { kind: "ticket", value: t.status },
            }))
          )
      : none,
    want("login")
      ? db.loginEvent
          .findMany({
            where: { userId: customerId, ...(at && { createdAt: at }) },
            orderBy: { createdAt: "desc" },
            take,
            select: { id: true, success: true, reason: true, ipAddress: true, uaFamily: true, newDevice: true, twoFactorUsed: true, createdAt: true },
          })
          .then((rows) =>
            rows.map<TimelineEvent>((l) => ({
              key: `login:${l.id}`,
              kind: "login",
              at: l.createdAt,
              title: l.success ? (l.newDevice ? "Yeni cihazdan giriş" : "Giriş yaptı") : "Başarısız giriş denemesi",
              detail: [l.uaFamily, l.ipAddress, l.twoFactorUsed ? "2FA" : null, !l.success && l.reason === "bad_password" ? "Hatalı parola" : null]
                .filter(Boolean)
                .join(" · "),
              tone: l.success ? (l.newDevice ? "info" : "muted") : "danger",
            }))
          )
      : none,
    want("kyc")
      ? Promise.all([
          db.kycDocument.findMany({
            where: { userId: customerId, ...(at && { uploadedAt: at }) },
            orderBy: { uploadedAt: "desc" },
            take,
            select: { id: true, type: true, uploadedAt: true, deletedAt: true },
          }),
          db.user.findUnique({ where: { id: customerId }, select: { kycStatus: true, kycReviewedAt: true, kycRejectionReason: true } }),
        ]).then(([docs, user]) => {
          const events = docs.map<TimelineEvent>((d) => ({
            key: `kyc:${d.id}`,
            kind: "kyc",
            at: d.uploadedAt,
            title: "Kimlik belgesi yüklendi",
            detail: `${KYC_DOC_LABELS[d.type] ?? d.type}${d.deletedAt ? " · dosya silindi (saklama süresi)" : ""}`,
            href: `/yonetim/kyc/${customerId}`,
            tone: "info",
          }));
          if (user?.kycReviewedAt && (user.kycStatus === "APPROVED" || user.kycStatus === "REJECTED")) {
            events.push({
              key: `kyc-decision:${customerId}`,
              kind: "kyc",
              at: user.kycReviewedAt,
              title: user.kycStatus === "APPROVED" ? "Kimlik doğrulaması onaylandı" : "Kimlik doğrulaması reddedildi",
              detail: user.kycStatus === "REJECTED" ? user.kycRejectionReason : null,
              href: `/yonetim/kyc/${customerId}`,
              status: { kind: "kyc", value: user.kycStatus },
            });
          }
          return events.filter((e) => !options.cursor || e.at <= options.cursor.at);
        })
      : none,
    want("fraud")
      ? db.fraudCheck
          .findMany({
            where: { customerId, ...(at && { createdAt: at }) },
            orderBy: { createdAt: "desc" },
            take,
            select: { id: true, score: true, threshold: true, status: true, createdAt: true, orderId: true, ipCountry: true, order: { select: { orderNumber: true } } },
          })
          .then((rows) =>
            rows.map<TimelineEvent>((f) => ({
              key: `fraud:${f.id}`,
              kind: "fraud",
              at: f.createdAt,
              title: `Risk değerlendirmesi · ${f.order.orderNumber}`,
              detail: `Puan ${f.score} / eşik ${f.threshold}${f.ipCountry ? ` · IP ${f.ipCountry}` : ""}`,
              href: `/yonetim/siparisler/${f.orderId}`,
              status: { kind: "fraudCheck", value: f.status },
            }))
          )
      : none,
    want("activity")
      ? db.activityLog
          .findMany({
            where: { OR: [{ userId: customerId }, { entityId: customerId }], ...(at && { createdAt: at }) },
            orderBy: { createdAt: "desc" },
            take,
            select: { id: true, action: true, entity: true, entityId: true, createdAt: true, userId: true, user: { select: { name: true, surname: true, role: true } } },
          })
          .then((rows) =>
            rows.map<TimelineEvent>((a) => ({
              key: `activity:${a.id}`,
              kind: "activity",
              at: a.createdAt,
              title: a.action,
              detail: `${a.entity}${a.userId !== customerId ? ` · ${name(a.user) || "Personel"}` : ""}`,
              tone: "neutral",
            }))
          )
      : none,
  ]);

  return mergeTimeline(sources, limit, options.cursor);
}

const KYC_DOC_LABELS: Record<string, string> = {
  IDENTITY_FRONT: "Kimlik ön yüz",
  IDENTITY_BACK: "Kimlik arka yüz",
  TAX_CERTIFICATE: "Vergi levhası",
  SELFIE: "Özçekim",
};
