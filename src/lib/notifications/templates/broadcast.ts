import { z } from "zod";
import { templateSchema } from "./helpers";
import { defineTemplate } from "./types";

/**
 * Bulk announcements (src/lib/broadcasts). The admin writes subject / HTML /
 * SMS per broadcast; the dispatcher renders them for each recipient with the
 * safe template engine (values escaped, HTML sanitised) and stores the result
 * here, so the queued NotificationLog row is self-contained and a retry sends
 * exactly the same message. Not editable in the template editor.
 */
const broadcastSchema = templateSchema({
  broadcastId: z.string(),
  subject: z.string().min(1),
  /** Sanitised, per-recipient rendered HTML (inner card). */
  bodyHtml: z.string(),
  /** Plain-text part (no footer). */
  bodyText: z.string(),
  sms: z.string().optional(),
  /** Marketing only: signed one-click unsubscribe URL. */
  unsubscribeUrl: z.string().url().optional(),
  /** Marketing only: RFC 8058 one-click POST target for the List-Unsubscribe header. */
  oneClickUrl: z.string().url().optional(),
});

type BroadcastData = z.output<typeof broadcastSchema>;

const sampleBody =
  "<p>Merhaba Ayşe Yılmaz,</p><p>15 Ekim 2026 Çarşamba 02:00–04:00 saatleri arasında <strong>WHM-1</strong> sunucusunda planlı bakım yapılacaktır. Bu süre içinde sitelerinize kısa süreli erişim kesintileri yaşanabilir.</p><p>Anlayışınız için teşekkür ederiz.</p>";
const sampleText =
  "Merhaba Ayşe Yılmaz,\n\n15 Ekim 2026 Çarşamba 02:00–04:00 saatleri arasında WHM-1 sunucusunda planlı bakım yapılacaktır. Bu süre içinde sitelerinize kısa süreli erişim kesintileri yaşanabilir.\n\nAnlayışınız için teşekkür ederiz.";

function preheaderOf(data: BroadcastData) {
  return (
    data.bodyText
      .split("\n")
      .map((line) => line.trim())
      .find((line) => line && !/^merhaba\b/i.test(line)) ?? data.subject
  ).slice(0, 200);
}

function fallbackContent(data: BroadcastData) {
  return {
    subject: data.subject,
    heading: data.subject,
    greetingName: null,
    intro: data.bodyText.split(/\n{2,}/).map((part) => part.trim()).filter(Boolean),
  };
}

export const broadcastService = defineTemplate({
  key: "broadcast.service",
  label: "Toplu duyuru — hizmet / bakım",
  group: "Duyurular",
  audience: "customer",
  editable: false,
  inbox: "SERVICE",
  schema: broadcastSchema,
  sample: {
    broadcastId: "ornek",
    subject: "Planlı bakım: WHM-1 sunucusu (15 Ekim 02:00–04:00)",
    bodyHtml: sampleBody,
    bodyText: sampleText,
    sms: "KLEACORE: 15.10 02:00-04:00 arasi WHM-1 sunucusunda planli bakim yapilacaktir.",
  },
  render: (data) => fallbackContent(data),
  renderRaw: (data) => ({
    subject: data.subject,
    preheader: preheaderOf(data),
    bodyHtml: data.bodyHtml,
    text: data.bodyText,
    footerNote: "Bu e-posta, kullandığınız hizmetlerle ilgili bilgilendirme amacıyla gönderilmiştir.",
  }),
  sms: (data) => data.sms ?? "",
});

export const broadcastMarketing = defineTemplate({
  key: "broadcast.marketing",
  label: "Toplu duyuru — kampanya",
  group: "Duyurular",
  audience: "customer",
  editable: false,
  inbox: "PROMOTION",
  schema: broadcastSchema,
  sample: {
    broadcastId: "ornek",
    subject: "Yeni VDS paketleri yayında",
    bodyHtml: "<p>Merhaba Ayşe Yılmaz,</p><p>NVMe diskli yeni VDS paketlerimiz yayında.</p>",
    bodyText: "Merhaba Ayşe Yılmaz,\n\nNVMe diskli yeni VDS paketlerimiz yayında.",
    sms: "KLEACORE: NVMe diskli yeni VDS paketleri yayinda. kleacore.com",
    unsubscribeUrl: "https://kleacore.com/abonelik/iptal?t=ornek",
  },
  render: (data) => fallbackContent(data),
  renderRaw: (data) => ({
    subject: data.subject,
    preheader: preheaderOf(data),
    bodyHtml: data.bodyHtml,
    text: data.bodyText,
    footerNote: "Bu e-postayı, kampanya ve duyurularımızı almayı kabul ettiğiniz için alıyorsunuz.",
    unsubscribeUrl: data.unsubscribeUrl,
  }),
  sms: (data) => data.sms ?? "",
  mailHeaders: (data) => {
    const url = data.oneClickUrl ?? data.unsubscribeUrl;
    return url ? { listUnsubscribe: url } : {};
  },
});
