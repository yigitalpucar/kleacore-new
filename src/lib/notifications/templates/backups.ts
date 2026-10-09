import { z } from "zod";
import { dateField, dateTime, panelPaths, templateSchema } from "./helpers";
import { defineTemplate } from "./types";

/** VDS backup notices (src/lib/backups); sent only when the instance enables customer backup notices. */

const shape = {
  serviceId: z.string(),
  serviceLabel: z.string(),
};

const sample = {
  recipientName: "Ayşe Yılmaz",
  serviceId: "ornek",
  serviceLabel: "VDS Pro 8 GB",
};

const TRIGGER_LABELS: Record<string, string> = {
  MANUAL: "Manuel",
  SCHEDULED: "Otomatik",
  FINAL: "Fesih öncesi",
};

function sizeLabel(mb: number | undefined) {
  if (!mb) return null;
  return mb >= 1024 ? `${(mb / 1024).toLocaleString("tr-TR", { maximumFractionDigits: 1 })} GB` : `${Math.round(mb)} MB`;
}

export const serviceBackupCompleted = defineTemplate({
  key: "service.backup-completed",
  label: "Sunucu yedeği alındı",
  group: "Hizmet",
  audience: "customer",
  inbox: "SERVICE",
  schema: templateSchema({
    ...shape,
    trigger: z.enum(["MANUAL", "SCHEDULED", "FINAL"]),
    sizeMB: z.number().optional(),
    completedAt: dateField,
  }),
  sample: { ...sample, trigger: "SCHEDULED", sizeMB: 2150, completedAt: "2026-10-09T03:12:00.000Z" },
  render: (data, { baseUrl }) => {
    const size = sizeLabel(data.sizeMB);
    return {
      subject: `Sunucunuzun yedeği alındı: ${data.serviceLabel}`,
      heading: "Yedeğiniz hazır",
      greetingName: data.recipientName,
      intro: [`${data.serviceLabel} sunucunuzun yedeği başarıyla alındı.`],
      details: [
        { label: "Sunucu", value: data.serviceLabel },
        { label: "Yedek türü", value: TRIGGER_LABELS[data.trigger] ?? data.trigger },
        { label: "Tarih", value: dateTime(data.completedAt) },
        ...(size ? [{ label: "Boyut", value: size }] : []),
      ],
      action: { label: "Yedekleri görüntüle", url: `${baseUrl}${panelPaths.service(data.serviceId)}#yedekler` },
      outro: ["Yedek hakkınız dolduğunda en eski yedek otomatik olarak silinir."],
    };
  },
});

export const serviceBackupFailed = defineTemplate({
  key: "service.backup-failed",
  label: "Sunucu yedeği / geri yükleme başarısız",
  group: "Hizmet",
  audience: "customer",
  inbox: "SERVICE",
  schema: templateSchema({
    ...shape,
    operation: z.enum(["backup", "restore"]),
  }),
  sample: { ...sample, operation: "backup" },
  render: (data, { baseUrl }) => {
    const restore = data.operation === "restore";
    return {
      subject: restore ? `Geri yükleme tamamlanamadı: ${data.serviceLabel}` : `Sunucu yedeği alınamadı: ${data.serviceLabel}`,
      heading: restore ? "Geri yükleme tamamlanamadı" : "Yedek alınamadı",
      greetingName: data.recipientName,
      intro: [
        restore
          ? `${data.serviceLabel} sunucunuza yedek geri yüklenirken bir sorun oluştu.`
          : `${data.serviceLabel} sunucunuzun yedeği alınırken bir sorun oluştu.`,
        "Ekibimiz bilgilendirildi ve sorunu inceliyor.",
      ],
      action: { label: "Sunucuyu görüntüle", url: `${baseUrl}${panelPaths.service(data.serviceId)}#yedekler` },
      outro: ["Acil bir durum varsa müşteri panelinden destek talebi açabilirsiniz."],
    };
  },
});

export const serviceBackupRestored = defineTemplate({
  key: "service.backup-restored",
  label: "Sunucu yedeği geri yüklendi",
  group: "Hizmet",
  audience: "customer",
  inbox: "SERVICE",
  schema: templateSchema({ ...shape, backupCreatedAt: dateField }),
  sample: { ...sample, backupCreatedAt: "2026-10-08T03:10:00.000Z" },
  render: (data, { baseUrl }) => ({
    subject: `Yedek geri yüklendi: ${data.serviceLabel}`,
    heading: "Sunucunuz yedekten geri yüklendi",
    greetingName: data.recipientName,
    intro: [
      `${data.serviceLabel} sunucunuz ${dateTime(data.backupCreatedAt)} tarihli yedeğe geri döndürüldü ve yeniden başlatıldı.`,
    ],
    action: { label: "Sunucuyu görüntüle", url: `${baseUrl}${panelPaths.service(data.serviceId)}` },
  }),
});
