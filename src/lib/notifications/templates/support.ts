import { z } from "zod";
import { dateField, dateTime, panelPaths, templateSchema } from "./helpers";
import { ticketMessageIdTag, ticketSubjectTag, REPLY_MARKER } from "@/lib/support/thread";
import { defineTemplate } from "./types";

const PREVIEW_LIMIT = 600;

function preview(message: string) {
  const trimmed = message.trim();
  return trimmed.length > PREVIEW_LIMIT ? `${trimmed.slice(0, PREVIEW_LIMIT)}…` : trimmed;
}

const ticketShape = {
  ticketId: z.string(),
  ticketNumber: z.string(),
  ticketSubject: z.string(),
  senderName: z.string(),
  messagePreview: z.string(),
};

const ticketSample = {
  ticketId: "ornek",
  ticketNumber: "T-482913",
  ticketSubject: "E-posta hesabı oluşturma",
  senderName: "KLEACORE Destek",
  messagePreview: "Merhaba, e-posta hesabınızı oluşturduk. Webmail üzerinden giriş yapabilirsiniz.",
};

/**
 * Optional support mailbox address: when set, the customer may answer by
 * e-mail (Reply-To + reply-above marker); the IMAP poller threads it back.
 */
const replyShape = { replyTo: z.string().email().optional() };

function ticketMailHeaders(data: { ticketNumber: string; replyTo?: string }) {
  return { messageIdTag: ticketMessageIdTag(data.ticketNumber), ...(data.replyTo ? { replyTo: data.replyTo } : {}) };
}

export const supportTicketReplied = defineTemplate({
  key: "support.ticket-replied",
  label: "Destek talebi yanıtlandı",
  group: "Destek",
  audience: "customer",
  inbox: "SUPPORT",
  schema: templateSchema({ ...ticketShape, ...replyShape }),
  sample: { recipientName: "Ayşe Yılmaz", ...ticketSample, replyTo: "destek@kleacore.com" },
  render: (data, { baseUrl }) => ({
    subject: `${ticketSubjectTag(data.ticketNumber)} Destek talebiniz yanıtlandı: ${data.ticketSubject}`,
    ...(data.replyTo ? { replyMarker: REPLY_MARKER } : {}),
    heading: "Destek talebiniz yanıtlandı",
    greetingName: data.recipientName,
    intro: [`"${data.ticketSubject}" konulu ${data.ticketNumber} numaralı talebinize ${data.senderName} yanıt verdi:`, preview(data.messagePreview)],
    action: { label: "Talebi görüntüle ve yanıtla", url: `${baseUrl}${panelPaths.ticket(data.ticketId)}` },
    note: data.replyTo
      ? "Bu e-postayı yanıtlayarak da talebinize mesaj ekleyebilirsiniz; yanıtınızı işaretli satırın üstüne yazın."
      : "Bu e-postayı yanıtlamak yerine lütfen panel üzerinden yanıt verin.",
  }),
  mailHeaders: ticketMailHeaders,
});

/** Acknowledgement of a ticket opened by e-mail (gives the customer the threaded subject). */
export const supportTicketReceived = defineTemplate({
  key: "support.ticket-received",
  label: "Destek talebi alındı (e-posta ile)",
  group: "Destek",
  audience: "customer",
  inbox: "SUPPORT",
  schema: templateSchema({
    ticketId: z.string(),
    ticketNumber: z.string(),
    ticketSubject: z.string(),
    hasAccount: z.boolean(),
    ...replyShape,
  }),
  sample: {
    recipientName: "Ayşe Yılmaz",
    ticketId: "ornek",
    ticketNumber: "T-482913",
    ticketSubject: "Web sitem açılmıyor",
    hasAccount: true,
    replyTo: "destek@kleacore.com",
  },
  render: (data, { baseUrl }) => ({
    subject: `${ticketSubjectTag(data.ticketNumber)} Destek talebiniz alındı: ${data.ticketSubject}`,
    ...(data.replyTo ? { replyMarker: REPLY_MARKER } : {}),
    heading: "Destek talebiniz alındı",
    greetingName: data.recipientName,
    intro: [
      `E-postanız ${data.ticketNumber} numaralı destek talebi olarak kaydedildi. Ekibimiz en kısa sürede yanıt verecek.`,
      "Bu talebe ek bilgi göndermek için bu e-postayı yanıtlayabilirsiniz; konu satırındaki talep numarasını silmeyin.",
    ],
    ...(data.hasAccount
      ? { action: { label: "Talebi panelde görüntüle", url: `${baseUrl}${panelPaths.ticket(data.ticketId)}` } }
      : {}),
  }),
  mailHeaders: ticketMailHeaders,
});

