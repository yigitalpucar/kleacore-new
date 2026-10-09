import { z } from "zod";
import { DATA_REQUEST_TYPES, dataRequestTypeLabel } from "@/lib/privacy/labels";
import { date, dateField, dateTime, templateSchema } from "./helpers";
import { defineTemplate } from "./types";

const requestShape = {
  requestNumber: z.string(),
  type: z.enum(DATA_REQUEST_TYPES),
};

/** Public KVKK form: confirm the e-mail address before the request counts. */
export const privacyRequestVerify = defineTemplate({
  key: "privacy.request-verify",
  label: "KVKK başvurusu — e-posta doğrulama",
  group: "KVKK",
  audience: "customer",
  schema: templateSchema({
    ...requestShape,
    verifyUrl: z.string().url(),
    expiresInHours: z.number().int().positive(),
  }),
  sensitive: ["verifyUrl"],
  sample: {
    recipientName: "Ayşe Yılmaz",
    requestNumber: "KVKK-2026-000012",
    type: "EXPORT",
    verifyUrl: "https://kleacore.com/yasal/kvkk-basvuru/dogrula?token=ornek",
    expiresInHours: 48,
  },
  render: (data) => ({
    subject: `KVKK başvurunuzu onaylayın (${data.requestNumber})`,
    heading: "Başvurunuzu onaylayın",
    greetingName: data.recipientName,
    intro: [
      `"${dataRequestTypeLabel(data.type)}" konulu KVKK başvurunuzu aldık. Başvurunun işleme alınması için bu e-posta adresinin size ait olduğunu doğrulamamız gerekiyor.`,
    ],
    details: [{ label: "Başvuru no", value: data.requestNumber, mono: true }],
    action: { label: "Başvurumu onayla", url: data.verifyUrl },
    outro: [
      `Bağlantı ${data.expiresInHours} saat geçerlidir. Onaylanmayan başvurular işleme alınmaz; yasal 30 günlük süre onay anından itibaren başlar.`,
    ],
    note: "Bu başvuruyu siz yapmadıysanız e-postayı yok sayın; başvuru işleme alınmaz.",
  }),
});

/** Acknowledgement with the statutory deadline. */
export const privacyRequestReceived = defineTemplate({
  key: "privacy.request-received",
  label: "KVKK başvurusu alındı",
  group: "KVKK",
  audience: "customer",
  inbox: "SYSTEM",
  schema: templateSchema({ ...requestShape, dueAt: dateField }),
  sample: { recipientName: "Ayşe Yılmaz", requestNumber: "KVKK-2026-000012", type: "EXPORT", dueAt: "2026-11-08T10:00:00.000Z" },
  render: (data, { brand }) => ({
    subject: `KVKK başvurunuz alındı (${data.requestNumber})`,
    heading: "Başvurunuz alındı",
    greetingName: data.recipientName,
    intro: [
      `6698 sayılı KVKK'nın 11. maddesi kapsamındaki "${dataRequestTypeLabel(data.type)}" başvurunuz kayda alındı.`,
      `Başvurunuzu en geç ${date(data.dueAt)} tarihine kadar sonuçlandırıp size bu adres üzerinden yanıt vereceğiz.`,
    ],
    details: [
      { label: "Başvuru no", value: data.requestNumber, mono: true },
      { label: "Talep türü", value: dataRequestTypeLabel(data.type) },
      { label: "Yanıt için son tarih", value: date(data.dueAt) },
    ],
    note: `Sorularınız için ${brand.supportEmail} adresine başvuru numaranızla yazabilirsiniz.`,
  }),
});

/** Result of the request (the admin's response text), with the export link for EXPORT. */
export const privacyRequestCompleted = defineTemplate({
  key: "privacy.request-completed",
  label: "KVKK başvurusu sonuçlandı",
  group: "KVKK",
  audience: "customer",
  inbox: "SYSTEM",
  schema: templateSchema({
    ...requestShape,
    outcome: z.enum(["COMPLETED", "REJECTED"]),
    responseText: z.string().min(1),
    // Not .url(): the inbox copy renders with the sensitive link replaced by
    // a placeholder (render.ts redactSensitive), which must still validate.
    downloadUrl: z.string().min(1).optional(),
    downloadExpiresAt: dateField.optional(),
  }),
  sensitive: ["downloadUrl"],
  sample: {
    recipientName: "Ayşe Yılmaz",
    requestNumber: "KVKK-2026-000012",
    type: "EXPORT",
    outcome: "COMPLETED",
    responseText: "Hakkınızda tuttuğumuz kişisel verilerin kopyasını hazırladık. Dosyayı aşağıdaki bağlantıdan bir kez indirebilirsiniz.",
    downloadUrl: "https://kleacore.com/yasal/kvkk-basvuru/indir?token=ornek",
    downloadExpiresAt: "2026-10-16T10:00:00.000Z",
  },
  render: (data, { brand }) => ({
    subject: `KVKK başvurunuz ${data.outcome === "COMPLETED" ? "sonuçlandı" : "hakkında karar"} (${data.requestNumber})`,
    heading: data.outcome === "COMPLETED" ? "Başvurunuz sonuçlandı" : "Başvurunuz reddedildi",
    greetingName: data.recipientName,
    intro: data.responseText.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean),
    details: [
      { label: "Başvuru no", value: data.requestNumber, mono: true },
      { label: "Talep türü", value: dataRequestTypeLabel(data.type) },
    ],
    // Only a real link becomes a button (the inbox copy has the placeholder).
    action: data.downloadUrl && /^https?:\/\//.test(data.downloadUrl) ? { label: "Verilerimi indir", url: data.downloadUrl } : undefined,
    outro: data.downloadUrl
      ? [
          `İndirme bağlantısı yalnızca bir kez kullanılabilir${data.downloadExpiresAt ? ` ve ${dateTime(data.downloadExpiresAt)} tarihine kadar geçerlidir` : ""}. Süresi dolarsa yeni bir başvuru yapabilirsiniz.`,
        ]
      : [],
    note:
      data.outcome === "REJECTED"
        ? `Yanıtımızı yetersiz bulursanız tebliğden itibaren 30 gün içinde Kişisel Verileri Koruma Kurulu'na şikâyette bulunabilirsiniz (KVKK m.14). Sorularınız için ${brand.supportEmail}.`
        : `Sorularınız için ${brand.supportEmail} adresine başvuru numaranızla yazabilirsiniz.`,
  }),
});
