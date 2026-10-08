import { z } from "zod";
import { dateField, dateTime, panelPaths, templateSchema } from "./helpers";
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
  ticketNumber: "T-2026-000042",
  ticketSubject: "E-posta hesabı oluşturma",
  senderName: "KLEACORE Destek",
  messagePreview: "Merhaba, e-posta hesabınızı oluşturduk. Webmail üzerinden giriş yapabilirsiniz.",
};

export const supportTicketReplied = defineTemplate({
  key: "support.ticket-replied",
  label: "Destek talebi yanıtlandı",
  group: "Destek",
  audience: "customer",
  inbox: "SUPPORT",
  schema: templateSchema(ticketShape),
  sample: { recipientName: "Ayşe Yılmaz", ...ticketSample },
  render: (data, { baseUrl }) => ({
    subject: `Destek talebiniz yanıtlandı: ${data.ticketNumber}`,
    heading: "Destek talebiniz yanıtlandı",
    greetingName: data.recipientName,
    intro: [`"${data.ticketSubject}" konulu ${data.ticketNumber} numaralı talebinize ${data.senderName} yanıt verdi:`, preview(data.messagePreview)],
    action: { label: "Talebi görüntüle ve yanıtla", url: `${baseUrl}${panelPaths.ticket(data.ticketId)}` },
    note: "Bu e-postayı yanıtlamak yerine lütfen panel üzerinden yanıt verin.",
  }),
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