/** Sent one day before an unanswered ticket (waiting on the customer) is closed automatically. */
export const supportTicketAutoCloseWarning = defineTemplate({
  key: "support.ticket-auto-close-warning",
  label: "Destek talebi otomatik kapanacak",
  group: "Destek",
  audience: "customer",
  inbox: "SUPPORT",
  schema: templateSchema({
    ticketId: z.string(),
    ticketNumber: z.string(),
    ticketSubject: z.string(),
    closesAt: dateField,
    hasAccount: z.boolean(),
    ...replyShape,
  }),
  sample: {
    recipientName: "Ayşe Yılmaz",
    ticketId: "ornek",
    ticketNumber: "T-482913",
    ticketSubject: "Web sitem açılmıyor",
    closesAt: "2026-10-12T09:00:00.000Z",
    hasAccount: true,
    replyTo: "destek@kleacore.com",
  },
  render: (data, { baseUrl }) => ({
    subject: `${ticketSubjectTag(data.ticketNumber)} Destek talebiniz yakında kapatılacak: ${data.ticketSubject}`,
    ...(data.replyTo ? { replyMarker: REPLY_MARKER } : {}),
    heading: "Destek talebiniz yakında kapatılacak",
    greetingName: data.recipientName,
    intro: [
      `${data.ticketNumber} numaralı talebinizde sizden yanıt bekliyoruz. Yanıt gelmezse talep ${dateTime(data.closesAt)} sonrasında otomatik olarak kapatılacak.`,
      "Sorununuz devam ediyorsa talebe yanıt vermeniz yeterli; kapandıktan sonra da talebi yeniden açabilirsiniz.",
    ],
    ...(data.hasAccount
      ? { action: { label: "Talebi görüntüle ve yanıtla", url: `${baseUrl}${panelPaths.ticket(data.ticketId)}` } }
      : {}),
  }),
  mailHeaders: ticketMailHeaders,
});

/** Staff copy: a customer replied to a ticket (sent to the support address). */
export const adminTicketCustomerReply = defineTemplate({
  key: "admin.ticket-customer-reply",
  label: "Müşteri destek yanıtı (yönetim)",
  group: "Yönetim",
  audience: "admin",
  schema: templateSchema(ticketShape),
  sample: { ...ticketSample, senderName: "Ayşe Yılmaz", messagePreview: "Teşekkürler, giriş yapabildim." },
  render: (data, { baseUrl }) => ({
    subject: `Müşteri yanıtı: ${data.ticketNumber} — ${data.ticketSubject}`,
    heading: "Destek talebine müşteri yanıtı",
    greetingName: null,
    intro: [`${data.senderName}, ${data.ticketNumber} numaralı talebe yanıt verdi:`, preview(data.messagePreview)],
    action: { label: "Talebi aç", url: `${baseUrl}/yonetim/destek/${data.ticketId}` },
  }),
});

/** Admin task: a paid order needs manual provisioning (VDS in Faz 1, no automation module). */
export const adminManualProvisioning = defineTemplate({
  key: "admin.manual-provisioning",
  label: "Manuel kurulum bekliyor (yönetim)",
  group: "Yönetim",
  audience: "admin",
  schema: templateSchema({
    taskId: z.string(),
    orderNumber: z.string(),
    productName: z.string(),
    customerName: z.string(),
    customerEmail: z.string(),
    domain: z.string().optional(),
    paidAt: dateField,
    slaHours: z.number().int().positive(),
  }),
  sample: {
    taskId: "ornek",
    orderNumber: "S-2026-000123",
    productName: "VDS Pro 8 GB",
    customerName: "Ayşe Yılmaz",
    customerEmail: "ayse@example.com",
    paidAt: "2026-10-08T10:15:00.000Z",
    slaHours: 24,
  },
  render: (data, { baseUrl }) => ({
    subject: `Manuel kurulum bekliyor: ${data.productName} (${data.orderNumber})`,
    heading: "Manuel kurulum bekliyor",
    greetingName: null,
    intro: [
      "Ödemesi alınan bir sipariş için otomatik kurulum modülü yok. Hizmeti kurup teslim bilgilerini girin; müşteri bilgilendirme e-postası aktifleştirmeyle gönderilir.",
    ],
    details: [
      { label: "Sipariş", value: data.orderNumber, mono: true },
      { label: "Ürün", value: data.productName },
      { label: "Müşteri", value: `${data.customerName} <${data.customerEmail}>` },
      ...(data.domain ? [{ label: "Alan adı", value: data.domain, mono: true }] : []),
      { label: "Ödeme", value: dateTime(data.paidAt) },
      { label: "Hedef süre", value: `${data.slaHours} saat` },
    ],
    action: { label: "Kurulum görevini aç", url: `${baseUrl}/yonetim/kurulumlar/${data.taskId}` },
  }),
  sms: (data) => `KLEACORE: Manuel kurulum bekliyor — ${data.productName} (${data.orderNumber}).`,
});

export const adminDomainRenewalFailed = defineTemplate({
  key: "admin.domain-renewal-failed",
  label: "Alan adı yenilemesi başarısız (yönetim)",
  group: "Yönetim",
  audience: "admin",
  schema: templateSchema({
    domainId: z.string(),
    domain: z.string(),
    renewalId: z.string(),
    invoiceId: z.string().nullable().optional(),
    error: z.string(),
  }),
  sample: {
    domainId: "ornek",
    domain: "ornek.com",
    renewalId: "ornek",
    invoiceId: "ornek",
    error: "REGISTRAR_RENEW_FAILED",
  },
  render: (data, { baseUrl }) => ({
    subject: `Alan adı yenilemesi başarısız: ${data.domain}`,
    heading: "Alan adı yenilemesi başarısız",
    greetingName: null,
    intro: [
      `${data.domain} registrar'da yenilenemedi. Ödeme alındı; alan adının elle yenilenmesi gerekiyor.`,
    ],
    details: [
      { label: "Alan adı", value: data.domain, mono: true },
      { label: "Hata", value: data.error },
    ],
    action: { label: "Alan adını aç", url: `${baseUrl}/yonetim/domainler/${data.domainId}` },
  }),
  sms: (data) => `KLEACORE: ${data.domain} registrar yenilemesi başarısız, elle yenileme gerekli.`,
});

/**
 * Generic staff alert for domain events (src/lib/events/subscribers/admin-alert.ts):
 * new ticket, bank transfer notice, failed provisioning, failed automatic charge.
 */
export const adminEventAlert = defineTemplate({
  key: "admin.event-alert",
  label: "Yönetim uyarısı (olay)",
  group: "Yönetim",
  audience: "admin",
  schema: templateSchema({
    title: z.string().min(1),
    message: z.string().min(1),
    details: z.array(z.object({ label: z.string(), value: z.string() })).optional(),
    /** Admin path, e.g. /yonetim/destek/<id> */
    path: z.string().startsWith("/").optional(),
    eventType: z.string().optional(),
  }),
  sample: {
    title: "Yeni destek talebi: T-2026-000042",
    message: "Ayşe Yılmaz yeni bir destek talebi açtı: E-posta hesabı oluşturma",
    details: [
      { label: "Departman", value: "Teknik" },
      { label: "Öncelik", value: "Yüksek" },
    ],
    path: "/yonetim/destek/ornek",
    eventType: "ticket.opened",
  },
  render: (data, { baseUrl }) => ({
    subject: data.title,
    heading: data.title,
    greetingName: null,
    intro: [data.message],
    details: data.details?.length ? data.details : undefined,
    action: data.path ? { label: "Yönetim panelinde aç", url: `${baseUrl}${data.path}` } : undefined,
    note: data.eventType ? `Olay: ${data.eventType}` : undefined,
  }),
  sms: (data) => `KLEACORE: ${data.title}`,
});
